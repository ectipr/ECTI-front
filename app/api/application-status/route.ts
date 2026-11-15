import { NextResponse } from "next/server";
import { after } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { sameOrigin, clientIp, readJsonBody } from "@/lib/request-guards";
import {
  lookupApplicationStatus,
  missingJotformConfig,
  type ApplicationStatus,
} from "@/lib/jotform";

// "Where is my membership application?" — the answer goes to the applicant's
// mailbox, never to the screen.
//
// That is the whole security design, and it is the same one a password reset
// uses: the mailbox is the proof of identity. Type a stranger's address and the
// status is mailed to the stranger; the person at the keyboard learns nothing.
// It is why this needs no confirmation code — an OTP would mail something to
// the same mailbox to unlock the same information, spending two sends out of
// Brevo's 300 a day for no gain.
//
// What the design does depend on:
//
//   * This route says exactly one thing back, to everybody. Answering "no
//     application found" on the screen would turn it into a lookup for who has
//     applied to the association — personal data handed to an anonymous caller,
//     the same mistake /api/subscribe used to make with its 409. The Jotform and
//     Brevo work therefore happens in after(), once the response has gone: an
//     identical body that arrives 400ms sooner for one class of address still
//     answers the question.
//
//   * An address with no application still gets an email, saying so. The real
//     owner is the only one who reads it, and "no application is attached to
//     this address" is what they need to hear; silence would read as a broken
//     website.
//
//   * The rate limits below are what stops this being a way to mail a stranger
//     repeatedly.
//
// The email carries the status, the submission date and where to ask questions
// — deliberately nothing out of the application itself. If it ever reaches the
// wrong mailbox, an address and a review status is all it discloses.

const BREVO_SEND_API = "https://api.brevo.com/v3/smtp/email";

const API_KEY = process.env.BREVO_API_KEY?.trim();

/**
 * Must be a sender Brevo has verified. Falls back to the contact form's sender
 * so a deploy that already sends mail needs no new configuration; the override
 * exists for accounts that would rather these came from their own address.
 */
const SENDER_EMAIL =
  process.env.APPLICATION_SENDER_EMAIL?.trim() || process.env.CONTACT_SENDER_EMAIL?.trim();
const SENDER_NAME =
  process.env.APPLICATION_SENDER_NAME?.trim() ||
  process.env.CONTACT_SENDER_NAME?.trim() ||
  "ECTI Association";

/** Where a reply lands, when the association's inbox is configured. */
const REPLY_TO = process.env.CONTACT_TO_EMAIL?.trim();

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HOUR = 60 * 60 * 1000;

// Checking a status is not something a person does repeatedly — the answer only
// changes when the committee meets. These are sized to leave room for "it went
// to spam, send it again" and nothing more, because every request past the
// first is a mail into somebody's inbox.
const PER_IP_LIMIT = 5;
const PER_IP_WINDOW = HOUR;
const PER_EMAIL_LIMIT = 3;
const PER_EMAIL_WINDOW = HOUR;

/** An email and a locale; nothing here needs room to grow. */
const MAX_BODY_BYTES = 4 * 1024;

type Locale = "th" | "en";

/** The four things the email can say. */
type MailKind = ApplicationStatus | "not_found";

interface Copy {
  subject: string;
  heading: string;
  /** Paragraphs, in order. */
  body: string[];
}

