"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConferenceYear } from "@/lib/conferences-data";
import type { Dictionary } from "@/lib/i18n";

/**
 * Above this many years the list is summarised rather than listed.
 *
 * Eight fits on one line at the narrowest card width, which is the point of the
 * threshold: the summary exists to stop the badges wrapping, so a list that
 * does not wrap has nothing to gain from being hidden. ICA-SYMP has four and
 * ITC-CSCC seven; both show in full and never grow a control that does nothing
 * useful.
 */
const INLINE_LIMIT = 8;

interface ConferenceYearsProps {
  label: string;
  years: ConferenceYear[];
  dict: Dictionary;
}

function YearBadge({ year, link }: ConferenceYear) {
  if (!link) {
    return (
      <Badge variant="secondary" className="font-normal tabular-nums">
        {year}
      </Badge>
    );
  }

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {/* The hover state is the only thing separating a year you can open from
          one you cannot, so it carries real weight in a row of twenty. */}
      <Badge
        variant="secondary"
        className="font-normal tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {year}
      </Badge>
    </a>
  );
}

/**
 * The years a conference has run, as badges that open that year's site.
 *
 * ECTI-CON has twenty-three of them and ECTI-CARD eighteen, which wrapped to a
 * second and third line and turned four cards into fifty-two badges stacked
 * down the page. Almost none of them is what a reader came for: the question a
 * list like this answers at a glance is how long the conference has run, and
 * that is two numbers and a count rather than twenty-three.
 *
 * So a long list collapses to exactly that, and opens to the full set. A short
 * one is left alone.
 */
export function ConferenceYears({ label, years, dict }: ConferenceYearsProps) {
  const [expanded, setExpanded] = useState(false);

  if (years.length === 0) return null;

  // Ascending, and sorted here rather than trusted from the CMS: the rows are
  // drag-ordered in the admin, so the order that arrives is whatever someone
  // left them in — which on a list of years is a detail nobody should have to
  // maintain by hand.
  const sorted = [...years].sort((a, b) => Number(a.year) - Number(b.year));
  const collapsible = sorted.length > INLINE_LIMIT;

  if (!collapsible) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}:</span>
        {sorted.map((entry, index) => (
          <YearBadge key={`${entry.year}-${index}`} {...entry} />
        ))}
      </div>
    );
  }

  const first = sorted[0].year;
  const last = sorted[sorted.length - 1].year;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}:</span>
        <span className="text-sm tabular-nums text-foreground">
          {first} – {last}
        </span>
        <span className="text-xs text-muted-foreground">
          · {sorted.length} {dict.publications.conferencesTimes}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {expanded ? dict.publications.conferencesHideYears : dict.publications.conferencesShowYears}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-wrap items-center gap-1.5">
          {sorted.map((entry, index) => (
            // Keyed by position: an editor can enter the same year twice, and a
            // year key would make React drop one of the pair without a word.
            <YearBadge key={`${entry.year}-${index}`} {...entry} />
          ))}
        </div>
      )}
    </div>
  );
}
