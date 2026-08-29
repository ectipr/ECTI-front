import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { Download, Landmark, Receipt, Building2, Send } from "lucide-react";
import type {
  DocumentGuide,
  GuideCase,
  GuideStep,
} from "@/lib/document-guide-data";
import type { ResourceItem } from "@/lib/resource-detail-data";
import { safeUrl } from "@/lib/safe-url";

interface DocumentGuideSectionProps {
  guide: DocumentGuide;
  /** Used to turn a step's documentKey into a real download href */
  documents: ResourceItem[];
  labels: {
    reimbursementTitle: string;
    loanTitle: string;
    stepsLabel: string;
    receiptTitle: string;
    mailingTitle: string;
    taxId: string;
    phone: string;
    copy: string;
    copied: string;
  };
}

/**
 * The "how do I claim / borrow money" walkthrough on Resources → เอกสารของสมาคม,
 * replacing the wall of text on the legacy site: one card per case, each with a
 * numbered checklist whose form names are download links.
 */
export function DocumentGuideSection({
  guide,
  documents,
  labels,
}: DocumentGuideSectionProps) {
  const byKey = new Map<string, ResourceItem>();
  for (const doc of documents) {
    if (doc.key) byKey.set(doc.key, doc);
  }

  const reimbursement = guide.cases.filter((c) => c.group === "reimbursement");
  const loan = guide.cases.filter((c) => c.group === "loan");

  return (
    <div className="flex flex-col gap-12">
      {reimbursement.length > 0 && (
        <CaseGroup
          icon={<Receipt className="h-5 w-5" />}
          title={labels.reimbursementTitle}
          cases={reimbursement}
          byKey={byKey}
          stepsLabel={labels.stepsLabel}
        />
      )}

      {loan.length > 0 && (
        <CaseGroup
          icon={<Landmark className="h-5 w-5" />}
          title={labels.loanTitle}
          cases={loan}
          byKey={byKey}
          stepsLabel={labels.stepsLabel}
        />
      )}

      <InfoBox info={guide.info} labels={labels} />
    </div>
  );
}

function CaseGroup({
  icon,
  title,
  cases,
  byKey,
  stepsLabel,
}: {
  icon: ReactNode;
  title: string;
  cases: GuideCase[];
  byKey: Map<string, ResourceItem>;
  stepsLabel: string;
}) {
  return (
    <section>
      <h2 className="mb-5 flex items-center gap-2.5 text-lg font-semibold text-foreground">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        {title}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((item, i) => (
          <CaseCard
            key={`${item.group}-${item.order}-${i}`}
            item={item}
            byKey={byKey}
            stepsLabel={stepsLabel}
            /* A lone case usually restates the group heading (การยืมเงินสมาคม) — don't print it twice */
            hideTitle={cases.length === 1 && item.title.trim() === title.trim()}
          />
        ))}
      </div>
    </section>
  );
}

function CaseCard({
  item,
  byKey,
  stepsLabel,
  hideTitle = false,
}: {
  item: GuideCase;
  byKey: Map<string, ResourceItem>;
  stepsLabel: string;
  hideTitle?: boolean;
}) {
  const header = !hideTitle || item.subtitle;

  return (
    <Card className="border-border">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        {header && (
          <div>
            {!hideTitle && (
              <h3 className="text-sm font-semibold leading-snug text-card-foreground">
                {item.title}
              </h3>
            )}
            {item.subtitle && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {item.subtitle}
              </p>
            )}
          </div>
        )}

        <div className={`${header ? "mt-auto border-t border-border pt-4" : ""}`}>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stepsLabel}
          </p>
          <ol className="flex flex-col gap-2.5">
            {item.steps.map((step, i) => (
              <StepRow
                key={`${step.text}-${i}`}
                step={step}
                index={i + 1}
                doc={step.documentKey ? byKey.get(step.documentKey) : undefined}
              />
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function StepRow({
  step,
  index,
  doc,
}: {
  step: GuideStep;
  index: number;
  doc?: ResourceItem;
}) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
      >
        {index}
      </span>

      <span className="min-w-0 flex-1 text-sm leading-snug">
        {safeUrl(doc?.href) ? (
          <a
            href={safeUrl(doc?.href)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-baseline gap-1.5 font-medium text-primary underline underline-offset-4 hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {step.text}
            <Download aria-hidden="true" className="h-3.5 w-3.5 shrink-0 self-center" />
          </a>
        ) : (
          <span className="text-card-foreground">{step.text}</span>
        )}

        {step.note && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {step.note}
          </span>
        )}
      </span>
    </li>
  );
}

function InfoBox({
  info,
  labels,
}: {
  info: DocumentGuide["info"];
  labels: DocumentGuideSectionProps["labels"];
}) {
  const receiptLines = [
    info.receiptName,
    info.receiptAddress,
    info.taxId ? `${labels.taxId} ${info.taxId}` : undefined,
  ].filter(Boolean) as string[];

  const mailingLines = [
    info.mailingName,
    info.mailingAddress,
    info.phone ? `${labels.phone} ${info.phone}` : undefined,
  ].filter(Boolean) as string[];

  if (receiptLines.length === 0 && mailingLines.length === 0) return null;

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {receiptLines.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/40 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 aria-hidden="true" className="h-4 w-4 text-primary" />
            {labels.receiptTitle}
          </h3>
          <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
            {info.receiptName && (
              <p className="font-medium text-foreground">{info.receiptName}</p>
            )}
            {info.receiptAddress && <p>{info.receiptAddress}</p>}
            {info.taxId && (
              <p>
                {labels.taxId}{" "}
                <span className="font-mono text-foreground">{info.taxId}</span>
              </p>
            )}
          </div>
          <div className="mt-3">
            <CopyButton
              value={receiptLines.join("\n")}
              label={labels.copy}
              copiedLabel={labels.copied}
            />
          </div>
        </div>
      )}

      {mailingLines.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/40 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Send aria-hidden="true" className="h-4 w-4 text-primary" />
            {labels.mailingTitle}
          </h3>
          <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
            {info.mailingName && (
              <p className="font-medium text-foreground">{info.mailingName}</p>
            )}
            {info.mailingAddress && <p>{info.mailingAddress}</p>}
            {info.phone && (
              <p>
                {labels.phone}{" "}
                <a
                  href={`tel:${info.phone.replace(/[^\d+]/g, "")}`}
                  className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  {info.phone}
                </a>
              </p>
            )}
          </div>
          <div className="mt-3">
            <CopyButton
              value={mailingLines.join("\n")}
              label={labels.copy}
              copiedLabel={labels.copied}
            />
          </div>
        </div>
      )}
    </section>
  );
}
