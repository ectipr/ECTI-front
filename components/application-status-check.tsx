"use client";

import { useState } from "react";
import { MailCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Dictionary, Locale } from "@/lib/i18n";

interface ApplicationStatusCheckProps {
  dict: Dictionary;
  locale: Locale;
}

/**
 * Asks /api/application-status to mail an applicant where their application
 * stands.
 *
 * The status never appears here. The route answers the same way for every
 * address — one it has an application for, one it doesn't, one whose lookup
 * failed — so there is nothing to render but the confirmation below, and that
 * is deliberate: showing a status on screen would let anyone type an address in
 * and learn who has applied to the association. See the note at the top of
 * app/api/application-status/route.ts.
 */
export function ApplicationStatusCheck({ dict, locale }: ApplicationStatusCheckProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  // Success replaces the form, the way the newsletter signup does: "check your
  // inbox, look in spam" is an instruction to act on, and a toast that fades
  // after four seconds is the wrong home for one. Errors stay as toasts — they
  // are short, and the reader needs to stay on the field to fix them.
  const [sent, setSent] = useState(false);
  // Honeypot, the same trick the contact and newsletter forms use: hidden from
  // people, so anything that ticks it is filling the form without looking.
  const [botcheck, setBotcheck] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/application-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, botcheck }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setEmail("");
        setSent(true);
      } else if (res.status === 429) {
        toast.error(dict.membership.statusTooMany);
      } else if (res.status === 400 || data?.error === "invalid_email") {
        toast.error(dict.membership.statusInvalid);
      } else {
        toast.error(dict.membership.statusError);
      }
    } catch {
      toast.error(dict.membership.statusError);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-4">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p role="status" className="text-pretty leading-relaxed text-foreground">
            {dict.membership.statusSent}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setSent(false)}>
          {dict.membership.statusAnother}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
      <label htmlFor="application-status-email" className="sr-only">
        {dict.membership.statusPlaceholder}
      </label>
      <Input
        id="application-status-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        placeholder={dict.membership.statusPlaceholder}
        autoComplete="email"
        className="h-11 flex-1"
        required
      />
      <input
        type="checkbox"
        name="botcheck"
        checked={botcheck}
        onChange={(e) => setBotcheck(e.target.checked)}
        className="hidden"
        style={{ display: "none" }}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <Button type="submit" disabled={loading} className="h-11">
        {dict.membership.statusButton}
        <Send className="ml-2 h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  );
}
