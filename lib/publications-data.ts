import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(/\/+$/, "");

export interface Journal {
  id: number;
  title: string;
  description: string;
  url: string;
}

export async function getJournals(locale: string): Promise<Journal[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/journals?sort=order:asc&locale=${locale}`,
      { next: { revalidate: CMS_REVALIDATE_SECONDS } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data.map((item: any) => ({
      id: item.id,
      title: item.title ?? "",
      description: item.description ?? "",
      url: item.url ?? "",
    }));
  } catch (err) {
    console.warn("getJournals: API unavailable", err);
    return [];
  }
}
