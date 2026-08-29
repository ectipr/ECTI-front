import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin, clientIp } from "@/lib/request-guards";

// Contact form → the association's inbox, as a Brevo transactional email.
//
// This route exists to be a chokepoint we own, where a rate limit and real
// validation can live — a form that posts straight to a third party gives us
// neither, and leaves its access key in the client bundle for anyone to read.
//
// It used to forward to Web3Forms. That does not work from a server: Web3Forms'
// free tier accepts submissions from the browser only, and answers a server-side
// POST with 403 "Use our API in client side ... (Pro plan is required)". So
// routing through here — the thing that makes the rate limit possible — is
// exactly what their free tier rules out.
//
// Brevo has no such restriction, its transactional API is built to be called
// from a server, and we already use it for the newsletter, so the key and the
// account are already here. Its free tier is 300 emails a day against
// Web3Forms' 250 a month.
//
// This route stays public, so the limits below are what stands between a script
// and the association's inbox.

const BREVO_SEND_API = "https://api.brevo.com/v3/smtp/email";

// Trimmed: a value pasted into a dashboard picks up a trailing newline more
// often than anyone would like, and an API key with whitespace on the end fails
// in a way that looks nothing like the cause.
const API_KEY = process.env.BREVO_API_KEY?.trim();
/** Must be a sender Brevo has verified — not the visitor's address. */
const SENDER_EMAIL = process.env.CONTACT_SENDER_EMAIL?.trim();
const SENDER_NAME = process.env.CONTACT_SENDER_NAME?.trim() || "ECTI Website";
/** Where the message lands. */
const TO_EMAIL = process.env.CONTACT_TO_EMAIL?.trim();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HOUR = 60 * 60 * 1000;

// Tighter than the newsletter's 5/hour: subscribing is one click people
// genuinely retry, whereas writing out a message three times in an hour already
// means something went wrong. It also protects the sending quota: a single
// unattended script would spend a day's allowance in a minute.
const PER_IP_LIMIT = 3;
const PER_IP_WINDOW = HOUR;

/**
 * Per-field caps. Generous for a person, restrictive for a payload — the point
 * is that nothing unbounded reaches the inbox.
 */
const MAX_LENGTHS = {
  name: 100,
  contact: 150,
  subject: 150,
  message: 5000,
} as const;

/** Refuse an oversized body before reading it into memory. */
const MAX_BODY_BYTES = 64 * 1024;

type Field = keyof typeof MAX_LENGTHS;

const FIELDS: Field[] = ["name", "contact", "subject", "message"];

function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/**
 * Trims, then requires every field to be present and within its cap.
 *
 * Deliberately no email regex on `contact`: the label reads "ช่องทางการติดต่อ
 * กลับ (อีเมล หรืออื่นๆ)" / "Contact channel (email or other)", so a phone
 * number or a LINE id is a valid answer. Validating it as an email would reject
 * exactly what the form asks for.
 */
function validate(body: Record<string, unknown>): { values: Record<Field, string> } | { error: string } {
  const values = {} as Record<Field, string>;

  for (const field of FIELDS) {
    const raw = body[field];
    if (typeof raw !== "string") return { error: field };

    const value = raw.trim();
    if (!value || value.length > MAX_LENGTHS[field]) return { error: field };

    values[field] = value;
  }

  return { values };
}

