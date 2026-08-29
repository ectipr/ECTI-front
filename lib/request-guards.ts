/**
 * Checks every public POST route makes before it does any work.
 *
 * Lifted out of app/api/subscribe/route.ts once app/api/contact/route.ts needed
 * the same two. Security checks that exist in two copies drift — one gets a fix
 * and the other doesn't, and nobody notices because both still return 200 on
 * the happy path.
 */

/**
 * Origins allowed to POST here, from ALLOWED_ORIGINS (comma-separated) with
 * NEXT_PUBLIC_SITE_URL folded in so the production domain doesn't have to be
 * written twice. Empty when neither is set.
 */
const ALLOWED_ORIGINS = new Set(
  [process.env.ALLOWED_ORIGINS, process.env.NEXT_PUBLIC_SITE_URL]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean)
);

/**
 * Rejects anything that didn't come from our own pages.
 *
 * Browsers send Origin on every POST, so a real submission always has one that
 * matches the site serving it. A script pointed straight at this route
 * generally doesn't.
 *
 * Where ALLOWED_ORIGINS / NEXT_PUBLIC_SITE_URL is configured that list is the
 * whole check, and every input to it comes from the environment — nothing the
 * caller sends can widen it. Without it we fall back to comparing against the
 * host the request arrived on, which is weaker: `x-forwarded-host` is
 * caller-supplied unless a proxy overwrites it, so a script that sends a
 * matching Origin and X-Forwarded-Host walks through. That fallback exists so
 * localhost and preview deploys keep working without configuration; production
 * should set the variable.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let candidate: URL;
  try {
    candidate = new URL(origin);
  } catch {
    return false;
  }

  if (ALLOWED_ORIGINS.size > 0) return ALLOWED_ORIGINS.has(candidate.origin);

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return candidate.host === host;
}

/**
 * Every caller we can't place lands in one bucket, and that bucket shares a
 * single budget. Fail closed: an unidentifiable flood is throttled as one
 * caller rather than handed a fresh limit each request.
 */
const UNKNOWN = "unknown";

/**
 * How many proxies we control sit in front of this app, each appending its view
 * of the caller to x-forwarded-for. The real client address is that many entries
 * from the *right*; everything further left was written by the caller and is
 * worth nothing. Vercel replaces the header outright rather than appending, so
 * its single entry is the default.
 */
const TRUSTED_PROXY_HOPS = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);

/**
 * Best-effort client address, used as the rate-limit key.
 *
 * Reading x-forwarded-for left-to-right is what makes a limiter decorative:
 * the header is caller-supplied, so a script that sends a different value each
 * request gets a fresh budget every time and the limit stops existing. Counting
 * from the right instead means the caller can only prepend entries we skip past.
 */
export function clientIp(request: Request): string {
  // Vercel strips any caller-supplied copy of this header before the function
  // sees it, so where it exists it can be taken at face value.
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim() || UNKNOWN;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    // Shorter than the configured hop count means this header did not come from
    // our own proxies — refuse to guess rather than trust an arbitrary entry.
    return chain[chain.length - TRUSTED_PROXY_HOPS] ?? UNKNOWN;
  }

  return request.headers.get("x-real-ip")?.trim() || UNKNOWN;
}

export type JsonBody =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: 400 | 413 };

/**
 * Reads a JSON object body, refusing anything over `maxBytes`.
 *
 * Checking content-length alone isn't enough: a chunked request doesn't send
 * that header at all, so the check passes by being absent and an unbounded body
 * gets buffered anyway. Counting bytes as they arrive is the part that actually
 * holds, and the header check stays because rejecting before reading is cheaper
 * when the caller does declare a size.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBody> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };

  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }

  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(merged));
  } catch {
    return { ok: false, status: 400 };
  }

  // An array or a bare string parses fine but isn't a form submission, and the
  // callers all index it by field name.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, status: 400 };
  }

  return { ok: true, body: parsed as Record<string, unknown> };
}
