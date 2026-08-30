/**
 * Reads every page of a Strapi collection, not just the first one.
 *
 * Strapi answers a list request with 25 entries unless you ask for more, and a
 * caller that never asks gets a silent truncation: 200 OK, a well-formed body,
 * and two thirds of the archive missing. Nothing in the response looks wrong
 * unless you read `meta.pagination.total`, which is the number the page ends up
 * displaying while the list under it is short.
 *
 * That is what happened after the legacy import. News went from 12 entries to
 * 72 and conferences to 49, both quietly capped at 25, and which 25 you got
 * depended on the sort — for the imported posts, effectively the order they
 * were created in rather than anything a reader would recognise.
 *
 * 100 a page is Strapi's own maximum for the default configuration, so this is
 * one request for anything the site currently holds and stays correct if that
 * changes.
 */
const PAGE_SIZE = 100;

/** Guards against a paginated read that never terminates. */
const MAX_PAGES = 50;

export async function fetchAllPages(
  buildUrl: (page: number, pageSize: number) => string,
  options: { label?: string; revalidate?: number } = {}
): Promise<any[]> {
  const { label = "fetchAllPages", revalidate } = options;
  const rows: any[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let json: any;

    try {
      const res = await fetch(buildUrl(page, PAGE_SIZE), {
        ...(revalidate === undefined ? {} : { next: { revalidate } }),
      });
      if (!res.ok) {
        console.warn(`${label}: page ${page} returned ${res.status}`);
        break;
      }
      json = await res.json();
    } catch (err) {
      console.warn(`${label}: page ${page} unavailable`, err);
      break;
    }

    if (!json || !Array.isArray(json.data)) break;
    rows.push(...json.data);

    // Returning what we have rather than throwing: a page that loads with most
    // of the archive beats a page that fails outright, and the warning above
    // says which request went missing.
    const pageCount = json.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
  }

  return rows;
}
