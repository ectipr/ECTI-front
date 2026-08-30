import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(/\/+$/, "");

export interface SocialLinks {
  facebook: string | null;
  x: string | null;
  linkedin: string | null;
  youtube: string | null;
}

const EMPTY: SocialLinks = { facebook: null, x: null, linkedin: null, youtube: null };

function clean(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/**
 * Reads the social media profile URLs from the CMS "Social Links" single type.
 * Any field that is unset/invalid comes back as null so the footer can hide that
 * icon; on error every field is null (footer simply shows no social icons).
 */
export async function getSocialLinks(locale: string): Promise<SocialLinks> {
  try {
    const res = await fetch(`${BASE_URL}/api/social-link?locale=${locale}`, {
      next: { revalidate: CMS_REVALIDATE_SECONDS },
    });
    if (!res.ok) return EMPTY;
    const json = await res.json();
    const d = json?.data;
    if (!d) return EMPTY;
    return {
      facebook: clean(d.facebook_url),
      x: clean(d.x_url),
      linkedin: clean(d.linkedin_url),
      youtube: clean(d.youtube_url),
    };
  } catch (error) {
    console.error("Error fetching social links:", error);
    return EMPTY;
  }
}