/** Names what's missing so a misconfigured deploy says so instead of failing blind. */
function missingConfig(): string[] {
  const missing: string[] = [];
  if (!API_KEY) missing.push("BREVO_API_KEY");
  if (!SENDER_EMAIL) missing.push("CONTACT_SENDER_EMAIL");
  if (!TO_EMAIL) missing.push("CONTACT_TO_EMAIL");
  return missing;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The mail body. Every value here was typed by an anonymous visitor, so all four
 * are escaped — the inbox rendering this is a mail client, and an unescaped
 * message field would let a submission put markup in it.
 */
function buildHtml(values: Record<Field, string>): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 14px 6px 0;vertical-align:top;color:#5b6b7c;white-space:nowrap">${label}</td>` +
    `<td style="padding:6px 0;vertical-align:top;color:#1c2733">${escapeHtml(value)}</td></tr>`;

  return [
    '<div style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.7;color:#1c2733">',
    '<table style="border-collapse:collapse;margin:0 0 16px">',
    row("ชื่อ-นามสกุล", values.name),
    row("ช่องทางติดต่อกลับ", values.contact),
    row("เรื่อง", values.subject),
    "</table>",
    // white-space:pre-wrap so the line breaks the sender typed survive.
    `<div style="white-space:pre-wrap;border-left:3px solid #dde3ea;padding-left:14px">${escapeHtml(values.message)}</div>`,
    '<hr style="border:none;border-top:1px solid #dde3ea;margin:20px 0 12px">',
    '<p style="color:#5b6b7c;font-size:13px;margin:0">ส่งจากฟอร์มติดต่อบนเว็บไซต์ ECTI</p>',
    "</div>",
  ].join("");
}

/**
 * Reply-to, but only when the visitor gave something that is actually an email.
 *
 * The field asks for "ช่องทางการติดต่อกลับ (อีเมล หรืออื่นๆ)", so a phone number
 * or a LINE id is a valid answer — and Brevo rejects the whole send if replyTo
 * isn't a well-formed address. Skipping it there costs one convenience; sending
 * it would cost the message.
 */
function replyTo(contact: string): { email: string } | undefined {
  return EMAIL_RE.test(contact) ? { email: contact } : undefined;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Honeypot: the field is hidden, so only a bot filling the form blindly sets
  // it. Answer as if it worked — telling it apart from a real submission only
  // teaches whoever wrote it to stop ticking the box.
  if (body.botcheck) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  // Counted before validation, so spraying malformed bodies costs the same
  // budget as spraying well-formed ones.
  const byIp = rateLimit(`contact:${clientIp(request)}`, PER_IP_LIMIT, PER_IP_WINDOW);
  if (!byIp.ok) {
    return tooManyRequests(byIp.retryAfter);
  }

  const result = validate(body);
  if ("error" in result) {
    return NextResponse.json({ error: "invalid_input", field: result.error }, { status: 400 });
  }

  const missing = missingConfig();
  if (missing.length > 0) {
    console.error(`contact: not configured — missing ${missing.join(", ")}`);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const { name, contact, subject } = result.values;

  let res: Response;
  try {
    res = await fetch(BREVO_SEND_API, {
      method: "POST",
      headers: {
        "api-key": API_KEY as string,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        // Sender is our own verified address, never the visitor's: Brevo only
        // sends as a sender it has verified, and putting a stranger's address
        // here is how a domain's mail reputation gets spent.
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: TO_EMAIL }],
        // The visitor's name in the subject, so the inbox is scannable without
        // opening anything.
        subject: `[ติดต่อจากเว็บ] ${subject} — ${name}`,
        htmlContent: buildHtml(result.values),
        replyTo: replyTo(contact),
      }),
      cache: "no-store",
      // Without this a hung connection holds the request open until the
      // platform kills it, and the visitor watches a spinner the whole time.
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error("contact: cannot reach Brevo", err);
    return NextResponse.json({ error: "server_error" }, { status: 502 });
  }

  // 201 with a messageId on success.
  if (res.ok) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const data = await res.json().catch(() => null);

  console.error(
    `contact: Brevo returned ${res.status}: ${JSON.stringify(data)}` +
      (res.status === 401 ? " — check BREVO_API_KEY." : "") +
      (res.status === 400 ? " — CONTACT_SENDER_EMAIL must be a verified sender in Brevo." : "")
  );
  return NextResponse.json({ error: "server_error" }, { status: 502 });
}
