import { NextResponse } from "next/server";
import { after } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin, clientIp, readJsonBody } from "@/lib/request-guards";

// Newsletter signup → Brevo, using Brevo's double opt-in endpoint: it stores the
// address as *unconfirmed* and mails a confirmation link, and only a click on
// that link adds the person to the list. That's what keeps a typo'd or
// maliciously entered address off the list, and it's the consent record we want
// under PDPA. Brevo also appends the unsubscribe link to every campaign.
//
// The API key stays server-side — this route is the only thing that sees it.
//
// The route answers the same way for every address it accepts, and does the
// Brevo work after responding. See the note above `respondAccepted` for why.

const BREVO_API = "https://api.brevo.com/v3";

const API_KEY = process.env.BREVO_API_KEY;
const LIST_ID = Number(process.env.BREVO_LIST_ID);
const DOI_TEMPLATE_ID = Number(process.env.BREVO_DOI_TEMPLATE_ID);
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HOUR = 60 * 60 * 1000;

// Sized for how people actually behave: nobody subscribes their household from
// one address more than a handful of times an hour, and three confirmation
// mails for the same address in a day is already generous for "it didn't
// arrive, send it again".
const PER_IP_LIMIT = 5;
const PER_IP_WINDOW = HOUR;
const PER_EMAIL_LIMIT = 3;
const PER_EMAIL_WINDOW = 24 * HOUR;

/** A signup body is an email and a locale; nothing here needs room to grow. */
const MAX_BODY_BYTES = 4 * 1024;

function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/**
 * The single answer for every address we accept.
 *
 * This used to return 409 "duplicate" when the address was already a confirmed
 * subscriber, which made the route an oracle: anyone could type an address in
 * and learn from the status code whether that person is on the association's
 * newsletter list. That's personal data under PDPA, disclosed to an anonymous
 * caller, and the per-IP limit only made it slower.
 *
 * Saying the same thing either way is the fix, and it's why the Brevo calls
 * moved into `after()` below — an identical body that arrives 400ms later for
 * one class of address than the other still answers the question.
 */
function respondAccepted() {
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Names what's missing so a misconfigured deploy says so instead of 500-ing blind. */
function missingConfig(): string[] {
  const missing: string[] = [];
  if (!API_KEY) missing.push("BREVO_API_KEY");
  if (!LIST_ID) missing.push("BREVO_LIST_ID");
  if (!DOI_TEMPLATE_ID) missing.push("BREVO_DOI_TEMPLATE_ID");
  return missing;
}

/**
 * Looks the address up before we ask Brevo to mail anything.
 *
 * Necessary because /contacts/doubleOptinConfirmation answers 204 even for an
 * address that is already a confirmed subscriber — it just mails the
 * confirmation link again. Skipping that saves a send against a quota of 300 a
 * day; it no longer changes what the caller is told.
 *
 * Fails open: if the lookup itself breaks, we'd rather send a duplicate
 * confirmation than drop a real signup.
 */
async function findContact(email: string): Promise<{ listIds?: number[]; emailBlacklisted?: boolean } | null> {
  try {
    const res = await fetch(`${BREVO_API}/contacts/${encodeURIComponent(email)}`, {
      headers: { "api-key": API_KEY as string, accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) return null; // never seen this address
    if (!res.ok) {
      console.error(`subscribe: contact lookup returned ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("subscribe: contact lookup failed", err);
    return null;
  }
}

/**
 * Runs after the response has gone out, so nothing it does — how long it takes,
 * whether it sends at all — is visible to the caller. Everything reports through
 * the log, which is now the only place a Brevo failure surfaces; that's the
 * trade for not leaking list membership.
 */
async function deliverConfirmation(email: string, locale: "th" | "en") {
  // Someone who unsubscribed (emailBlacklisted) still gets the confirmation
  // flow — that's them opting back in, and the double opt-in is the record of
  // that consent. Same for a contact who exists but hasn't confirmed yet:
  // re-sending the link is the point.
  const existing = await findContact(email);
  if (existing && existing.listIds?.includes(LIST_ID) && !existing.emailBlacklisted) {
    console.info("subscribe: address is already a confirmed subscriber — no mail sent.");
    return;
  }

  let res: Response;
  try {
    res = await fetch(`${BREVO_API}/contacts/doubleOptinConfirmation`, {
      method: "POST",
      headers: {
        "api-key": API_KEY as string,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        email,
        includeListIds: [LIST_ID],
        templateId: DOI_TEMPLATE_ID,
        // Where Brevo sends them after they click confirm — a page that says so
        // plainly, rather than the home page with a toast they can miss.
        redirectionUrl: `${SITE_URL}/${locale}/newsletter/confirmed`,
      }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("subscribe: cannot reach Brevo", err);
    return;
  }

  // 204 on success — nothing to parse.
  if (res.ok) return;

  const data = await res.json().catch(() => null);

  console.error(
    `subscribe: Brevo returned ${res.status}: ${JSON.stringify(data)}` +
      (res.status === 401 ? " — check BREVO_API_KEY." : "")
  );
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
  const body = read.body as { email?: string; locale?: string; botcheck?: unknown };

  // Honeypot: the field is hidden, so only a bot filling the form blindly sets
  // it. Answer as if it worked — telling it apart from a real signup only
  // teaches whoever wrote it to stop filling the field.
  if (body.botcheck) {
    return respondAccepted();
  }

  // Counted before the email is even validated, so spraying junk addresses
  // costs the same budget as spraying real ones.
  const byIp = rateLimit(`ip:${clientIp(request)}`, PER_IP_LIMIT, PER_IP_WINDOW);
  if (!byIp.ok) {
    return tooManyRequests(byIp.retryAfter);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const locale = body.locale === "en" ? "en" : "th";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const missing = missingConfig();
  if (missing.length > 0) {
    console.error(`subscribe: not configured — missing ${missing.join(", ")}`);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Ahead of the Brevo work rather than after the duplicate check, so this cap
  // depends only on how often the address was submitted — never on whether it
  // turned out to be a subscriber. It's still what stops "resend the link, it
  // never arrived" from becoming fifty mails.
  const byEmail = rateLimit(`email:${email}`, PER_EMAIL_LIMIT, PER_EMAIL_WINDOW);
  if (!byEmail.ok) {
    return tooManyRequests(byEmail.retryAfter);
  }

  after(() => deliverConfirmation(email, locale));

  return respondAccepted();
}