const COPY: Record<Locale, Record<MailKind, Copy>> = {
  th: {
    in_progress: {
      subject: "สถานะใบสมัครสมาชิก ECTI: กำลังพิจารณา",
      heading: "ใบสมัครของคุณอยู่ระหว่างการพิจารณา",
      body: [
        "สมาคมได้รับใบสมัครของคุณเรียบร้อยแล้ว และขณะนี้อยู่ในขั้นตอนการตรวจสอบเอกสารและหลักฐานการชำระเงิน",
        "เมื่อการพิจารณาเสร็จสิ้น คุณจะได้รับอีเมลแจ้งผลโดยไม่ต้องตรวจสอบสถานะซ้ำ",
      ],
    },
    accepted: {
      subject: "สถานะใบสมัครสมาชิก ECTI: อนุมัติแล้ว",
      heading: "ใบสมัครของคุณได้รับการอนุมัติแล้ว",
      body: [
        "ยินดีต้อนรับเข้าสู่สมาคม ECTI — ใบสมัครของคุณผ่านการพิจารณาเรียบร้อยแล้ว",
        "หากยังไม่ได้รับหมายเลขสมาชิกหรือเอกสารยืนยันการเป็นสมาชิก กรุณาติดต่อสมาคมเพื่อขอข้อมูลเพิ่มเติม",
      ],
    },
    denied: {
      subject: "สถานะใบสมัครสมาชิก ECTI: ไม่ผ่านการพิจารณา",
      heading: "ใบสมัครของคุณไม่ผ่านการพิจารณา",
      body: [
        "ขออภัย ใบสมัครที่ผูกกับอีเมลนี้ไม่ผ่านการพิจารณา",
        "สาเหตุที่พบบ่อยคือเอกสารไม่ครบ หลักฐานการชำระเงินไม่ชัดเจน หรือคุณสมบัติไม่ตรงกับประเภทสมาชิกที่เลือก หากต้องการทราบเหตุผลหรือยื่นสมัครใหม่ กรุณาติดต่อสมาคม",
      ],
    },
    not_found: {
      subject: "ไม่พบใบสมัครสมาชิก ECTI ที่ผูกกับอีเมลนี้",
      heading: "ไม่พบใบสมัครที่ผูกกับอีเมลนี้",
      body: [
        "มีการขอตรวจสอบสถานะใบสมัครสมาชิกสำหรับอีเมลนี้ แต่ในระบบไม่พบใบสมัครที่ใช้อีเมลนี้",
        "ถ้าคุณเป็นผู้สมัคร เป็นไปได้ว่ากรอกอีเมลอื่นไว้ในใบสมัคร หรือใบสมัครยังส่งไม่สำเร็จ กรุณาตรวจสอบอีเมลที่ใช้สมัครอีกครั้ง หรือติดต่อสมาคมเพื่อให้ตรวจสอบให้",
      ],
    },
  },
  en: {
    in_progress: {
      subject: "ECTI membership application status: under review",
      heading: "Your application is under review",
      body: [
        "The association has received your application and is checking the documents and proof of payment.",
        "You will be emailed once a decision is made — there is no need to check again.",
      ],
    },
    accepted: {
      subject: "ECTI membership application status: approved",
      heading: "Your application has been approved",
      body: [
        "Welcome to the ECTI Association — your membership application has been approved.",
        "If you have not yet received your membership number or confirmation documents, please contact the association.",
      ],
    },
    denied: {
      subject: "ECTI membership application status: not approved",
      heading: "Your application was not approved",
      body: [
        "We are sorry to say that the application attached to this address was not approved.",
        "The usual reasons are incomplete documents, unclear proof of payment, or eligibility not matching the membership type applied for. Please contact the association if you would like to know more or to apply again.",
      ],
    },
    not_found: {
      subject: "No ECTI membership application found for this address",
      heading: "No application is attached to this address",
      body: [
        "Someone asked for the status of a membership application for this email address, and no application using it was found.",
        "If you did apply, the application may carry a different address, or it may not have been submitted successfully. Please check which address you used, or contact the association and we will look it up for you.",
      ],
    },
  },
};

const LABELS: Record<
  Locale,
  {
    eyebrow: string;
    badge: Record<MailKind, string>;
    submitted: string;
    memberSince: string;
    expires: string;
    contact: string;
    org: string;
    footer: string;
    logoAlt: string;
  }
