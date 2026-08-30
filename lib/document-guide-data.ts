import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
/**
 * "วิธีใช้" content for Resources → เอกสารของสมาคม — the reimbursement / loan
 * cases and the receipt & mailing info box, migrated from the legacy page
 * https://ecti-thailand.org/แบบฟอร์มการเบิกจ่ายเงิน/ (that site is being retired).
 *
 * Reads the Strapi `guide-case` collection + `document-guide` single type, and
 * falls back to the constants below until an editor fills them in — same
 * pattern as lib/documents-data.ts.
 *
 * A step links to a form by `documentKey`, which is matched against the
 * association-document `key` (see lib/resource-detail-data.ts). That keeps the
 * href in one place: upload the PDF in Strapi once and every step follows.
 */

import type { Locale } from "@/lib/i18n";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(
  /\/+$/,
  ""
);

export type GuideGroup = "reimbursement" | "loan";

export interface GuideStep {
  /** What the member has to attach */
  text: string;
  /** Matches an association-document `key` → renders the step as a download link */
  documentKey?: string;
  /** Small clarifying line under the step */
  note?: string;
}

export interface GuideCase {
  group: GuideGroup;
  order: number;
  title: string;
  subtitle?: string;
  steps: GuideStep[];
}

export interface GuideInfo {
  receiptName?: string;
  receiptAddress?: string;
  taxId?: string;
  mailingName?: string;
  mailingAddress?: string;
  phone?: string;
}

export interface DocumentGuide {
  cases: GuideCase[];
  info: GuideInfo;
}

/* ------------------------------------------------------------------ */
/* Fallback content (verbatim from the legacy page)                     */
/* ------------------------------------------------------------------ */

const fallbackTh: DocumentGuide = {
  cases: [
    {
      group: "reimbursement",
      order: 1,
      title: "กรณีที่ 1 การเบิกจ่ายเงินที่มีใบเสร็จรับเงินสมบูรณ์",
      steps: [
        { text: "แบบฟอร์มการเบิกเงิน", documentKey: "reimbursement-form" },
        {
          text: "ใบเสร็จรับเงินที่ระบุชื่อและที่อยู่สมาคมถูกต้อง",
          note: "ดูชื่อที่อยู่ในการออกใบเสร็จด้านล่าง",
        },
      ],
    },
    {
      group: "reimbursement",
      order: 2,
      title:
        "กรณีที่ 2 การเบิกจ่ายเงินที่มีใบเสร็จรับเงินไม่มีชื่อที่อยู่สมาคม หรือระบุไม่ถูกต้อง",
      subtitle:
        "หากใบเสร็จไม่มีชื่อที่อยู่สมาคม หรือระบุไม่ถูกต้อง สามารถใช้ใบแทนใบเสร็จควบคู่กับใบเสร็จที่ไม่สมบูรณ์ได้",
      steps: [
        { text: "แบบฟอร์มการเบิกเงิน", documentKey: "reimbursement-form" },
        { text: "ใบรับรองแทนใบเสร็จรับเงิน", documentKey: "receipt-substitute" },
        { text: "ใบเสร็จรับเงินที่ไม่มีชื่อที่อยู่สมาคม หรือระบุไม่ถูกต้อง" },
      ],
    },
    {
      group: "reimbursement",
      order: 3,
      title: "กรณีที่ 3 ไม่มีใบเสร็จรับเงิน",
      subtitle:
        "ในกรณีไม่มีใบเสร็จรับเงิน สามารถใช้ใบสำคัญรับเงินแทนใบเสร็จรับเงินได้ โดยแนบบัตรประชาชนหรือบัตรข้าราชการ",
      steps: [
        { text: "แบบฟอร์มการเบิกเงิน", documentKey: "reimbursement-form" },
        { text: "ใบสำคัญรับเงิน", documentKey: "payment-voucher" },
        {
          text: "สำเนาบัตรประชาชนหรือบัตรข้าราชการ",
          note: "ในกรณีเป็นนักศึกษาให้ใช้บัตรนักศึกษาได้",
        },
      ],
    },
    {
      group: "loan",
      order: 4,
      title: "การยืมเงินสมาคม",
      steps: [
        { text: "แบบฟอร์มการเบิกเงิน", documentKey: "reimbursement-form" },
        { text: "ใบยืมเงิน", documentKey: "loan-voucher" },
        { text: "สำเนาบัญชีธนาคารที่ใช้รับเงิน" },
        { text: "สำเนาบัตรประชาชน" },
      ],
    },
  ],
  info: {
    receiptName:
      "สมาคมวิชาการไฟฟ้าอิเล็กทรอนิกส์ คอมพิวเตอร์โทรคมนาคม และสารสนเทศ",
    receiptAddress:
      "เดอะแพลนท์ ซิตี้ เลขที่ 92/67 หมู่ 5 ต.บ้านใหม่ อ.ปากเกร็ด จ.นนทบุรี 11120",
    taxId: "0993000130952",
    mailingName: "อดิเทพ ยอดเงิน",
    mailingAddress:
      "8/154 หมู่บ้านบุณฑรีก์ ต.คลองสอง อ.คลองหลวง จ.ปทุมธานี 12120",
    phone: "0972040717",
  },
};

