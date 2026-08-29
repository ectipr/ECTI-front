import { MapPin, CalendarDays, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getFeaturedEvents } from "@/lib/events-data";
import type { FeaturedEvent } from "@/lib/events-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { safeUrl } from "@/lib/safe-url";

interface FeaturedEventSectionProps {
  locale: Locale;
  dict: Dictionary;
}

function FeaturedEventCard({
  event,
  dict,
}: {
  event: FeaturedEvent;
  dict: Dictionary;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col lg:flex-row">
        {/* Left: visual banner */}
        <div className="relative flex flex-col items-center justify-center gap-3 bg-primary px-6 py-8 text-center text-primary-foreground lg:w-2/5 lg:py-10">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-foreground/20" />
            <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-primary-foreground/15" />
          </div>
          <div className="relative flex flex-col items-center gap-2">
            <span className="text-3xl font-bold md:text-4xl">
              {event.title}
            </span>
            {event.description && (
              <p className="text-sm text-primary-foreground/80">
                {event.description}
              </p>
            )}

            {event.location && (
              <div className="mt-1 flex items-center gap-2 text-sm text-primary-foreground/70">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: details */}
        <div className="flex flex-1 flex-col justify-center gap-4 p-6 lg:p-8">
          {event.dateLabel && (
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="text-base font-semibold text-foreground">
                {event.dateLabel}
              </span>
            </div>
          )}

          {event.deadlines.length > 0 && (
            <>
              <Separator />

              <div className="flex flex-col gap-3">
                {event.deadlines.map((deadline, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span className="text-sm text-foreground">
                      {deadline.label}: {deadline.date}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* External event link — like the events page, the button is hidden
              entirely when the event has no link set. */}
          {safeUrl(event.registerUrl) && (
            <>
              <Separator />

              <div className="flex flex-wrap gap-3">
                <a
                  href={safeUrl(event.registerUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                    {dict.events.btnDetails}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export async function FeaturedEventSection({ locale, dict }: FeaturedEventSectionProps) {
  const events = await getFeaturedEvents(locale, 5);

  // No activities to feature (or API unreachable) — hide the section entirely.
  if (events.length === 0) return null;

  return (
    <section className="bg-background py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-balance text-3xl font-bold text-foreground md:text-4xl">
            {dict.home.sectionFeaturedEvent}
          </h2>
        </div>

        <div className="flex flex-col gap-6">
          {events.map((event) => (
            <FeaturedEventCard key={event.slug} event={event} dict={dict} />
          ))}
        </div>
      </div>
    </section>
  );
}