> = {
  th: {
    eyebrow: "สถานะใบสมัครสมาชิก",
    badge: {
      in_progress: "กำลังพิจารณา",
      accepted: "อนุมัติแล้ว",
      denied: "ไม่ผ่านการพิจารณา",
      not_found: "ไม่พบใบสมัคร",
    },
    submitted: "วันที่ยื่นใบสมัคร",
    memberSince: "วันที่เริ่มเป็นสมาชิก",
    expires: "วันหมดอายุสมาชิก",
    contact: "ติดต่อสมาคม",
    org: "สมาคมวิชาการไฟฟ้า อิเล็กทรอนิกส์ คอมพิวเตอร์ โทรคมนาคม และสารสนเทศ",
    footer:
      "อีเมลนี้ถูกส่งเพราะมีการขอตรวจสอบสถานะใบสมัครด้วยอีเมลนี้บนเว็บไซต์ ECTI " +
      "หากคุณไม่ได้เป็นผู้ขอ ไม่ต้องดำเนินการใด ๆ",
    logoAlt: "สมาคม ECTI",
  },
  en: {
    eyebrow: "Membership application status",
    badge: {
      in_progress: "Under review",
      accepted: "Approved",
      denied: "Not approved",
      not_found: "No application found",
    },
    submitted: "Application date",
    memberSince: "Member since",
    expires: "Membership expires",
    contact: "Contact the association",
    org:
      "Electrical Engineering/Electronics, Computer, Telecommunications and Information Technology Association",
    footer:
      "This email was sent because a status check was requested for this address on the ECTI " +
      "website. If that was not you, no action is needed.",
    logoAlt: "ECTI Association",
  },
};

function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

/**
 * The single answer, for every address and every outcome — including an address
 * with no application, and a Jotform lookup that failed. See the note at the
 * top of the file.
 */
function respondAccepted() {
  return NextResponse.json({ ok: true }, { status: 202 });
}

/** Names what's missing so a misconfigured deploy says so instead of failing blind. */
function missingConfig(): string[] {
  const missing = missingJotformConfig();
  if (!API_KEY) missing.push("BREVO_API_KEY");
  if (!SENDER_EMAIL) missing.push("APPLICATION_SENDER_EMAIL or CONTACT_SENDER_EMAIL");
  return missing;
}

/**
 * "2026-09-08" as a date a reader recognises.
 *
 * The value arrives from lib/jotform.ts already reduced to the Thai calendar
 * date the application was submitted on, so what is left is formatting. Parsed
 * as UTC and formatted in UTC on purpose: a bare date carries no zone, and
 * letting the server's zone decide would slide it a day backwards on any deploy
 * region west of Bangkok.
 */
function formatDate(isoDate: string, locale: Locale): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;

  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * "2026-09-20 18:26" as a date and time a reader recognises.
 *
 * The stamp from lib/jotform.ts is a wall clock carrying no zone, so it is
 * parsed and formatted as UTC — the same trick formatDate uses — which prints
 * back the exact clock Jotform showed, on any deploy region. Falls back to the
 * raw stamp if it somehow doesn't parse.
 */
function formatDateTime(wallClock: string, locale: Locale): string {
  const date = new Date(`${wallClock.trim().replace(" ", "T")}:00Z`);
  if (Number.isNaN(date.getTime())) return wallClock;

  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
}

/**
 * The same "YYYY-MM-DD HH:mm" wall clock a year on — the membership term —
 * or null if it doesn't parse. A Feb-29 start rolls into the next March when
 * formatted, which is close enough for an expiry date.
 */
function addOneYear(wallClock: string): string | null {
  const m = wallClock.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return `${Number(y) + 1}-${mo}-${d} ${h}:${mi}`;
}

/** Sampled from the logo — the same palette as the newsletter mail in ECTI-cms. */
const BRAND_BLUE = "#0b3d91";
const BRAND_RED = "#aa1e1e";
const INK = "#16202b";
const INK_SOFT = "#5a6875";
const RULE = "#dde4ec";
const GROUND = "#eef1f5";
const FONT = "'Noto Sans Thai',Tahoma,'Helvetica Neue',Arial,sans-serif";

/** Badge colours per outcome: text on a pale fill of the same hue. */
const BADGE: Record<MailKind, { fg: string; bg: string }> = {
  in_progress: { fg: "#8a5a00", bg: "#fff4d6" },
  accepted: { fg: "#17643a", bg: "#e3f5ea" },
  denied: { fg: BRAND_RED, bg: "#fbe7e7" },
  not_found: { fg: INK_SOFT, bg: "#edf0f4" },
};

