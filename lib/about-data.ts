import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(/\/+$/, "");

export interface BoardMember {
  id: number;
  name: string;
  role: string;
  institution: string;
  term: string | null;
  image: { url: string } | null;
}

// Strapi caps pageSize at 100. Board members accumulate per term (~18/term),
// so a single page would silently drop the newest term once the roster passes
// 100 — page through all of them instead.
const BOARD_PAGE_SIZE = 100;

function boardMembersUrl(locale: string, page: number): string {
  return `${BASE_URL}/api/board-members?populate=image&locale=${locale}&sort=id:asc&pagination[pageSize]=${BOARD_PAGE_SIZE}&pagination[page]=${page}`;
}

function mapBoardMember(item: any): BoardMember {
  return {
    id: item.id,
    name: item.name,
    role: item.role,
    institution: item.institution,
    term: item.term ?? null,
    // Local Strapi returns relative media URLs; Strapi Cloud returns absolute ones
    image: item.image
      ? { url: item.image.url.startsWith("http") ? item.image.url : `${BASE_URL}${item.image.url}` }
      : null,
  };
}

export async function getBoardMembers(locale: string): Promise<BoardMember[]> {
  const first = await fetch(boardMembersUrl(locale, 1), { next: { revalidate: CMS_REVALIDATE_SECONDS } });
  if (!first.ok) return [];

  const json = await first.json();
  const items: any[] = [...json.data];

  const pageCount: number = json.meta?.pagination?.pageCount ?? 1;
  if (pageCount > 1) {
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, i) =>
        fetch(boardMembersUrl(locale, i + 2), { next: { revalidate: CMS_REVALIDATE_SECONDS } }).then((res) =>
          res.ok ? res.json().then((j) => j.data as any[]) : []
        )
      )
    );
    for (const page of rest) items.push(...page);
  }

  return items.map(mapBoardMember);
}

export interface Milestone {
  id: number;
  year: string;
  title: string;
  description: string;
}

export async function getMilestones(locale: string): Promise<Milestone[]> {
  const res = await fetch(
    `${BASE_URL}/api/milestones?sort=year:asc&locale=${locale}`,
    { next: { revalidate: CMS_REVALIDATE_SECONDS } }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.data.map((item: any) => ({
    id: item.id,
    year: String(item.year),
    title: item.title,
    description: item.description,
  }));
}

export interface AboutCard {
  id: number;
  title: string;
  description: string;
}

export async function getMissionVisionCards(locale: string): Promise<AboutCard[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/mission-vision?populate=cards&locale=${locale}`,
      { next: { revalidate: CMS_REVALIDATE_SECONDS } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data;
    const cards = data?.cards ?? data?.attributes?.cards ?? [];
    return cards.map((item: any) => ({
      id: item.id,
      title: item.title ?? "",
      description: item.description ?? "",
    }));
  } catch (error) {
    console.error("Error fetching mission-vision cards:", error);
    return [];
  }
}

export interface ObjectiveItem {
  id: number;
  text: string;
}

export async function getObjectives(locale: string): Promise<ObjectiveItem[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/objective?populate=items&locale=${locale}`,
      { next: { revalidate: CMS_REVALIDATE_SECONDS } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data;
    const items = data?.items ?? data?.attributes?.items ?? [];
    return items.map((item: any) => ({
      id: item.id,
      text: item.text ?? "",
    }));
  } catch (error) {
    console.error("Error fetching objectives:", error);
    return [];
  }
}
