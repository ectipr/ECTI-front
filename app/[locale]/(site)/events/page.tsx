import { getDictionary, isValidLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EventsListClient } from "@/components/events-list-client";
import { fetchEventsFromAPI } from "@/lib/events-data";

// No `dynamic = "force-dynamic"` here on purpose. It was added in March, when
// editing the CMS left the site showing old data and opting out of caching was
// the quickest way to make it move. The webhook in June fixed that properly —
// Strapi now calls /api/revalidate on publish — so the opt-out only cost us a
// serverless render per visitor for a page every visitor sees identically.
//
// Nothing on this page varies per request: `event_status` is a field the editor
// sets in Strapi rather than something derived from today's date, and the
// year/location filtering all happens in EventsListClient. So it renders once
// and is served as a file until an editor changes something.
//
// If events stop updating after a publish, the webhook is what to check.
// Putting force-dynamic back would hide that, not fix it.

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};
  const dict = getDictionary(locale as Locale);
  return {
    title: dict.events.title,
    description: dict.events.description,
    openGraph: {
      title: dict.events.title,
      description: dict.events.description,
      locale: locale === "th" ? "th_TH" : "en_US",
    },
    alternates: { languages: { th: "/th/events", en: "/en/events" } },
  };
}

export default async function EventsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const dict = getDictionary(locale as Locale);

  const events = await fetchEventsFromAPI(locale);

  const years = [...new Set(events.map(e => String(e.year)))].sort((a, b) => Number(b) - Number(a));

  // Empty entries are filtered out because Radix throws on a SelectItem whose
  // value is an empty string — it reserves "" for "nothing selected". The
  // legacy conference import is where they come from: the old site never
  // recorded a venue for any of its 41 conferences, so every one of them
  // arrives with location unset, and one of those was enough to take the whole
  // page down rather than just leave a filter option blank.
  const locations = [...new Set(events.map((e) => e.location))]
    .filter((location) => location.trim() !== "")
    .sort((a, b) => a.localeCompare(b));

  return (
    <>
      <PageHeader
        locale={locale as Locale}
        title={dict.events.title}
        description={dict.events.description}
        homeLabel={dict.nav.home}
        breadcrumbs={[{ label: dict.events.title }]}
      />

      <EventsListClient
        locale={locale as Locale}
        dict={dict}
        events={events}
        years={years}
        locations={locations}
      />
    </>
  );
}
