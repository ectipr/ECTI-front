/**
 * Reads the review status of a membership application out of Jotform.
 *
 * Server-side only. JOTFORM_API_KEY is a key over every submission on the
 * account — every applicant's name, address and phone number — so nothing here
 * may be reached from a client component, and the key must never be given a
 * NEXT_PUBLIC_ name.
 *
 * Why a helper rather than a fetch inside the route: Jotform's API has three
 * behaviours that each turn into telling an applicant something false, and all
 * three have to be handled on every single lookup.
 *
 * 1. The approval outcome is not in the API. A submission carries
 *    `status: "ACTIVE" | "DELETED"` — whether the row was deleted, nothing to do
 *    with the review — and both `form/{id}/approvals` and `form/{id}/workflow`
 *    answer 404. The Approved / Denied / In Progress column that is visible in
 *    Jotform Tables belongs to the Approvals product and is not served over
 *    REST at all. So the status read here is an ordinary *field on the form*
 *    that the approval workflow writes its outcome into — see STATUS_FIELD.
 *
 * 2. Deleted submissions still come back from /submissions. A withdrawn or
 *    junked application would otherwise be reported as if it were live.
 *
 * 3. One address can hold several submissions — somebody who applied twice, or
 *    re-applied after being denied. Only the most recent one answers the
 *    question "where is my application", so the ordering is not optional.
 */

const JOTFORM_API = "https://api.jotform.com";

// Trimmed, like the Brevo key: a value pasted into a dashboard picks up a
// trailing newline more often than anyone would like, and a key with whitespace
// on the end fails in a way that looks nothing like the cause.
const API_KEY = process.env.JOTFORM_API_KEY?.trim();
const FORM_ID = process.env.JOTFORM_FORM_ID?.trim();

/**
 * Filter key for the form's email field, in Jotform's `q<qid>_<field name>`
 * shape. `q8_xmelemail` is the membership form's "อีเมล (Email)" field as it
 * stands; it is an env var because rebuilding that field in Jotform renames it,
 * and a stale value here must be fixable without a deploy.
 *
 * A wrong key does not leak anything — Jotform then ignores the filter and
 * returns unrelated submissions, which `lookupApplicationStatus` drops because
 * it re-checks the address on every row it is handed. It does make the feature
 * silently answer "no application found", so that case logs a warning naming
 * this variable.
 */
const EMAIL_FILTER_KEY = process.env.JOTFORM_EMAIL_FILTER_KEY?.trim() || "q8_xmelemail";

/**
 * The form field the approval workflow writes its outcome into. Read by field
 * name rather than by question id, so that adding or reordering questions in
 * Jotform doesn't quietly point this at the wrong answer.
 */
const STATUS_FIELD = process.env.JOTFORM_STATUS_FIELD?.trim() || "application_status";

/** Plenty for "this person applied more than once"; nowhere near Jotform's 1000 cap. */
const MAX_SUBMISSIONS = 50;

/** Without this a hung connection holds the lookup open until the platform kills it. */
const TIMEOUT_MS = 10_000;

/**
 * The zone Jotform stamps `created_at` in.
 *
 * Not UTC, and not the account's own setting: `GET /user` on this account
 * reports `time_zone: "Asia/Bangkok"`, yet a submission made at 20:55 Thai time
 * on 2026-09-12 came back stamped `2026-09-12 09:55:25` — four hours behind UTC,
 * the zone of the US region the account lives in. Reading the date straight off
 * that string reports the day before for anything submitted before 11:00 Thai
 * time, which is most of a working morning.
 *
 * Written as a zone rather than a fixed -4 so the conversion survives US
 * daylight saving. If Jotform turns out to stamp a fixed offset instead, the
 * leftover error is one hour in winter, which changes the reported date only
 * for a submission made between 00:00 and 01:00.
 */
const JOTFORM_TIME_ZONE = "America/New_York";

