import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin, clientIp, readJsonBody } from "@/lib/request-guards";

// Contact form → Web3Forms, proxied through here instead of straight from the
// browser. The access key used to be NEXT_PUBLIC_, which put it in the client
// bundle for anyone to read and POST with from anywhere. Moving it server-side
// hides the key, but that isn't really the point: what we get back is a
// chokepoint we own, where a rate limit and real validation can live. Web3Forms
// alone gives us neither — its own controls are in their dashboard.
//
// This route stays public, so the limits below are what stands between a script
// and the association's inbox.

const WEB3FORMS_API = "https://api.web3forms.com/submit";

const ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY;

const HOUR = 60 * 60 * 1000;

// Tighter than the newsletter's 5/hour: subscribing is one click people
// genuinely retry, whereas writing out a message three times in an hour already
// means something went wrong. Web3Forms' free tier is 250 submissions a month —
// a single unattended script would eat that in a minute.
const PER_IP_LIMIT = 3;
const PER_IP_WINDOW = HOUR;

/**
 * Per-field caps. Generous for a person, restrictive for a payload — the point
 * is that nothing unbounded reaches Web3Forms or the inbox behind it.
 */
const MAX_LENGTHS = {
  name: 100,
  contact: 150,
  subject: 150,
  message: 5000,
} as const;

/** Cap on the body, enforced while reading rather than from the declared length. */
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

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if (!read.ok) {
    return read.status === 413
      ? NextResponse.json({ error: "too_large" }, { status: 413 })
      : NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const body = read.body;

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

  if (!ACCESS_KEY) {
    console.error("contact: not configured — missing WEB3FORMS_ACCESS_KEY");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  let res: Response;
  try {
    res = await fetch(WEB3FORMS_API, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      // Same field names the browser used to send, so the mail that lands in
      // the inbox reads exactly as it did before.
      body: JSON.stringify({ access_key: ACCESS_KEY, ...result.values }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("contact: cannot reach Web3Forms", err);
    return NextResponse.json({ error: "server_error" }, { status: 502 });
  }

  // Web3Forms answers 200 with {success:false} for a rejected submission, so
  // the status alone doesn't say whether the mail went out.
  const data = await res.json().catch(() => null);

  if (res.ok && data?.success) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  console.error(
    `contact: Web3Forms returned ${res.status}: ${JSON.stringify(data)}` +
      (res.status === 401 || res.status === 403 ? " — check WEB3FORMS_ACCESS_KEY." : "")
  );
  return NextResponse.json({ error: "server_error" }, { status: 502 });
}
