import { getDictionary, isValidLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ContactForm } from "@/components/contact-form";
import { getContact } from "@/lib/contact-data";
import { MapPin, Mail, Phone, Clock } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};
  const dict = getDictionary(locale as Locale);
  return {
    title: dict.contact.title,
    description: dict.contact.description,
    openGraph: {
      title: dict.contact.title,
      description: dict.contact.description,
      locale: locale === "th" ? "th_TH" : "en_US",
    },
    alternates: { languages: { th: "/th/contact", en: "/en/contact" } },
  };
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const dict = getDictionary(locale as Locale);

  // Editable in Strapi; fall back to dictionary values if the CMS is unavailable.
  const contact = await getContact(locale);
  const address = contact?.address || dict.contact.addressText;
  const email = contact?.email || dict.contact.emailText;
  const phone = contact?.phone || dict.contact.phoneText;
  const officeHours = contact?.officeHours || dict.contact.officeHoursText;

  // Google Maps "embed" URL from Share → Embed a map — pins the exact ECTI office.
  // hl (the two `!1s<lang>` params) is swapped to the active locale so the map's
  // street labels match the page language.
  const mapSrc = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d242.0434713034624!2d100.54326716954719!3d13.917137807386315!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30e283003340e689%3A0x77d36fd43b03d76!2zRUNUSSAo4Liq4Lih4Liy4LiE4Lih4Lin4Li04LiK4Liy4LiB4Liy4Lij4LmE4Lif4Lif4LmJ4LiyIOC4reC4tOC5gOC4peC5h-C4geC4ryDguITguK3guKHguK8p!5e0!3m2!1s${locale}!2sth!4v1785069858784!5m2!1s${locale}!2sth`;

  const contactCards = [
    {
      icon: MapPin,
      title: dict.contact.addressTitle,
      text: address,
      color: "bg-primary/10 text-primary",
    },
    {
      icon: Mail,
      title: dict.contact.emailTitle,
      text: email,
      color: "bg-accent/10 text-accent",
      href: `mailto:${email}`,
    },
    {
      icon: Phone,
      title: dict.contact.phoneTitle,
      text: phone,
      color: "bg-chart-4/15 text-chart-4",
    },
    {
      icon: Clock,
      title: dict.contact.officeHoursTitle,
      text: officeHours,
      color: "bg-primary/10 text-primary",
    },
  ];

  return (
    <>
      <PageHeader
        locale={locale as Locale}
        title={dict.contact.title}
        description={dict.contact.description}
        homeLabel={dict.nav.home}
        breadcrumbs={[{ label: dict.contact.title }]}
      />

      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        {/* --- Contact Info Cards --- */}
        <section className="mb-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {contactCards.map((info) => {
              const content = (
                <Card
                  key={info.title}
                  className="h-full border-border transition-shadow hover:shadow-md"
                >
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-lg ${info.color}`}
                    >
                      <info.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {info.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {info.text}
                    </p>
                  </CardContent>
                </Card>
              );
              if (info.href) {
                return (
                  <a
                    key={info.title}
                    href={info.href}
                    className="block h-full transition-transform hover:scale-[1.01]"
                  >
                    {content}
                  </a>
                );
              }
              return content;
            })}
          </div>
        </section>

        {/* --- Form + Map --- */}
        <section className="mb-16 grid gap-8 lg:grid-cols-2">
          {/* Contact Form */}
          <ContactForm
            labels={{
              formTitle: dict.contact.formTitle,
              formName: dict.contact.formName,
              formEmail: dict.contact.formEmail,
              formContactPlaceholder: dict.contact.formContactPlaceholder,
              formSubject: dict.contact.formSubject,
              formMessage: dict.contact.formMessage,
              formSend: dict.contact.formSend,
              formSuccess: dict.contact.formSuccess,
              formError: dict.contact.formError,
              formTooMany: dict.contact.formTooMany,
              formInvalid: dict.contact.formInvalid,
            }}
          />

          {/* Map */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-foreground">
              {dict.contact.mapTitle}
            </h2>
            <Card className="flex-1 overflow-hidden border-border">
              <CardContent className="relative h-full min-h-[350px] p-0">
                {/* No API key needed — this is Google Maps' own "embed a map" URL. */}
                <iframe
                  src={mapSrc}
                  title={dict.contact.mapTitle}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </CardContent>
            </Card>
            <a
              href="https://maps.app.goo.gl/32RRbTGiBKTEaLin6"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <MapPin className="h-4 w-4 text-primary" />
              {locale === "th" ? "เปิดใน Google Maps" : "Open in Google Maps"}
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
