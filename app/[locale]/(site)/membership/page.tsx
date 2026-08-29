import { getDictionary, isValidLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  GraduationCap,
  Users,
  Building2,
  FileText,
  CreditCard,
  Send,
  CheckCircle2,
  ArrowRight,
  Coins,
  Landmark,
  Mail,
  Globe,
  Download,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import {
  fetchBenefits,
  fetchHowToJoins,
  fetchMemberTypes,
  fetchQuestions,
  fetchMembershipPayment,
  fetchMembershipCredit,
  fetchMembershipDocuments,
} from "@/lib/membership-data";
import { getApplyLink } from "@/lib/apply-data";
import { safeUrl } from "@/lib/safe-url";

interface PageProps {
  params: Promise<{ locale: string }>;
}

function PaymentRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium text-foreground${mono ? " font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};
  const dict = getDictionary(locale as Locale);
  return {
    title: dict.membership.title,
    description: dict.membership.description,
    openGraph: {
      title: dict.membership.title,
      description: dict.membership.description,
      locale: locale === "th" ? "th_TH" : "en_US",
    },
    alternates: { languages: { th: "/th/membership", en: "/en/membership" } },
  };
}

export default async function MembershipPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const dict = getDictionary(locale as Locale);

  const [
    apiBenefits,
    apiHowToJoins,
    apiMemberTypes,
    apiQuestions,
    applyUrl,
    payment,
    credit,
    documents,
  ] = await Promise.all([
    fetchBenefits(locale),
    fetchHowToJoins(locale),
    fetchMemberTypes(locale),
    fetchQuestions(locale),
    getApplyLink(locale),
    fetchMembershipPayment(locale),
    fetchMembershipCredit(locale),
    fetchMembershipDocuments(locale),
  ]);

  const finalBenefits = apiBenefits.length > 0
    ? apiBenefits.map(b => b.description)
    : dict.membership.benefits;

  const fallbackSteps = [
    { icon: FileText, title: dict.membership.step1Title, desc: dict.membership.step1Desc },
    { icon: CreditCard, title: dict.membership.step2Title, desc: dict.membership.step2Desc },
    { icon: Send, title: dict.membership.step3Title, desc: dict.membership.step3Desc },
    { icon: CheckCircle2, title: dict.membership.step4Title, desc: dict.membership.step4Desc },
  ];

  const finalSteps = apiHowToJoins.length > 0 
    ? apiHowToJoins.map((s, idx) => ({
        icon: fallbackSteps[idx % fallbackSteps.length]?.icon || CheckCircle2,
        title: s.title,
        desc: s.description,
        customIconUrl: s.iconUrl
      }))
    : fallbackSteps.map(s => ({ ...s, customIconUrl: null }));

  const fallbackFaqs = [
    { q: dict.membership.faq1Q, a: dict.membership.faq1A },
    { q: dict.membership.faq2Q, a: dict.membership.faq2A },
    { q: dict.membership.faq3Q, a: dict.membership.faq3A },
    { q: dict.membership.faq4Q, a: dict.membership.faq4A },
    { q: dict.membership.faq5Q, a: dict.membership.faq5A },
  ];

  const finalFaqs = apiQuestions.length > 0
    ? apiQuestions.map(q => ({ q: q.question, a: q.answer }))
    : fallbackFaqs;

  const finalMemberTypes = apiMemberTypes.length > 0 ? apiMemberTypes : null;

  const formatFee = (value: number | null) =>
    value === null || value === undefined
      ? dict.membership.feeUnknown
      : `${value.toLocaleString()} ${dict.membership.feeUnit}`;

  const iconForKey = (key: string | null) =>
    key === "student" ? GraduationCap : key === "corporate" ? Building2 : Users;

  const hasBankInfo = !!(
    payment &&
    (payment.bank_name ||
      payment.bank_branch ||
      payment.account_name ||
      payment.account_number ||
      payment.swift_code)
  );
  const hasChannels = !!(
    payment && (payment.online_portal_url || payment.payment_email)
  );

  return (
    <>
      <PageHeader
        locale={locale as Locale}
        title={dict.membership.title}
        description={dict.membership.description}
        homeLabel={dict.nav.home}
        breadcrumbs={[{ label: dict.membership.title }]}
      />

      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        {/* --- Benefits Section --- */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-foreground md:text-3xl">
            {dict.membership.benefitsTitle}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {finalBenefits.map((benefit, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm leading-relaxed text-foreground">
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </section>

        <Separator className="mb-20" />

        {/* --- Membership Types & Fees Table --- */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-foreground md:text-3xl">
            {dict.membership.typesTitle}
          </h2>
          <Card className="overflow-hidden border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead className="px-4 py-3 font-semibold text-foreground">
                      {dict.membership.colType}
                    </TableHead>
                    <TableHead className="px-4 py-3 font-semibold text-foreground">
                      {dict.membership.colEligibility}
                    </TableHead>
                    <TableHead className="px-4 py-3 text-center font-semibold text-foreground">
                      {dict.membership.colMembershipFee}
                    </TableHead>
                    <TableHead className="px-4 py-3 text-center font-semibold text-foreground">
                      {dict.membership.colEntranceFee}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalMemberTypes ? (
                    finalMemberTypes.map((type, i) => {
                      const Icon = iconForKey(type.key);
                      return (
                        <TableRow key={i}>
                          <TableCell className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                {type.iconUrl ? (
                                  <img src={type.iconUrl} alt={type.type} className="h-5 w-5 object-contain" />
                                ) : (
                                  <Icon className="h-5 w-5 text-primary" />
                                )}
                              </div>
                              <span className="font-medium text-foreground">{type.type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs px-4 py-4 text-sm text-muted-foreground" style={{ whiteSpace: "normal" }}>
                            {type.eligibility}
                          </TableCell>
                          <TableCell className="px-4 py-4 text-center">
                            <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                              {formatFee(type.membership_fee)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-center">
                            <Badge variant="outline" className="border-primary/30 text-primary">
                              {formatFee(type.entrance_fee)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        {dict.membership.typesEmpty}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {credit && (
          <>
            <Separator className="mb-20" />

            {/* --- ECTI Credits --- */}
            <section className="mb-20">
              <h2 className="mb-8 text-2xl font-bold text-foreground md:text-3xl">
                {credit.title || dict.membership.creditsTitle}
              </h2>
              <Card className="border-border">
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Coins className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                    {credit.description}
                  </p>
                </CardContent>
              </Card>
            </section>
          </>
        )}

        <Separator className="mb-20" />

        {/* --- How to Join Stepper --- */}
        <section className="mb-20">
          <h2 className="mb-10 text-2xl font-bold text-foreground md:text-3xl">
            {dict.membership.howToJoinTitle}
          </h2>
          <div className="relative grid gap-8 md:grid-cols-4">
            {/* Connecting line */}
            <div
              className="absolute left-[calc(12.5%)] top-7 hidden h-0.5 bg-border md:block"
              style={{ width: "calc(75%)" }}
              aria-hidden="true"
            />
            {finalSteps.map((step, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-card overflow-hidden">
                  {step.customIconUrl ? (
                    <img src={step.customIconUrl} alt={step.title} className="h-6 w-6 object-contain" />
                  ) : (
                    <step.icon className="h-6 w-6 text-primary" />
                  )}
                </div>
                <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {locale === "th" ? `ขั้นตอน ${i + 1}` : `Step ${i + 1}`}
                </span>
                <h3 className="mb-2 text-base font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {payment && (hasBankInfo || hasChannels) && (
          <>
            <Separator className="mb-20" />

            {/* --- Payment & Application Channels --- */}
            <section className="mb-20">
              <h2 className="mb-8 text-2xl font-bold text-foreground md:text-3xl">
                {dict.membership.paymentTitle}
              </h2>
              <div className="grid gap-6 lg:grid-cols-2">
                {hasBankInfo && (
                <Card className="border-border">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Landmark className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">
                      {dict.membership.paymentBankTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-3 text-sm">
                      <PaymentRow label={dict.membership.paymentBankLabel} value={payment.bank_name} />
                      <PaymentRow label={dict.membership.paymentBranchLabel} value={payment.bank_branch} />
                      <PaymentRow label={dict.membership.paymentAccountNameLabel} value={payment.account_name} />
                      <PaymentRow label={dict.membership.paymentAccountNoLabel} value={payment.account_number} mono />
                      <PaymentRow label={dict.membership.paymentSwiftLabel} value={payment.swift_code} mono />
                    </dl>
                  </CardContent>
                </Card>
                )}

                {hasChannels && (
                <Card className="border-border">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Send className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">
                      {dict.membership.channelsTitle}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {payment.online_portal_url && (
                      <div>
                        <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                          <Globe className="h-4 w-4 text-primary" />
                          {dict.membership.channelOnlineTitle}
                        </div>
                        <p className="mb-2 text-sm text-muted-foreground">
                          {dict.membership.channelOnlineDesc}
                        </p>
                        <Button asChild size="sm" variant="outline">
                          {safeUrl(applyUrl) ? (
                            <a
                              href={safeUrl(applyUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {dict.membership.channelOnlineButton}
                              <ExternalLink className="ml-2 h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <Link href={`/${locale}/contact`}>
                              {dict.membership.channelOnlineButton}
                              <ExternalLink className="ml-2 h-3.5 w-3.5" />
                            </Link>
                          )}
                        </Button>
                      </div>
                    )}
                    {payment.payment_email && (
                      <div>
                        <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                          <Mail className="h-4 w-4 text-primary" />
                          {dict.membership.channelEmailTitle}
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {dict.membership.channelEmailDesc}{" "}
                          <a
                            href={`mailto:${payment.payment_email}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {payment.payment_email}
                          </a>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                )}
              </div>
              {payment.note && (
                <p className="mt-4 text-sm italic text-muted-foreground">
                  * {payment.note}
                </p>
              )}
            </section>
          </>
        )}

        {documents.length > 0 && (
          <>
            <Separator className="mb-20" />

            {/* --- Downloadable Documents --- */}
            <section className="mb-20">
              <h2 className="mb-8 text-2xl font-bold text-foreground md:text-3xl">
                {dict.membership.documentsTitle}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={safeUrl(doc.fileUrl) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">
                        {doc.title}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Download className="h-3 w-3" />
                        {dict.membership.documentsDownload}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </>
        )}

        <Separator className="mb-20" />

        {/* --- FAQ Accordion --- */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold text-foreground md:text-3xl">
            {dict.membership.faqTitle}
          </h2>
          <Card className="border-border">
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                {finalFaqs.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left text-base font-medium text-foreground">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {typeof faq.a === "string" ? (
                        faq.a
                      ) : (
                        <RichTextRenderer blocks={faq.a} />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

        {/* --- Bottom CTA --- */}
        <section className="rounded-xl bg-primary px-6 py-12 text-center md:px-12 md:py-16">
          <h2 className="mb-4 text-2xl font-bold text-primary-foreground md:text-3xl">
            {dict.membership.ctaTitle}
          </h2>
          <p className="mx-auto mb-8 max-w-xl leading-relaxed text-primary-foreground/80">
            {dict.membership.ctaDesc}
          </p>
          <Button
            size="lg"
            asChild
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {safeUrl(applyUrl) ? (
              <a href={safeUrl(applyUrl)} target="_blank" rel="noopener noreferrer">
                {dict.membership.ctaButton}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            ) : (
              <Link href={`/${locale}/contact`}>
                {dict.membership.ctaButton}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            )}
          </Button>
        </section>
      </div>
    </>
  );
}
