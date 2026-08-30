import { CMS_REVALIDATE_SECONDS } from "@/lib/cache";
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:1337").replace(/\/+$/, "");

export interface ContactInfo {
  address: string;
  email: string;
  phone: string;
  officeHours: string;
}

export async function getContact(locale: string): Promise<ContactInfo | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/contact?locale=${locale}`, {
      next: { revalidate: CMS_REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data;
    if (!data) return null;
    return {
      address: data.address ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      officeHours: data.office_hours ?? "",
    };
  } catch (error) {
    console.error("Error fetching contact info:", error);
    return null;
  }
}