const fallbackEn: DocumentGuide = {
  cases: [
    {
      group: "reimbursement",
      order: 1,
      title: "Case 1 — Reimbursement with a complete receipt",
      steps: [
        { text: "Reimbursement form", documentKey: "reimbursement-form" },
        {
          text: "A receipt showing the association's correct name and address",
          note: "See the billing name and address below",
        },
      ],
    },
    {
      group: "reimbursement",
      order: 2,
      title:
        "Case 2 — Reimbursement with a receipt missing or misstating the association's name and address",
      subtitle:
        "If the receipt is missing the association's name and address, or states them incorrectly, attach the receipt substitute certificate alongside the incomplete receipt.",
      steps: [
        { text: "Reimbursement form", documentKey: "reimbursement-form" },
        {
          text: "Receipt substitute certificate",
          documentKey: "receipt-substitute",
        },
        {
          text: "The receipt missing or misstating the association's name and address",
        },
      ],
    },
    {
      group: "reimbursement",
      order: 3,
      title: "Case 3 — No receipt at all",
      subtitle:
        "With no receipt, a payment voucher can be used instead, attached to a copy of your ID card or government employee card.",
      steps: [
        { text: "Reimbursement form", documentKey: "reimbursement-form" },
        { text: "Payment voucher", documentKey: "payment-voucher" },
        {
          text: "Copy of your ID card or government employee card",
          note: "Students may use their student card",
        },
      ],
    },
    {
      group: "loan",
      order: 4,
      title: "Borrowing from the association",
      steps: [
        { text: "Reimbursement form", documentKey: "reimbursement-form" },
        { text: "Loan voucher", documentKey: "loan-voucher" },
        { text: "Copy of the bank account receiving the money" },
        { text: "Copy of your ID card" },
      ],
    },
  ],
  info: {
    receiptName:
      "Electrical Engineering/Electronics, Computer, Telecommunications and Information Technology Association (ECTI)",
    receiptAddress:
      "The Plant City, 92/67 Moo 5, Ban Mai, Pak Kret, Nonthaburi 11120",
    taxId: "0993000130952",
    mailingName: "Aditep Yodngern",
    mailingAddress:
      "8/154 Boonthareek Village, Khlong Song, Khlong Luang, Pathum Thani 12120",
    phone: "0972040717",
  },
};

export const documentGuideFallback: Record<Locale, DocumentGuide> = {
  th: fallbackTh,
  en: fallbackEn,
};

/* ------------------------------------------------------------------ */
/* Strapi                                                              */
/* ------------------------------------------------------------------ */

async function fetchAPI(endpoint: string) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { next: { revalidate: CMS_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

function mapCase(item: Record<string, unknown>): GuideCase | null {
  const title = typeof item.title === "string" ? item.title.trim() : "";
  if (!title) return null;

  const rawSteps = Array.isArray(item.steps) ? item.steps : [];
  const steps: GuideStep[] = [];
  for (const step of rawSteps as Record<string, unknown>[]) {
    const text = typeof step?.text === "string" ? step.text.trim() : "";
    if (!text) continue;
    steps.push({
      text,
      documentKey:
        typeof step.documentKey === "string" && step.documentKey.trim()
          ? step.documentKey.trim()
          : undefined,
      note:
        typeof step.note === "string" && step.note.trim()
          ? step.note.trim()
          : undefined,
    });
  }

  return {
    group: item.group === "loan" ? "loan" : "reimbursement",
    order: typeof item.order === "number" ? item.order : 0,
    title,
    subtitle:
      typeof item.subtitle === "string" && item.subtitle.trim()
        ? item.subtitle.trim()
        : undefined,
    steps,
  };
}

function mapInfo(data: Record<string, unknown> | null): GuideInfo | null {
  if (!data) return null;
  const pick = (field: string) => {
    const value = data[field];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  const info: GuideInfo = {
    receiptName: pick("receiptName"),
    receiptAddress: pick("receiptAddress"),
    taxId: pick("taxId"),
    mailingName: pick("mailingName"),
    mailingAddress: pick("mailingAddress"),
    phone: pick("phone"),
  };
  return Object.values(info).some(Boolean) ? info : null;
}

/**
 * Cases and info box for the Documents page. Each half falls back on its own,
 * so a half-filled CMS still renders a complete page.
 */
export async function getDocumentGuide(locale: string): Promise<DocumentGuide> {
  const fallback = documentGuideFallback[locale === "en" ? "en" : "th"];

  const [casesData, infoData] = await Promise.all([
    fetchAPI(
      `/api/guide-cases?populate=*&sort=order:asc&locale=${locale}&pagination[pageSize]=50`
    ),
    fetchAPI(`/api/document-guide?locale=${locale}`),
  ]);

  const cases = (Array.isArray(casesData) ? casesData : [])
    .map((item) => mapCase(item as Record<string, unknown>))
    .filter((item): item is GuideCase => item !== null && item.steps.length > 0)
    .sort((a, b) => a.order - b.order);

  return {
    cases: cases.length > 0 ? cases : fallback.cases,
    info: mapInfo(infoData as Record<string, unknown> | null) ?? fallback.info,
  };
}
