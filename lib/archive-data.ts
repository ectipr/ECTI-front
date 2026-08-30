import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
import {
  eMagazines,
  industryJournals,
  type ResourceItem,
} from "@/lib/resource-detail-data";
import { absoluteMediaUrl } from "@/lib/strapi-media";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(
  /\/+$/,
  ""
);

export interface ArchiveGroups {
  magazines: ResourceItem[];
  journals: ResourceItem[];
}

async function fetchAPI(endpoint: string) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { next: { revalidate: CMS_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || [];
  } catch {
    return [];
  }
}

/**
 * Archive items (E-magazine + ECTI industry journal) for the คลังข้อมูล page.
 *
 * Reads the Strapi `archive-item` collection (upload a PDF in the `file` field,
 * or set `link`). Until an editor adds items for a category, the page falls back
 * to the static list migrated from the legacy site (lib/resource-detail-data.ts),
 * so it is never empty. Mirrors fetchMembershipDocuments in lib/membership-data.ts.
 */
export async function getArchiveItems(locale: string): Promise<ArchiveGroups> {
  const data = await fetchAPI(
    `/api/archive-items?populate=*&sort=order:asc&locale=${locale}&pagination[pageSize]=100`
  );
  const items = Array.isArray(data) ? data : [];

  const magazines: ResourceItem[] = [];
  const journals: ResourceItem[] = [];

  for (const item of items) {
    const link =
      typeof item.link === "string" && item.link.trim() ? item.link.trim() : null;
    const href = item.file?.url ? absoluteMediaUrl(item.file.url) : link;
    if (!href) continue; // skip rows with neither a file nor a link

    const mapped: ResourceItem = {
      title: item.title || "",
      href,
      external: true, // open in a new tab → browser's native PDF viewer
      meta: item.period || undefined,
    };

    if (item.category === "journal") journals.push(mapped);
    else magazines.push(mapped);
  }

  // All-or-nothing: as soon as any archive item exists in the CMS, use the CMS
  // for the whole page (empty categories simply render nothing) instead of
  // silently mixing CMS rows with the legacy-site fallback in the same view.
  if (magazines.length > 0 || journals.length > 0) {
    return { magazines, journals };
  }
  return { magazines: eMagazines, journals: industryJournals };
}