/**
 * The mail body.
 *
 * Built like the newsletter mail in ECTI-cms (src/newsletter.ts): tables and
 * inline styles only, because Outlook renders through Word and Gmail strips
 * <style> blocks. The logo is an absolute URL on the public site, and every
 * layer under it is styled so the mail still reads when images are blocked.
 *
 * Everything in it is fixed copy plus dates the route formatted itself; nothing
 * that came from Jotform. That is what keeps this safe to send to an address
 * that might not be the applicant's.
 */
function buildHtml(
  kind: MailKind,
  locale: Locale,
  submittedAt?: string,
  approvedAt?: string
): string {
  const copy = COPY[locale][kind];
  const labels = LABELS[locale];
  const badge = BADGE[kind];
  const membershipUrl = `${SITE_URL}/${locale}/membership#status`;
  const contactUrl = `${SITE_URL}/${locale}/contact`;
  const logoUrl = `${SITE_URL}/images/ecti-logo-email.png`;

  const paragraphs = copy.body
    .map(
      (text) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:${INK_SOFT}">${text}</p>`
    )
    .join("");

  // Only an approved application carries a membership term, and only then is the
  // start stamp meaningful — see the note in lib/jotform.ts. The expiry is that
  // start a year on; if either fails to parse the row is simply left out.
  const expiresAt = kind === "accepted" && approvedAt ? addOneYear(approvedAt) : null;
  const rows: [label: string, value: string, highlight: boolean][] = [];
  if (submittedAt) rows.push([labels.submitted, formatDate(submittedAt, locale), false]);
  if (kind === "accepted" && approvedAt) {
    rows.push([labels.memberSince, formatDateTime(approvedAt, locale), false]);
    if (expiresAt) rows.push([labels.expires, formatDateTime(expiresAt, locale), true]);
  }

  const details = rows.length
    ? [
        `<tr><td style="padding:6px 32px 22px">`,
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f8fb;border:1px solid ${RULE};border-radius:8px">`,
        rows
          .map(
            ([label, value, highlight], i) =>
              `<tr><td style="padding:12px 18px;${i ? `border-top:1px solid ${RULE};` : ""}font-family:${FONT}">` +
              `<p style="margin:0;font-size:12px;line-height:1.5;color:${INK_SOFT}">${label}</p>` +
              `<p style="margin:2px 0 0;font-size:15px;line-height:1.5;font-weight:700;color:${highlight ? BRAND_BLUE : INK}">${value}</p>` +
              "</td></tr>"
          )
          .join(""),
        "</table>",
        "</td></tr>",
      ].join("")
    : "";

  return [
    // Preheader: the line a client shows next to the subject in the inbox list.
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${copy.heading}</div>`,

    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GROUND};margin:0;padding:24px 12px">`,
    '<tr><td align="center">',
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden">`,

    // ── masthead ──────────────────────────────────────────────────────
    `<tr><td align="center" style="padding:28px 32px 22px">`,
    `<a href="${SITE_URL}/${locale}" style="text-decoration:none">`,
    `<img src="${logoUrl}" width="260" alt="${labels.logoAlt}" style="display:block;width:260px;max-width:65%;height:auto;border:0;font-family:${FONT};font-size:20px;font-weight:700;color:${BRAND_BLUE}">`,
    "</a>",
    "</td></tr>",
    `<tr><td style="padding:0 32px"><div style="height:3px;background:${BRAND_RED};border-radius:2px"></div></td></tr>`,

    // ── body ──────────────────────────────────────────────────────────
    `<tr><td style="padding:26px 32px 0;font-family:${FONT}">`,
    // Tracking only in English: spaced-out Thai letters break apart visually.
    `<p style="margin:0 0 12px;font-size:12px;${locale === "en" ? "letter-spacing:.09em;text-transform:uppercase;" : ""}color:${BRAND_BLUE};font-weight:700">${labels.eyebrow}</p>`,
    `<p style="margin:0 0 14px"><span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${badge.bg};color:${badge.fg};font-size:13px;font-weight:700;line-height:1.5">${labels.badge[kind]}</span></p>`,
    `<h1 style="margin:0 0 14px;font-size:23px;line-height:1.35;color:${INK};font-weight:700">${copy.heading}</h1>`,
    paragraphs,
    "</td></tr>",

    details,

    // ── call to action ────────────────────────────────────────────────
    // A table rather than a padded <a>: Outlook ignores padding on an inline
    // element, which would collapse the button into a bare blue link.
    `<tr><td style="padding:4px 32px 30px">`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    `<td align="center" style="background:${BRAND_BLUE};border-radius:6px">`,
    `<a href="${contactUrl}" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${labels.contact}</a>`,
    "</td></tr></table>",
    "</td></tr>",

    // ── footer ────────────────────────────────────────────────────────
    `<tr><td style="padding:0 32px"><div style="height:1px;background:${RULE}"></div></td></tr>`,
    `<tr><td style="padding:20px 32px 28px;font-family:${FONT}">`,
    `<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${INK};font-weight:700">${labels.org}</p>`,
    `<p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${INK_SOFT}">${labels.footer}</p>`,
    `<p style="margin:0;font-size:12px;line-height:1.6"><a href="${membershipUrl}" style="color:${INK_SOFT}">${membershipUrl}</a></p>`,
    "</td></tr>",

    "</table></td></tr></table>",
  ].join("");
}

