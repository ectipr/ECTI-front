import { getDictionary, isValidLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { HeroSection } from "@/components/hero-section";
import { StatsSection } from "@/components/stats-section";
import { FeaturedUpdatesSection } from "@/components/featured-updates-section";
import { ActivitiesSection } from "@/components/activities-section";
import { FeaturedEventSection } from "@/components/featured-event-section";
import { MemberSpotlightSection } from "@/components/member-spotlight-section";
import { NewsletterSection } from "@/components/newsletter-section";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};
  const dict = getDictionary(locale as Locale);
  return {
    title: dict.home.heroTitle,
    description: dict.home.heroSubtitle,
    openGraph: {
      title: dict.home.heroTitle,
      description: dict.home.heroSubtitle,
      locale: locale === "th" ? "th_TH" : "en_US",
    },
    alternates: {
      languages: {
        th: "/th",
        en: "/en",
      },
    },
  };
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const dict = getDictionary(locale as Locale);

  return (
    <>
      <HeroSection locale={locale as Locale} dict={dict} />
      {/* Hidden until the association confirms the real numbers. */}
      {/*<StatsSection dict={dict} />*/}
      <FeaturedUpdatesSection locale={locale as Locale} dict={dict} />
      <ActivitiesSection dict={dict} />
      <FeaturedEventSection locale={locale as Locale} dict={dict} />
      {/*<MemberSpotlightSection locale={locale as Locale} dict={dict} />*/}
      <NewsletterSection dict={dict} />
    </>
  );
}
