import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
import { absoluteMediaUrl } from "@/lib/strapi-media";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(/\/+$/, "");

export interface Benefit {
  id: number;
  description: string;
}

export interface HowtoJoin {
  id: number;
  title: string;
  description: string;
  order: number;
  iconUrl: string | null;
}

export interface MemberType {
  id: number;
  key: string | null;
  type: string;
  eligibility: string;
  membership_fee: number | null;
  entrance_fee: number | null;
  iconUrl: string | null;
}

export interface Question {
  id: number;
  question: string;
  answer: string;
}

export interface MembershipPayment {
  bank_name: string;
  bank_branch: string;
  account_name: string;
  account_number: string;
  swift_code: string;
  payment_email: string;
  online_portal_url: string;
  note: string;
}

export interface MembershipCredit {
  title: string;
  description: string;
}

export interface MembershipDocument {
  id: number;
  key: string | null;
  title: string;
  order: number;
  fileUrl: string | null;
}

// Fetch helper
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

export async function fetchBenefits(locale: string): Promise<Benefit[]> {
  const data = await fetchAPI(`/api/benefits?locale=${locale}`);
  if (!data || !Array.isArray(data)) return [];
  return data.map((item: any) => ({
    id: item.id,
    description: item.description || "",
  }));
}

export async function fetchHowToJoins(locale: string): Promise<HowtoJoin[]> {
  const data = await fetchAPI(`/api/howto-joins?populate=*&locale=${locale}`);
  if (!data || !Array.isArray(data)) return [];
  return data
    .map((item: any) => ({
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      order: item.order ?? 0,
      iconUrl: item.icon?.url ? absoluteMediaUrl(item.icon.url) : null,
    }))
    .sort((a: HowtoJoin, b: HowtoJoin) => a.order - b.order);
}

export async function fetchMemberTypes(locale: string): Promise<MemberType[]> {
  const data = await fetchAPI(`/api/member-types?populate=*&locale=${locale}`);
  if (!data || !Array.isArray(data)) return [];
  return data.map((item: any) => ({
    id: item.id,
    key: item.key ?? null,
    type: item.type || "",
    eligibility: item.eligibility || "",
    membership_fee: item.membership_fee ?? null,
    entrance_fee: item.entrance_fee ?? null,
    iconUrl: item.icon?.url ? absoluteMediaUrl(item.icon.url) : null,
  }));
}

export async function fetchQuestions(locale: string): Promise<Question[]> {
  const data = await fetchAPI(`/api/questions?locale=${locale}`);
  if (!data || !Array.isArray(data)) return [];
  return data.map((item: any) => ({
    id: item.id,
    question: item.question || "",
    answer: item.answer || "",
  }));
}

export async function fetchMembershipPayment(locale: string): Promise<MembershipPayment | null> {
  const data = await fetchAPI(`/api/membership-payment?locale=${locale}`);
  if (!data || Array.isArray(data)) return null;
  const payment: MembershipPayment = {
    bank_name: data.bank_name || "",
    bank_branch: data.bank_branch || "",
    account_name: data.account_name || "",
    account_number: data.account_number || "",
    swift_code: data.swift_code || "",
    payment_email: data.payment_email || "",
    online_portal_url: data.online_portal_url || "",
    note: data.note || "",
  };
  // Hide the whole block when an editor created the entry but left it empty.
  const hasContent = Object.values(payment).some((v) => v.trim() !== "");
  return hasContent ? payment : null;
}

export async function fetchMembershipCredit(locale: string): Promise<MembershipCredit | null> {
  const data = await fetchAPI(`/api/membership-credit?locale=${locale}`);
  if (!data || Array.isArray(data) || !data.title) return null;
  return {
    title: data.title || "",
    description: data.description || "",
  };
}

export async function fetchMembershipDocuments(locale: string): Promise<MembershipDocument[]> {
  const data = await fetchAPI(`/api/membership-documents?populate=*&sort=order:asc&locale=${locale}`);
  if (!data || !Array.isArray(data)) return [];
  return data
    .map((item: any) => {
      const link = typeof item.link === "string" && item.link.trim() ? item.link.trim() : null;
      return {
        id: item.id,
        key: item.key ?? null,
        title: item.title || "",
        order: item.order ?? 0,
        fileUrl: item.file?.url ? absoluteMediaUrl(item.file.url) : link,
      };
    })
    .filter((d: MembershipDocument) => d.fileUrl) // hide rows without a file/link
    .sort((a: MembershipDocument, b: MembershipDocument) => a.order - b.order);
}
