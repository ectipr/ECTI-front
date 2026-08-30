import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
import { fetchAllPages } from "@/lib/strapi-pages";
import { absoluteMediaUrl } from "@/lib/strapi-media";
import { locales } from "@/lib/i18n";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(/\/+$/, "");

export const NEWS_TAGS = [
  "announcements",
  "cfp",
  "academic",
  "training",
  "article",
] as const;

export type NewsTag = (typeof NEWS_TAGS)[number];

// Drop keys the CMS still holds but the front no longer knows (e.g. a tag whose
// enum value was removed), so a stale key renders nothing instead of a blank badge.
function toNewsTags(raw: any): NewsTag[] {
  return (raw ?? [])
    .map((t: any) => t.key)
    .filter((key: any): key is NewsTag => NEWS_TAGS.includes(key));
}

export interface NewsAttachment {
  id: number;
  title: string;
  fileUrl: string | null; // uploaded file URL, or the external link fallback
}

export interface NewsPost {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body: any[];      // Rich text blocks
  date: string;     // ISO date — the (editable) post date, falls back to publishedAt
  eventDate: string | null;    // event start / single day, or null
  eventEndDate: string | null; // event last day when multi-day, else null
  tags: NewsTag[];
  author?: string;
  readTimeMin: number;
  coverImage: string | null; // resolved absolute URL, or null when unset
  attachments: NewsAttachment[]; // downloadable files; only populated on the detail fetch
}

function mapNewsPost(item: any): NewsPost {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title ?? "",
    summary: item.summary ?? "",
    body: item.body ?? [],
    // Prefer the editable published_date (lets migrated posts keep their old-site
    // date); fall back to Strapi's managed publishedAt for pre-existing entries.
    date: item.published_date ?? item.publishedAt ?? item.createdAt ?? item.date ?? "",
    eventDate: item.event_date ?? null,
    eventEndDate: item.event_end_date ?? null,
    tags: toNewsTags(item.tags),
    author: item.author ?? undefined,
    readTimeMin: item.read_time_min ?? 1,
    coverImage: item.cover_image?.url ? absoluteMediaUrl(item.cover_image.url) : null,
    attachments: (item.attachments ?? [])
      .map((att: any) => ({
        id: att.id,
        title: att.title ?? "",
        // Prefer the uploaded file (Strapi media), fall back to an external link.
        fileUrl: att.file?.url
          ? absoluteMediaUrl(att.file.url)
          : (typeof att.link === "string" && att.link.trim() ? att.link.trim() : null),
      }))
      .filter((a: NewsAttachment) => a.fileUrl), // hide rows with neither file nor link
  };
}

// A published post can exist in only some locales (ECTI news is often authored in
// a single language). Fetch one locale's rows; callers merge across locales so a
// post never disappears / 404s just because it wasn't translated.
async function fetchNewsRows(locale: string): Promise<any[]> {
  // Every page, not just the first. The archive is past 70 posts and Strapi
  // hands back 25 unless asked otherwise, so this used to drop most of it
  // while the count on the page still said how many there really were.
  const rows = await fetchAllPages(
    (page, pageSize) =>
      `${BASE_URL}/api/news-posts?populate[tags]=true&populate[cover_image]=true` +
      `&sort=publishedAt:desc&locale=${locale}` +
      `&pagination[page]=${page}&pagination[pageSize]=${pageSize}`,
    { label: `fetchNewsRows(${locale})`, revalidate: CMS_REVALIDATE_SECONDS }
  );

  return rows.filter((item: any) => item.slug); // skip entries with no slug
}

// Same post shares a documentId across locales (and the slug is non-localized too).
function postKey(item: any): string {
  return item.documentId ?? item.slug;
}

