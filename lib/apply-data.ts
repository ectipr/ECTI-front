import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(/\/+$/, "");

/**
 * Returns the external membership application form URL (e.g. JotForm) configured
 * in the CMS "Membership — Apply Link" single type, or null when it is not set /
 * unavailable — in which case callers should fall back to the internal route.
 */
export async function getApplyLink(locale: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/membership-apply?locale=${locale}`, {
      next: { revalidate: CMS_REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const url = json?.data?.form_url;
    if (typeof url !== "string") return null;
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  } catch (error) {
    console.error("Error fetching membership apply link:", error);
    return null;
  }
}
