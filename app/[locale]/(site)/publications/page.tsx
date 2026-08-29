import { getDictionary, isValidLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, CalendarDays, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getJournals } from "@/lib/publications-data";
import { getConferences } from "@/lib/conferences-data";
import { safeUrl } from "@/lib/safe-url";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};
  const dict = getDictionary(locale as Locale);
  return {
    title: dict.publications.title,
    description: dict.publications.description,
    openGraph: {
      title: dict.publications.title,
      description: dict.publications.description,
      locale: locale === "th" ? "th_TH" : "en_US",
    },
    alternates: { languages: { th: "/th/publications", en: "/en/publications" } },
  };
}

export default async function PublicationsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const dict = getDictionary(locale as Locale);

  const journals = await getJournals(locale);
  const conferences = await getConferences(locale);

  return (
    <>
      <PageHeader
        locale={locale as Locale}
        title={dict.publications.title}
        description={dict.publications.description}
        homeLabel={dict.nav.home}
        breadcrumbs={[{ label: dict.publications.title }]}
      />

      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        {/* Journals */}
        <h2 className="mb-8 text-2xl font-bold text-foreground">
          {dict.publications.journalsTitle}
        </h2>
        <div className="mb-16 grid gap-6 md:grid-cols-3">
          {journals.map((journal) => (
            <Card
              key={journal.id}
              className="border-border transition-shadow hover:shadow-lg"
            >
              <CardContent className="flex flex-col gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-card-foreground">
                  {journal.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {journal.description}
                </p>
                {safeUrl(journal.url) && (
                  <Button
                    asChild
                    variant="outline"
                    className="mt-auto w-fit gap-2 border-border"
                  >
                    <a
                      href={safeUrl(journal.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {dict.common.readMore}
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Conferences */}
        {conferences.length > 0 && (
          <>
            <h2 className="mb-8 text-2xl font-bold text-foreground">
              {dict.publications.conferencesTitle}
            </h2>
            <div className="flex flex-col gap-6">
              {conferences.map((conf) => (
                <Card key={conf.id} className="border-border">
                  <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:gap-8">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                      <CalendarDays className="h-7 w-7 text-accent" />
                    </div>
                    <div className="flex flex-col gap-3">
                      <h3 className="text-lg font-semibold text-card-foreground">
                        {conf.title}
                      </h3>
                      <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                        {conf.description}
                      </p>
                      {conf.years.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            {dict.publications.conferencesYearsLabel}:
                          </span>
                          {conf.years.map((year) => (
                            <Badge key={year} variant="secondary" className="font-normal">
                              {year}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}