/** The zone the applicant submitted in, and so the one the date is reported in. */
const DISPLAY_TIME_ZONE = "Asia/Bangkok";

export type ApplicationStatus = "in_progress" | "accepted" | "denied";

export type StatusLookup =
  /** Jotform could not be reached, or answered something unusable. */
  | { ok: false }
  | { ok: true; found: false }
  | { ok: true; found: true; status: ApplicationStatus; submittedAt: string };

/**
 * What the status field is allowed to say.
 *
 * The values the workflow writes are the `in_progress` / `accepted` / `denied`
 * slugs, so that rewording anything for applicants never touches code. The rest
 * are here because a human editing the column in Jotform Tables will reasonably
 * type Jotform's own vocabulary instead, and being strict about it would report
 * a decided application as still under review.
 */
const STATUS_ALIASES: Record<string, ApplicationStatus> = {
  in_progress: "in_progress",
  inprogress: "in_progress",
  "in progress": "in_progress",
  pending: "in_progress",
  accepted: "accepted",
  approved: "accepted",
  approve: "accepted",
  denied: "denied",
  deny: "denied",
  rejected: "denied",
};

interface Answer {
  name?: string;
  type?: string;
  answer?: unknown;
}

interface Submission {
  status?: string;
  created_at?: string;
  answers?: Record<string, Answer>;
}

/** Names what's missing so a misconfigured deploy says so instead of failing blind. */
export function missingJotformConfig(): string[] {
  const missing: string[] = [];
  if (!API_KEY) missing.push("JOTFORM_API_KEY");
  if (!FORM_ID) missing.push("JOTFORM_FORM_ID");
  return missing;
}

/** Trim and lowercase, and nothing else — see the note in the route. */
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** The address on a submission, from whichever question is the email field. */
function submissionEmail(submission: Submission): string | null {
  for (const answer of Object.values(submission.answers ?? {})) {
    if (answer.type === "control_email" && typeof answer.answer === "string") {
      return normalize(answer.answer);
    }
  }
  return null;
}

/**
 * The review status on a submission.
 *
 * Missing field, empty value and unrecognised value all fall through to "under
 * review", which is the honest reading in each case: every application
 * submitted before the status field existed in the form has no value for it,
 * and an application nobody has decided on yet is exactly one that is still
 * being reviewed. The alternative — an error, or a blank space in the email —
 * tells an applicant nothing and generates a phone call.
 */
function submissionStatus(submission: Submission): ApplicationStatus {
  for (const answer of Object.values(submission.answers ?? {})) {
    if (answer.name !== STATUS_FIELD) continue;

    // A dropdown answers with a string; a single-select radio or checkbox can
    // answer with a one-element array.
    const raw = Array.isArray(answer.answer) ? answer.answer[0] : answer.answer;
    if (typeof raw !== "string") break;

    const value = raw.trim().toLowerCase();
    if (value in STATUS_ALIASES) return STATUS_ALIASES[value];

    if (value) {
      console.warn(
        `application-status: field "${STATUS_FIELD}" holds an unrecognised value — ` +
          "reporting the application as under review. Expected one of " +
          "in_progress / accepted / denied."
      );
    }
    break;
  }

  return "in_progress";
}

/** `instant` as a "YYYY-MM-DD HH:mm:ss" wall clock in `timeZone`. */
function wallClockIn(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return (
    `${part("year")}-${part("month")}-${part("day")} ` +
    `${part("hour")}:${part("minute")}:${part("second")}`
  );
}

/** "YYYY-MM-DD HH:mm:ss" read as if the wall clock were UTC; NaN if unparseable. */
function asIfUtc(wallClock: string): number {
  return Date.parse(`${wallClock.trim().replace(" ", "T")}Z`);
}