/**
 * Runs after the response has gone out, so nothing it does — how long the
 * Jotform lookup takes, whether an email is sent at all — is visible to the
 * caller. The log is the only place a failure surfaces; that is the trade for
 * not disclosing who has applied.
 */
async function deliverStatus(email: string, locale: Locale) {
  const lookup = await lookupApplicationStatus(email);

  // A lookup that broke is the one case where nothing is sent: "no application
  // found" would be a lie, and any other wording would be a guess. The error is
  // already in the log from lib/jotform.ts.
  if (!lookup.ok) return;

  const kind: MailKind = lookup.found ? lookup.status : "not_found";
  const submittedAt = lookup.found ? lookup.submittedAt : undefined;
  const approvedAt = lookup.found ? lookup.approvedAt : undefined;

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
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email }],
        subject: COPY[locale][kind].subject,
        htmlContent: buildHtml(kind, locale, submittedAt, approvedAt),
        ...(REPLY_TO ? { replyTo: { email: REPLY_TO } } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error("application-status: cannot reach Brevo", err);
    return;
  }

  // 201 with a messageId on success.
  if (res.ok) return;

  const data = await res.json().catch(() => null);

  console.error(
    `application-status: Brevo returned ${res.status}: ${JSON.stringify(data)}` +
      (res.status === 401 ? " — check BREVO_API_KEY." : "") +
      (res.status === 400
        ? " — the sender address must be verified in Brevo (APPLICATION_SENDER_EMAIL / CONTACT_SENDER_EMAIL)."
        : "")
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
  // it. Answer as if it worked — telling it apart from a real request only
  // teaches whoever wrote it to stop filling the field.
  if (body.botcheck) {
    return respondAccepted();
  }

  // Counted before the address is even validated, so spraying junk costs the
  // same budget as spraying real addresses.
  const byIp = rateLimit(`status:ip:${clientIp(request)}`, PER_IP_LIMIT, PER_IP_WINDOW);
  if (!byIp.ok) {
    return tooManyRequests(byIp.retryAfter);
  }

  // Trimmed and lowercased, and nothing more. It is tempting to also strip a
  // Gmail "+tag", since +tag and the bare address are the same mailbox — but
  // Jotform stores the string the applicant typed and matches it exactly, so
  // stripping the tag would look up an address that was never submitted.
  const email = (body.email ?? "").trim().toLowerCase();
  const locale: Locale = body.locale === "en" ? "en" : "th";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const missing = missingConfig();
  if (missing.length > 0) {
    console.error(`application-status: not configured — missing ${missing.join(", ")}`);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Ahead of the lookup rather than after it, so this cap depends only on how
  // often the address was asked about — never on whether it turned out to have
  // an application. It is also what stops this being a way to mail a stranger
  // five times an hour.
  const byEmail = rateLimit(`status:email:${email}`, PER_EMAIL_LIMIT, PER_EMAIL_WINDOW);
  if (!byEmail.ok) {
    return tooManyRequests(byEmail.retryAfter);
  }

  after(() => deliverStatus(email, locale));

  return respondAccepted();
}
