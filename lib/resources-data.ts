import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(/\/+$/, "");

export type Platform = "YouTube" | "LinkedIn" | "Facebook";

export interface ResourceLink {
  title: string;
  platform: Platform;
  url: string;
  date: string;
  thumbnailUrl?: string;
  summary?: string;
}

async function fetchAPI(endpoint: string) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      next: { revalidate: CMS_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    return json?.data || [];
  } catch (err) {
    return [];
  }
}

export async function fetchResources(locale: string): Promise<ResourceLink[]> {
  const data = await fetchAPI(`/api/resources?locale=${locale}`);
  if (!data || !Array.isArray(data)) return [];

  return data.map((item: any) => {
    let platform: Platform = "YouTube";
    const rawPlatform = item.platform?.toLowerCase();
    if (rawPlatform === "facebook") platform = "Facebook";
    else if (rawPlatform === "linkedin") platform = "LinkedIn";
    else if (rawPlatform === "youtube") platform = "YouTube";

    return {
      title: item.title || "",
      platform,
      url: item.link || "#",
      date: item.date || new Date().toISOString().split("T")[0],
      summary: item.description || "",
    };
  });
}
