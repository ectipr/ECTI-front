import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
export type EventStatus = "open" | "register" | "upcoming" | "finished";
export type EventType = "conference" | "workshop" | "seminar";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(/\/+$/, "");
const API_URL = `${BASE_URL}/api/activities`;

export interface EventDeadline {
  label: string;
  date: string;
}

export interface EventTrack {
  name: string;
}

export interface EventButton {
  url: string;
  type: string;
}

export interface ECTIEvent {
  slug: string;
  title: string;
  date: string;
  location: string;
  description: string;
  overview: string;
  status: EventStatus;
  type: EventType;
  year: string;
  deadlines: EventDeadline[];
  tracks: EventTrack[];
  topics: string[];
  organizer: string;
  register_url: string;
}

//fetch by slug
export async function fetchEventBySlug(slug: string, locale: string) {
  let json: any;
  try {
    const res = await fetch(
      `${API_URL}?populate=*&filters[slug][$eq]=${slug}&locale=${locale}`,
      { next: { revalidate: CMS_REVALIDATE_SECONDS } }
    );
    if (!res.ok) return null;
    json = await res.json();
  } catch (err) {
    console.warn(`fetchEventBySlug(${slug}): API unavailable, using fallback`, err);
    return null;
  }

  if (!json || !Array.isArray(json.data) || json.data.length === 0) {
    return null;
  }

  const item = json.data[0];
  const attr = item;

  return {
    slug: attr.slug ?? item.id.toString(),
    title: attr.title,
    date: formatDateRange(attr.event_start_date, attr.event_end_date, locale),
    location: attr.location ?? "",
    description: attr.description?.[0]?.children?.[0]?.text || "",
    overview: "",
    status: attr.event_status,
    type: attr.type,
    year: attr.year,
    deadlines:
      attr.deadline?.map((d: any) => ({
        label: d.title,
        date: formatDate(d.date, locale),
      })) || [],
    tracks: [],
    topics: [],
    organizer: "",
    register_url: attr.register_url || "",
  } as ECTIEvent;
}

// func fetch
// Ordered newest-first here rather than in the client: EventsListClient re-sorts
// by status with a stable sort, so this date order survives within each status group.
export async function fetchEventsFromAPI(locale: string): Promise<ECTIEvent[]> {
  let json: any;
  try {
    const res = await fetch(
      `${API_URL}?populate=*&sort=event_start_date:desc&locale=${locale}`,
      { next: { revalidate: CMS_REVALIDATE_SECONDS } }
    );
    if (!res.ok) return [];
    json = await res.json();
  } catch (err) {
    console.warn("fetchEventsFromAPI: API unavailable", err);
    return [];
  }

  if (!json || !Array.isArray(json.data)) {
    console.warn("fetchEventsFromAPI: Invalid data received", json);
    return [];
  }

  return json.data.map((item: any) => {
    const attr = item;

    return {
      slug: attr.slug ?? item.id.toString(),
      title: attr.title,
      date: formatDateRange(attr.event_start_date, attr.event_end_date, locale),
      location: attr.location ?? "",
      description: attr.description?.[0]?.children?.[0]?.text || "",
      overview: "",
      status: attr.event_status,
      type: attr.type,
      year: attr.year,
      deadlines:
        attr.deadline?.map((d: any) => ({
          label: d.title,
          date: formatDate(d.date, locale),
        })) || [],
      tracks: [],
      topics: [],
      organizer: "",
      register_url: attr.register_url || "",
    } as ECTIEvent;
  });
}

