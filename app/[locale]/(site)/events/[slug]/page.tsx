import { getDictionary, isValidLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  MapPin,
  ArrowLeft,
  Clock,
  Users,
  FileText,
  Mic,
  Building,
  Tag,
  CalendarCheck,
} from "lucide-react";
import { events, getEventBySlug, fetchEventBySlug, fetchEventsFromAPI } from "@/lib/events-data";
import type { ECTIEvent, EventStatus } from "@/lib/events-data";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * Every event the CMS knows about, in both locales.
 *
 * This used to list the six events hard-coded in lib/events-data.ts, which was
 * fine while those six were all there were. The legacy import put 41 real
 * conferences in the CMS, and none of them were in that array — so none of them
 * were prerendered, and the page below quietly fell back to rendering them on
 * demand while `generateMetadata` returned nothing at all for them.
 *
 * The static fallback is still merged in. It is what the page falls back to when
 * the CMS is unreachable, and dropping its slugs here would mean a build against
 * a down CMS produces a site where those pages 404 rather than showing the
 * built-in copy.
 */
export async function generateStaticParams() {
  const fromCms = await fetchEventsFromAPI("th");

  const slugs = new Set([
    ...fromCms.map((event) => event.slug),
    ...events.map((event) => event.slug),
  ]);

  return [...slugs].flatMap((slug) => [
    { locale: "th", slug },
    { locale: "en", slug },
  ]);
}

/**
 * Reads the same source the page does, in the same order.
 *
 * These two disagreeing is the bug this replaces: the page rendered a
 * conference from the CMS while the tab title, the search result and every
 * shared link described nothing, because metadata was still looking the slug up
 * in an array of six examples.
 */
export async function generateMetadata({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) return {};

  const event = (await fetchEventBySlug(slug, locale)) ?? getEventBySlug(slug);
  if (!event) return {};

  const dict = getDictionary(locale as Locale);
  const url = `/${locale}/events/${slug}`;

  return {
    title: `${event.title} | ${dict.events.title}`,
    description: event.description,
    openGraph: {
      title: event.title,
      description: event.description,
      type: "article",
      locale: locale === "th" ? "th_TH" : "en_US",
    },
    alternates: {
      canonical: url,
      languages: { th: `/th/events/${slug}`, en: `/en/events/${slug}` },
    },
  };
}

function getStatusLabel(status: EventStatus, dict: ReturnType<typeof getDictionary>): string {
  const map: Record<EventStatus, string> = {
    open: dict.events.statusCfp,
    register: dict.events.statusRegOpen,
    upcoming: dict.events.statusUpcoming,
    finished: dict.events.statusPast,
  };
  return map[status];
}

function getStatusStyle(status: EventStatus): string {
  switch (status) {
    case "open":
      return "bg-accent text-accent-foreground";
    case "register":
      return "bg-primary text-primary-foreground";
    case "upcoming":
      return "bg-chart-4 text-primary-foreground";
    case "finished":
      return "bg-muted text-muted-foreground";
  }
}

export default async function EventDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();

  // Try API first, fall back to static data
  let event: ECTIEvent | null | undefined = await fetchEventBySlug(slug, locale);
  if (!event) {
    event = getEventBySlug(slug);
  }
  if (!event) notFound();

  const dict = getDictionary(locale as Locale);

  const title = event.title;
  const date = event.date;
  const location = event.location;
  const description = event.description;
  const overview = event.overview;

  return (
    <>
      <PageHeader
        locale={locale as Locale}
        title={title}
        description={description}
        homeLabel={dict.nav.home}
        breadcrumbs={[
          { label: dict.events.title, href: `/${locale}/events` },
          { label: title },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-14">
        {/* Back link */}
        <Link
          href={`/${locale}/events`}
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {dict.events.backToEvents}
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="flex flex-col gap-8 lg:col-span-2">
            {/* Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  {dict.events.detailOverview}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge className={getStatusStyle(event.status)}>
                    {getStatusLabel(event.status, dict)}
                  </Badge>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {date}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    {location}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {overview}
                </p>
              </CardContent>
            </Card>

            {/* Conference Tracks */}
            {event.tracks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Tag className="h-5 w-5 text-primary" />
                    {dict.events.detailTracks}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {event.tracks.map((track, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {i + 1}
                        </div>
                        <span className="text-sm font-medium text-card-foreground">
                          {track.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Topics of Interest */}
            {event.topics.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    {dict.events.detailTopics}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {event.topics.map((topic) => (
                      <Badge
                        key={topic}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Keynote Speakers placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mic className="h-5 w-5 text-primary" />
                  {dict.events.detailSpeakers}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
                  <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    {dict.events.speakerTba}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            {/* Important Dates */}
            {event.deadlines.length > 0 && (
              <Card className="border-primary/20">
                <CardHeader className="bg-primary/5 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    {dict.events.detailDates}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-col gap-4">
                    {event.deadlines.map((d, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {d.label}
                        </span>
                        <span className="text-sm text-card-foreground">
                          {d.date}
                        </span>
                        {i < event.deadlines.length - 1 && (
                          <Separator className="mt-3" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Venue */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                  {dict.events.detailVenue}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {location}
                </p>
              </CardContent>
            </Card>

            {/* Organizer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building className="h-5 w-5 text-primary" />
                  {dict.events.detailOrganizer}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {event.organizer}
                </p>
              </CardContent>
            </Card>

            {/* Registration CTA */}
            {event.status !== "finished" && (
              <div className="flex flex-col gap-3">
                {event.status === "open" && (
                  <Button
                    size="lg"
                    className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <FileText className="h-4 w-4" />
                    {dict.events.btnSubmitPaper}
                  </Button>
                )}
                <Button size="lg" className="w-full gap-2">
                  <CalendarCheck className="h-4 w-4" />
                  {dict.events.btnRegister}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
