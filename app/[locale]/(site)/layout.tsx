import { notFound } from "next/navigation";
import { isValidLocale, getDictionary, locales } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BackToTop } from "@/components/back-to-top";

/**
 * The two locales the site ships, so every page underneath can be prerendered.
 *
 * Without this, `[locale]` is a segment Next has no known values for, and a
 * page it cannot name at build time is a page it cannot build — so every route
 * under this layout fell back to rendering on demand, whatever each individual
 * page said about caching. That is why removing `force-dynamic` from the events
 * page changed nothing on its own: the page was already dynamic, one level up.
 *
 * The detail pages were the exception, and the reason why is the same: they
 * carry their own generateStaticParams returning locale and slug together, so
 * they were the only routes Next could name.
 *
 * With the locales listed, the pages become files served from the CDN and
 * Strapi's webhook is what replaces them. Adding a locale here is what makes it
 * buildable; nothing else reads this list.
 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const dict = getDictionary(locale as Locale);

  return (
    <div className="flex min-h-screen flex-col" lang={locale}>
      <a href="#main-content" className="skip-link">
        {locale === "th" ? "ข้ามไปเนื้อหาหลัก" : "Skip to main content"}
      </a>
      <SiteHeader locale={locale as Locale} dict={dict} />
      <main id="main-content" className="flex-1" role="main">
        {children}
      </main>
      <SiteFooter locale={locale as Locale} dict={dict} />
      <BackToTop />
    </div>
  );
}