/**
 * The Thai calendar date a Jotform timestamp belongs to, as "YYYY-MM-DD".
 *
 * Reading the stamp as UTC puts it `offset` away from the real instant, so the
 * offset of JOTFORM_TIME_ZONE has to be measured and taken back off. It is
 * measured by formatting a candidate instant in that zone and comparing, which
 * needs a candidate to start from — hence two passes: the first offset is
 * measured at the wrong instant, the second at one that is at most an hour out,
 * which is what keeps a stamp near a daylight-saving switch on the right side
 * of it.
 *
 * Falls back to the date as Jotform wrote it if either parse fails — a date a
 * day out still beats sending an applicant no date at all — and to nothing at
 * all if that isn't a date either, which leaves the line out of the mail
 * instead of printing whatever Jotform sent into it.
 */
function submissionDate(createdAt: string): string {
  const written = createdAt.trim().slice(0, 10);
  const fallback = /^\d{4}-\d{2}-\d{2}$/.test(written) ? written : "";

  const asUtc = asIfUtc(createdAt);
  if (Number.isNaN(asUtc)) return fallback;

  let instant = asUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    const seen = asIfUtc(wallClockIn(new Date(instant), JOTFORM_TIME_ZONE));
    if (Number.isNaN(seen)) return fallback;
    instant = asUtc - (seen - instant);
  }

  return wallClockIn(new Date(instant), DISPLAY_TIME_ZONE).slice(0, 10);
}

/**
 * The most recent live application for `email`, or `found: false`.
 *
 * Never throws: the caller runs after the response has already gone out, so a
 * failure here has nowhere to surface except the log.
 */
export async function lookupApplicationStatus(email: string): Promise<StatusLookup> {
  if (missingJotformConfig().length > 0) return { ok: false };

  const wanted = normalize(email);
  const filter = JSON.stringify({ [`${EMAIL_FILTER_KEY}:eq`]: wanted });
  const url =
    `${JOTFORM_API}/form/${encodeURIComponent(FORM_ID as string)}/submissions` +
    `?limit=${MAX_SUBMISSIONS}&filter=${encodeURIComponent(filter)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      // In the header rather than the documented apiKey query parameter, so the
      // key doesn't end up in anything that logs URLs.
      headers: { APIKEY: API_KEY as string, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error("application-status: cannot reach Jotform", err);
    return { ok: false };
  }

  if (!res.ok) {
    console.error(
      `application-status: Jotform returned ${res.status}` +
        (res.status === 401 ? " — check JOTFORM_API_KEY." : "") +
        (res.status === 404 ? " — check JOTFORM_FORM_ID." : "")
    );
    return { ok: false };
  }

  let content: unknown;
  try {
    content = (await res.json())?.content;
  } catch (err) {
    console.error("application-status: Jotform sent something unparseable", err);
    return { ok: false };
  }

  if (!Array.isArray(content)) {
    console.error("application-status: Jotform sent no submission list");
    return { ok: false };
  }

  const rows = content as Submission[];

  // The address is re-checked here rather than trusted from the filter. It costs
  // one comparison, and it is what makes a stale EMAIL_FILTER_KEY harmless: an
  // ignored filter returns other people's applications, and mailing one of
  // those to whoever typed the address would be the worst bug this feature
  // could have.
  const mine = rows.filter((row) => row.status === "ACTIVE" && submissionEmail(row) === wanted);

  if (mine.length === 0) {
    if (rows.length > 0) {
      console.warn(
        `application-status: Jotform returned ${rows.length} submission(s), none of them for ` +
          `the address asked about — JOTFORM_EMAIL_FILTER_KEY ("${EMAIL_FILTER_KEY}") is ` +
          "probably stale, so every lookup will report no application found."
      );
    }
    return { ok: true, found: false };
  }

  // created_at is "YYYY-MM-DD HH:mm:ss" in one fixed zone for every row, so the
  // plain string comparison is also the chronological one.
  const latest = mine.reduce((newest, row) =>
    (row.created_at ?? "") > (newest.created_at ?? "") ? row : newest
  );

  return {
    ok: true,
    found: true,
    status: submissionStatus(latest),
    submittedAt: submissionDate(latest.created_at ?? ""),
  };
}