export async function getNewsPosts(locale: string): Promise<NewsPost[]> {
  // Prefer the requested locale, then add posts that only exist in another locale.
  const primary = await fetchNewsRows(locale);
  const seen = new Set(primary.map(postKey));

  const otherLocales = locales.filter((l) => l !== locale);
  const fallbackRows = (await Promise.all(otherLocales.map(fetchNewsRows))).flat();

  const merged = [...primary];
  for (const row of fallbackRows) {
    const key = postKey(row);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(row);
    }
  }

  return merged
    .sort(
      (a, b) =>
        new Date(b.published_date ?? b.publishedAt ?? b.createdAt ?? 0).getTime() -
        new Date(a.published_date ?? a.publishedAt ?? a.createdAt ?? 0).getTime()
    )
    .map(mapNewsPost);
}

export async function getNewsPostBySlug(slug: string, locale: string): Promise<NewsPost | undefined> {
  // Try the requested locale first, then fall back to any locale that has the post.
  const tryLocales = [locale, ...locales.filter((l) => l !== locale)];
  for (const loc of tryLocales) {
    try {
      const res = await fetch(
        `${BASE_URL}/api/news-posts?filters[slug][$eq]=${slug}&populate[tags]=true&populate[cover_image]=true&populate[attachments][populate][file]=true&locale=${loc}`,
        { next: { revalidate: CMS_REVALIDATE_SECONDS } }
      );
      if (!res.ok) continue;
      const json = await res.json();
      if (json.data?.length) return mapNewsPost(json.data[0]);
    } catch (err) {
      console.warn(`getNewsPostBySlug(${slug}, ${loc}): API unavailable`, err);
    }
  }
  return undefined;
}

// Human-friendly event date. Single day → "5 มีนาคม 2569"; a multi-day range in
// the same month collapses → "5–8 มีนาคม 2569"; a range spanning months keeps both
// month names → "28 กุมภาพันธ์ – 3 มีนาคม 2569". Dates are read in UTC so a
// date-only value never shifts a day across timezones.
//
// We pull day / month-name / year out with formatToParts and join them ourselves
// instead of using Intl's formatRange: formatRange's separator + spacing come from
// ICU locale data that differs between Node (server) and the browser, which makes
// the SSR HTML disagree with the client render → a React hydration error. The parts
// (a number, a month name) are stable across ICU versions, so composing by hand
// keeps server and client byte-identical.
export function formatEventDate(
  start: string,
  end: string | null | undefined,
  locale: string
): string {
  const loc = locale === "th" ? "th-TH" : "en-US";
  const isTh = locale === "th";
  const DASH = "–";

  const partsOf = (d: Date) => {
    const p = new Intl.DateTimeFormat(loc, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).formatToParts(d);
    const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
    return { day: get("day"), month: get("month"), year: get("year") };
  };
  const one = (p: { day: string; month: string; year: string }) =>
    isTh ? `${p.day} ${p.month} ${p.year}` : `${p.month} ${p.day}, ${p.year}`;

  const startDate = new Date(start);
  const s = partsOf(startDate);
  if (!end) return one(s);

  const endDate = new Date(end);
  if (startDate.getTime() === endDate.getTime()) return one(s);
  const e = partsOf(endDate);

  const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear();
  const sameMonth = sameYear && startDate.getUTCMonth() === endDate.getUTCMonth();

  if (sameMonth) {
    // 5–8 มีนาคม 2569  /  March 5–8, 2026
    return isTh
      ? `${s.day}${DASH}${e.day} ${s.month} ${s.year}`
      : `${s.month} ${s.day}${DASH}${e.day}, ${s.year}`;
  }
  if (sameYear) {
    // 28 กุมภาพันธ์ – 3 มีนาคม 2569  /  February 28 – March 3, 2026
    return isTh
      ? `${s.day} ${s.month} ${DASH} ${e.day} ${e.month} ${s.year}`
      : `${s.month} ${s.day} ${DASH} ${e.month} ${e.day}, ${s.year}`;
  }
  // Different years → spell out both ends fully.
  return `${one(s)} ${DASH} ${one(e)}`;
}

export async function getRelatedPosts(
  currentSlug: string,
  tags: NewsTag[],
  limit = 3,
  locale: string
): Promise<NewsPost[]> {
  const all = await getNewsPosts(locale);
  return all
    .filter((p) => p.slug !== currentSlug && p.tags.some((t) => tags.includes(t)))
    .slice(0, limit);
}
