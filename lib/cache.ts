/**
 * How long a CMS fetch stays in the Data Cache before Next refetches it on its
 * own, in seconds.
 *
 * This is the *fallback*, not the freshness mechanism. Freshness comes from
 * Strapi's webhook: publishing anything POSTs to /api/revalidate, which drops
 * the cached pages so the next visitor gets rebuilt HTML. The timer only
 * matters when that webhook never arrives — a missed delivery, a deploy in
 * flight, WEBHOOK_SECRET rotated on one side and not the other.
 *
 * It used to be an hour, from before the webhook existed. With both running,
 * every page that gets steady traffic refetched 24 times a day to discover
 * nothing had changed — real requests against Strapi Cloud's monthly quota,
 * spent on content that only changes when an editor touches it.
 *
 * A day is long enough to stop paying for that and short enough that a dropped
 * webhook heals by itself overnight instead of stranding a page forever. That
 * self-healing is why this isn't `false`: with caching off entirely, one lost
 * webhook means a page serves stale content until someone notices and
 * redeploys.
 *
 * If content stops updating after a publish, this constant is not the problem —
 * check that the webhook is reaching /api/revalidate. Lowering this back to
 * 3600 hides that failure rather than fixing it.
 */
export const CMS_REVALIDATE_SECONDS = 86_400;
