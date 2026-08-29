/**
 * Checks every public POST route makes before it does any work.
 *
 * Lifted out of app/api/subscribe/route.ts once app/api/contact/route.ts needed
 * the same two. Security checks that exist in two copies drift — one gets a fix
 * and the other doesn't, and nobody notices because both still return 200 on
 * the happy path.
 */

/**
 * Rejects anything that didn't come from our own pages.
 *
 * Browsers send Origin on every POST, so a real submission always has one that
 * matches the host serving it. A script pointed straight at this route
 * generally doesn't — cheap to check, and it doesn't need a list of allowed
 * hosts to maintain, so preview deploys and localhost work unchanged.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Best-effort client address. Vercel puts the real one first in
 * x-forwarded-for; locally there is no proxy and every caller collapses into
 * one "unknown" bucket, which is fine — the limit still holds in dev, it just
 * holds for everyone at once.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