function formatDate(date: string, locale: string) {
  if (!date) return "";
  return new Date(date).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateRange(start: string, end: string, locale: string) {
  if (!start) return "";
  const startStr = formatDate(start, locale);
  if (!end || end === start) return startStr;
  return `${startStr} – ${formatDate(end, locale)}`;
}

export interface FeaturedEvent {
  slug: string;
  title: string;
  description: string;
  location: string;
  dateLabel: string;
  deadlines: EventDeadline[];
  registerUrl: string;
}

// Featured events for the homepage "กิจกรรมเด่น" section: the latest activities,
// ordered by most recent event_start_date. Returns an empty array when no
// activity exists or the API is unreachable, so the section can hide itself.
export async function getFeaturedEvents(
  locale: string,
  limit = 5
): Promise<FeaturedEvent[]> {
  let json: any;
  try {
    const res = await fetch(
      `${API_URL}?populate=*&sort=event_start_date:desc&pagination[limit]=${limit}&locale=${locale}`,
      { next: { revalidate: CMS_REVALIDATE_SECONDS } }
    );
    if (!res.ok) return [];
    json = await res.json();
  } catch (err) {
    console.warn("getFeaturedEvents: API unavailable", err);
    return [];
  }
  if (!Array.isArray(json?.data)) return [];

  return json.data.map((item: any) => ({
    slug: item.slug ?? String(item.id),
    title: item.title ?? "",
    description: item.description?.[0]?.children?.[0]?.text ?? "",
    location: item.location ?? "",
    dateLabel: formatDateRange(item.event_start_date, item.event_end_date, locale),
    deadlines:
      item.deadline?.map((d: any) => ({
        label: d.title,
        date: formatDate(d.date, locale),
      })) ?? [],
    registerUrl: item.register_url ?? "",
  }));
}


export const events: ECTIEvent[] = [
  {
    slug: "ecti-con-2026",
    title: "ECTI-CON 2026",
    date: "9-12 กรกฎาคม 2569",
    location: "โรงแรมเลอ เมอริเดียน เชียงใหม่",
    description:
      "การประชุมวิชาการนานาชาติด้านวิศวกรรมไฟฟ้า/อิเล็กทรอนิกส์ คอมพิวเตอร์ โทรคมนาคม และสารสนเทศ ครั้งที่ 23",
    overview:
      "ECTI-CON 2026 เป็นการประชุมวิชาการนานาชาติประจำปีที่จัดโดยสมาคม ECTI เปิดรับบทความวิจัยคุณภาพสูงในสาขาวิศวกรรมไฟฟ้า อิเล็กทรอนิกส์ คอมพิวเตอร์ โทรคมนาคม และสารสนเทศ โดยบทความที่ได้รับคัดเลือกจะถูกตีพิมพ์ใน IEEE Xplore และวารสาร ECTI Transactions",
    status: "open",
    type: "conference",
    year: "2026",
    deadlines: [
      {
        label: "กำหนดส่งบทความ",
        date: "30 เมษายน 2569",
      },
      {
        label: "แจ้งผลพิจารณา",
        date: "31 พฤษภาคม 2569",
      },
      {
        label: "ส่งฉบับสมบูรณ์",
        date: "15 มิถุนายน 2569",
      },
      {
        label: "ลงทะเบียนล่วงหน้า",
        date: "20 มิถุนายน 2569",
      },
    ],
    tracks: [
      { name: "วิศวกรรมไฟฟ้าและอิเล็กทรอนิกส์" },
      { name: "วิทยาการคอมพิวเตอร์และ AI" },
      { name: "โทรคมนาคมและเครือข่าย" },
      { name: "เทคโนโลยีสารสนเทศ" },
      { name: "การประมวลผลสัญญาณ" },
    ],
    topics: [
      "Artificial Intelligence & Machine Learning",
      "6G Communications",
      "Quantum Computing",
      "IoT & Embedded Systems",
      "Cybersecurity",
      "Robotics & Automation",
      "Image & Video Processing",
      "VLSI & Circuit Design",
    ],
    organizer: "ECTI Association & Chiang Mai University",
    register_url: "",
  },
  {
    slug: "ecti-card-2026",
    title: "ECTI-CARD 2026",
    date: "8-10 พฤษภาคม 2569",
    location: "มหาวิทยาลัยเชียงใหม่",
    description:
      "การประชุมวิชาการ ECTI Conference on Application Research and Development ครั้งที่ 5",
    overview:
      "ECTI-CARD 2026 เป็นเวทีสำหรับนำเสนอผลงานวิจัยประยุกต์และการพัฒนาเทคโนโลยีในสาขาที่เกี่ยวข้อง เน้นการเชื่อมโยงผลงานวิจัยสู่การใช้งานจริง",
    status: "register",
    type: "conference",
    year: "2026",
    deadlines: [
      {
        label: "กำหนดส่งบทความ",
        date: "15 มีนาคม 2569",
      },
      {
        label: "แจ้งผลพิจารณา",
        date: "10 เมษายน 2569",
      },
      {
        label: "ลงทะเบียน",
        date: "25 เมษายน 2569",
      },
    ],
    tracks: [
      { name: "ระบบฝังตัวและ IoT" },
      { name: "การประยุกต์ AI" },
      { name: "เทคโนโลยีพลังงาน" },
    ],
    topics: [
      "Smart Agriculture",
      "Healthcare Technology",
      "Smart City Applications",
      "Renewable Energy Systems",
      "Industrial IoT",
    ],
    organizer: "ECTI Association & Chiang Mai University",
    register_url: "",
  },
  {
    slug: "ai-iot-workshop-2026",
    title: "AI/IoT Workshop 2026",
    date: "15 มีนาคม 2569",
    location: "จุฬาลงกรณ์มหาวิทยาลัย กรุงเทพฯ",
    description:
      "สัมมนาเชิงปฏิบัติการเกี่ยวกับปัญญาประดิษฐ์และอินเทอร์เน็ตในทุกสิ่ง สำหรับสมาชิกสมาคม",
    overview:
      "สัมมนาเชิงปฏิบัติการ 1 วัน ครอบคลุมพื้นฐาน AI/ML, การใช้ TensorFlow และ PyTorch, การพัฒนาระบบ IoT ด้วย ESP32 และ Raspberry Pi พร้อมโปรเจกต์จริง",
    status: "finished",
    type: "workshop",
    year: "2026",
    deadlines: [
      {
        label: "ลงทะเบียน",
        date: "1 มีนาคม 2569",
      },
    ],
    tracks: [
      { name: "ปัญญาประดิษฐ์" },
      { name: "อินเทอร์เน็ตในทุกสิ่ง" },
    ],
    topics: [
      "Deep Learning",
      "Edge AI",
      "Sensor Networks",
      "Smart Home",
    ],
    organizer: "ECTI Association & Chulalongkorn University",
    register_url: "",
  },
  {
    slug: "ecti-con-2025",
    title: "ECTI-CON 2025",
    date: "25-28 มิถุนายน 2568",
    location: "โรงแรมอมารี วอเตอร์เกท กรุงเทพฯ",
    description:
      "การประชุมวิชาการนานาชาติ ECTI ครั้งที่ 22 ณ กรุงเทพมหานคร",
    overview:
      "ECTI-CON 2025 ประสบความสำเร็จด้วยผู้เข้าร่วมกว่า 500 คนจาก 15 ประเทศ มีการนำเสนอบทความวิจัยกว่า 200 บทความ",
    status: "finished",
    type: "conference",
    year: "2025",
    deadlines: [],
    tracks: [
      { name: "วิศวกรรมไฟฟ้า" },
      { name: "วิทยาการคอมพิวเตอร์" },
      { name: "โทรคมนาคม" },
      { name: "เทคโนโลยีสารสนเทศ" },
    ],
    topics: [
      "5G/6G Communications",
      "AI & Deep Learning",
      "Blockchain",
      "Cloud Computing",
      "Edge Computing",
    ],
    organizer: "ECTI Association & KMUTNB",
    register_url: "",
  },
  {
    slug: "quantum-computing-seminar-2025",
    title: "Quantum Computing Seminar",
    date: "10 ตุลาคม 2568",
    location: "มหาวิทยาลัยเกษตรศาสตร์ กรุงเทพฯ",
    description:
      "สัมมนาพิเศษเรื่องการประมวลผลควอนตัมและผลกระทบต่อวงการวิศวกรรม",
    overview:
      "สัมมนาครึ่งวันโดยผู้เชี่ยวชาญด้านการประมวลผลควอนตัมจากมหาวิทยาลัยชั้นนำ ครอบคลุมทฤษฎีพื้นฐาน, อัลกอริทึมควอนตัม, และการประยุกต์ใช้งานจริง",
    status: "finished",
    type: "seminar",
    year: "2025",
    deadlines: [],
    tracks: [
      { name: "การประมวลผลควอนตัม" },
    ],
    topics: [
      "Quantum Algorithms",
      "Quantum Error Correction",
      "Quantum Machine Learning",
    ],
    organizer: "ECTI Association & Kasetsart University",
    register_url: "",
  },
  {
    slug: "ecti-dacon-2026",
    title: "ECTI-DACON 2026",
    date: "20-22 สิงหาคม 2569",
    location: "มหาวิทยาลัยสงขลานครินทร์ หาดใหญ่",
    description:
      "การประชุมวิชาการด้านวิทยาการข้อมูลและการสื่อสาร ครั้งที่ 3",
    overview:
      "ECTI-DACON 2026 เป็นเวทีการประชุมวิชาการที่เน้นงานวิจัยด้านวิทยาการข้อมูล การเรียนรู้ของเครื่อง และระบบสื่อสารสมัยใหม่",
    status: "upcoming",
    type: "conference",
    year: "2026",
    deadlines: [
      {
        label: "กำหนดส่งบทความ",
        date: "1 มิถุนายน 2569",
      },
      {
        label: "แจ้งผลพิจารณา",
        date: "15 กรกฎาคม 2569",
      },
      {
        label: "ลงทะเบียนล่วงหน้า",
        date: "1 สิงหาคม 2569",
      },
    ],
    tracks: [
      { name: "วิทยาการข้อมูล" },
      { name: "การเรียนรู้ของเครื่อง" },
      { name: "ระบบสื่อสาร" },
    ],
    topics: [
      "Big Data Analytics",
      "Natural Language Processing",
      "Computer Vision",
      "Wireless Communications",
      "Network Security",
    ],
    organizer: "ECTI Association & Prince of Songkla University",
    register_url: "",
  },
];

export function getEventBySlug(slug: string): ECTIEvent | undefined {
  return events.find((e) => e.slug === slug);
}

export function getUniqueYears(): string[] {
  return [...new Set(events.map((e) => String(e.year)))].sort((a, b) => Number(b) - Number(a));
}

export function getUniqueLocations(): string[] {
  return [...new Set(events.map((e) => e.location))].sort();
}
