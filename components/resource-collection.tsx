import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ResourceItem } from "@/lib/resource-detail-data";
import type { Locale } from "@/lib/i18n";
import { safeUrl } from "@/lib/safe-url";

interface ResourceCollectionProps {
  items: ResourceItem[];
  locale: Locale;
  labels: {
    download: string;
    open: string;
  };
  /** Icon shown on each card (defaults to a document icon) */
  icon?: LucideIcon;
}

/**
 * Renders a responsive grid of downloadable / external resource items.
 * Used by the Resources detail sub-pages (issue #28).
 */
export function ResourceCollection({
  items,
  locale,
  labels,
  icon: Icon = FileText,
}: ResourceCollectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => {
        const title =
          locale === "en" && item.titleEn ? item.titleEn : item.title;
        return (
          <Card
            key={`${item.href}-${i}`}
            className="group border-border transition-shadow hover:shadow-md"
          >
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>

              <h3 className="text-sm font-semibold leading-snug text-card-foreground">
                {title}
              </h3>

              {item.description && (
                <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
              )}

              {item.meta && (
                <span className="text-xs text-muted-foreground">
                  {item.meta}
                </span>
              )}

              <div className="mt-auto pt-1">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 border-border text-xs font-medium"
                >
                  {item.external ? (
                    <a href={safeUrl(item.href)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {labels.open}
                    </a>
                  ) : (
                    <a href={safeUrl(item.href)} download>
                      <Download className="h-3.5 w-3.5" />
                      {labels.download}
                    </a>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
