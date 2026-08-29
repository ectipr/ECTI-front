/**
 * Scheme allowlist for any href whose value came from outside this codebase —
 * in practice, anything an editor typed into Strapi.
 *
 * The case that matters is `javascript:`. React logs a warning for it and then
 * renders the attribute anyway, so a link field is a stored-XSS sink: an editor
 * account (not an anonymous visitor) becomes script execution in every reader's
 * browser. Some URL fields carry a `regex` in their Strapi schema, but not all
 * of them do — `activity.register_url`, `journal.url` and the links inside a
 * rich-text block have none — and a schema rule only covers the field it is
 * attached to. Checking at the point of render covers every field at once,
 * including the ones added next.
 */

/**
 * `mailto:` and `tel:` are here because the contact and membership pages build
 * real links out of them. `data:` and `blob:` are deliberately absent: nothing
 * in this site links to one, and both can carry script.
 */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Returns the URL when it is safe to put in an href, `undefined` when it isn't.
 *
 * `undefined` rather than "#" or "" so the caller has to decide what an unusable
 * link should look like — usually rendering plain text instead of a dead anchor.
 */
export function safeUrl(url: string | null | undefined): string | undefined {
  if (typeof url !== "string") return undefined;

  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Root-relative paths stay on our own origin and carry no scheme at all.
  // `//host` is excluded: it looks relative but is protocol-relative, so it
  // points off-site and has to go through the parser below like any other.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Not parseable without a base — a bare "example.com", or junk.
    return undefined;
  }

  // The URL parser lowercases the scheme and strips the tabs and newlines used
  // to smuggle one past a string comparison, so `jav\tascript:` arrives here as
  // `javascript:` and fails the lookup.
  return SAFE_SCHEMES.has(parsed.protocol) ? parsed.href : undefined;
}
