import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
import {
  associationDocuments,
  type ResourceItem,
} from "@/lib/resource-detail-data";
import { absoluteMediaUrl } from "@/lib/strapi-media";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(
  /\/+$/,
  ""
);

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
 * Association documents (bylaws, reimbursement / loan forms) for the
 * Resources → เอกสารของสมาคม page. Reads the Strapi `association-document`
 * collection (upload a PDF in the `file` field, or set `link`). Until an editor
 * adds items, it falls back to the legacy-site links (lib/resource-detail-data.ts)
 * so the page is never empty. Mirrors getArchiveItems / fetchMembershipDocuments.
 */
export async function getAssociationDocuments(
  locale: string
): Promise<ResourceItem[]> {
  const data = await fetchAPI(
    `/api/association-documents?populate=*&sort=order:asc&locale=${locale}&pagination[pageSize]=100`
  );
  const items = Array.isArray(data) ? data : [];

  const mapped: ResourceItem[] = [];
  for (const item of items) {
    const link =
      typeof item.link === "string" && item.link.trim() ? item.link.trim() : null;
    const href = item.file?.url ? absoluteMediaUrl(item.file.url) : link;
    if (!href) continue;
    mapped.push({
      key: typeof item.key === "string" ? item.key : undefined,
      title: item.title || "",
      href,
      external: true,
    });
  }

  return mapped.length > 0 ? mapped : associationDocuments;
}
