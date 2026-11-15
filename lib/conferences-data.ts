import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
import { safeUrl } from "@/lib/safe-url";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(/\/+$/, "");

/** One year a conference ran, and the site for that edition if it still has one. */
export interface ConferenceYear {
  year: string;
  /** Absent when the edition has no site, which is most of the older ones. */
  link?: string;
}

export interface Conference {
  id: number;
  title: string;
  description: string;
  yearLinks: ConferenceYear[];
}

export async function getConferences(locale: string): Promise<Conference[]> {
  try {
    // populate is required: Strapi leaves components out of a response unless
    // they are asked for, so without it year_links comes back undefined and
    // every conference renders with no years at all.
    const res = await fetch(
      `${BASE_URL}/api/conferences?sort=order:asc&locale=${locale}&populate=year_links`,
      { next: { revalidate: CMS_REVALIDATE_SECONDS } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data.map((item: any) => ({
      id: item.id,
      title: item.title ?? "",
      description: item.description ?? "",
      // Order is whatever the editor dragged the rows into, and it is left
      // alone. Sorting here would quietly override a deliberate arrangement —
      // most recent first, say — that the admin makes it possible to express.
      yearLinks: (item.year_links ?? [])
        .filter((row: any) => row?.year)
        .map((row: any) => ({
          year: String(row.year),
          // safeUrl rather than the raw value: the Strapi field carries a
          // pattern, but this is the one place that decides what becomes an
          // href, and lib/safe-url.ts explains why that check belongs here.
          link: safeUrl(row.link),
        })),
    }));
  } catch (err) {
    console.warn("getConferences: API unavailable", err);
    return [];
  }
}
