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

/**
 * Where each committee position sits in the order the association lists them.
 *
 * There is no order field on the content type and the API can only sort by id,
 * which is the order rows happened to be created in — so the newest member is
 * always last, whatever their position. The position text is the only thing
 * left to order by, and it is written consistently: seven terms, 277 members
 * per locale, all drawing on this one set of titles.
 *
 * Matched top to bottom, first hit wins, so the specific patterns have to sit
 * above the general ones they are contained in:
 *
 *   "อุปนายก" contains "นายก"                     → vice president before president
 *   "ที่ปรึกษานายกสมาคม" contains "นายกสมาคม"        → advisor before president
 *   "Vice President" contains "President"          → same in English
 *   "กรรมการสายวิชาการ" contains "กรรมการ"          → technical chair before board member
 *   "ECTI Board Committee (Secretary)" contains both → secretary before board member
 *
 * Get that order wrong and the vice president is filed as the president, which
 * is the one mistake on this page nobody would fail to notice.
 */
const ROLE_ORDER: ReadonlyArray<{ rank: number; match: RegExp }> = [
  // Two separate things are going on here, and conflating them is how this
  // table goes wrong:
  //
  //   `rank`  = where the position is printed on the page.
  //   Position in this array = the order the patterns are TRIED, first hit wins.
  //
  // They differ because several titles contain each other. An advisor is
  // printed last but has to be recognised first, or "ที่ปรึกษานายกสมาคม" is read
  // as "นายกสมาคม" and the advisor is announced as the president:
  //
  //   "ที่ปรึกษานายกสมาคม" contains "นายกสมาคม"
  //   "Advisory Board for ECTI President" contains "President"
  //   "อุปนายก" contains "นายก" · "Vice President" contains "President"
  //   "กรรมการสายภูมิภาค" and "กรรมการพิเศษ" both contain "กรรมการ"
  //   "ECTI Board Committee (Secretary)" contains "Board Committee"
  { rank: 130, match: /ที่ปรึกษา|advisor/i },
  { rank: 20, match: /อุปนายก|vice\s*president/i },
  { rank: 10, match: /นายกสมาคม|^นายก|president/i },

  // Both spellings of เลขา are in the data: 2020-2021 says เลขานุการ where every
  // other term says เลขาธิการ, and English calls both Secretary.
  { rank: 30, match: /เลขาธิการ|เลขานุการ|secretary/i },
  { rank: 40, match: /เหรัญญิก|treasurer/i },
  { rank: 50, match: /นายทะเบียน|registrar/i },
  { rank: 60, match: /ประชาสัมพันธ์|public relations/i },

  // ปฎิคม (ฎ) is a misspelling of ปฏิคม (ฏ) that four terms carry. Matching both
  // beats asking anyone to hunt for it across 554 rows.
  { rank: 70, match: /ปฏิคม|ปฎิคม|อุตสาหกรรมสัมพันธ์|industry relations|receptionist/i },

  // Regional before subject chairs, because "กรรมการสายภูมิภาค" would otherwise
  // be caught by the looser "กรรมการสาย" below — which is itself loose on
  // purpose, since 2018-2019 has a chair written "กรรมการสาย Bio-Medical
  // Engineering" with no "วิชาการ" in it.
  { rank: 100, match: /กรรมการสายภูมิภาค|regional chair/i },
  { rank: 90, match: /กรรมการสาย|technical chair/i },
  { rank: 110, match: /กรรมการพิเศษ|special board/i },

  // Ordinary committee members print before the chairs above, which is the
  // order the association used in every term that was entered consistently.
  // Bare "กรรมการ" lands here too — it is what 2006-2007 called the same role
  // that its English side calls "ECTI Board Committee".
  { rank: 80, match: /กรรมการกลาง|กรรมการอำนวยการ|กรรมการ|board member|board committee/i },
];

/** Positions nobody listed above; they sort last rather than disappear. */
const UNKNOWN_ROLE_RANK = 999;

/** Warned-about roles, so an unknown title is reported once and not per render. */
const warnedRoles = new Set<string>();

function roleRank(role: string): number {
  const text = (role ?? "").trim();
  if (!text) return UNKNOWN_ROLE_RANK;

  for (const { rank, match } of ROLE_ORDER) {
    if (match.test(text)) return rank;
  }

  if (!warnedRoles.has(text)) {
    warnedRoles.add(text);
    console.warn(
      `Board member role "${text}" matches no known position, so they are listed last. ` +
        "Add a pattern to ROLE_ORDER in lib/about-data.ts if this position is here to stay."
    );
  }
  return UNKNOWN_ROLE_RANK;
}

/**
 * The "1" in "อุปนายกคนที่ 1" / "Vice President 2", for ordering two people who
 * hold the same position. Anchored to the end so that a number inside the title
 * itself is not mistaken for a rank.
 */
function roleSuffix(role: string): number {
  const digits = /(\d+)\s*$/.exec(role ?? "");
  return digits ? Number(digits[1]) : 0;
}

/**
 * Newest term first, then down the committee, then — for two people holding the
 * same position — the order they were added, which is the only signal the CMS
 * has left to offer and at least never changes on its own.
 */
function compareBoardMembers(a: BoardMember, b: BoardMember): number {
  const term = (b.term ?? "").localeCompare(a.term ?? "");
  if (term !== 0) return term;

  const rank = roleRank(a.role) - roleRank(b.role);
  if (rank !== 0) return rank;

  const suffix = roleSuffix(a.role) - roleSuffix(b.role);
  if (suffix !== 0) return suffix;

  return a.id - b.id;
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
  try {
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

    return items.map(mapBoardMember).sort(compareBoardMembers);
  } catch (error) {
    console.error("Error fetching board members:", error);
    return [];
  }
}

export interface Milestone {
  id: number;
  year: string;
  title: string;
  description: string;
}

export async function getMilestones(locale: string): Promise<Milestone[]> {
  try {
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
  } catch (error) {
    console.error("Error fetching milestones:", error);
    return [];
  }
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
