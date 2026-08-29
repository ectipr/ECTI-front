"use client";

import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, CheckCircle2 } from "lucide-react";

// Posts to our own /api/contact, which holds the Web3Forms access key and
// forwards the message. The key used to live here as NEXT_PUBLIC_ — shipped in
// the bundle, readable by anyone, and usable from anywhere. More importantly,
// going straight to Web3Forms left no place to put a rate limit; now there is
// one, on our side of the request.

interface ContactFormProps {
  labels: {
    formTitle: string;
    formName: string;
    formEmail: string;
    formContactPlaceholder: string;
    formSubject: string;
    formMessage: string;
    formSend: string;
    formSuccess: string;
    formError: string;
    formTooMany: string;
    formInvalid: string;
  };
}

export function ContactForm({ labels }: ContactFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  // Holds the message to show rather than a flag, so "too many attempts" and
  // "that didn't go through" don't collapse into the same unhelpful line.
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // capture before await (currentTarget clears after)
    setError(null);
    setSending(true);
    try {
      const formData = new FormData(form);
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          contact: String(formData.get("contact") ?? ""),
          subject: String(formData.get("subject") ?? ""),
          message: String(formData.get("message") ?? ""),
          // Unchecked checkboxes are absent from FormData, so presence is the
          // whole signal — a person never sends this.
          botcheck: formData.get("botcheck") !== null,
        }),
      });

      if (res.ok) {
        form.reset();
        setSubmitted(true);
      } else if (res.status === 429) {
        setError(labels.formTooMany);
      } else if (res.status === 400 || res.status === 413) {
        setError(labels.formInvalid);
      } else {
        setError(labels.formError);
      }
    } catch {
      setError(labels.formError);
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <Card className="h-full border-border">
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <p className="max-w-sm leading-relaxed text-foreground">
            {labels.formSuccess}
          </p>
          <Button
            variant="outline"
            className="border-border text-foreground"
            onClick={() => setSubmitted(false)}
          >
            {labels.formSend}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl text-foreground">{labels.formTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground">
              {labels.formName}
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              placeholder={labels.formName}
              className="border-input"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="contact" className="text-sm font-medium text-foreground">
              {labels.formEmail}
            </label>
            <Input
              id="contact"
              name="contact"
              type="text"
              required
              maxLength={150}
              placeholder={labels.formContactPlaceholder}
              className="border-input"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="subject" className="text-sm font-medium text-foreground">
              {labels.formSubject}
            </label>
            <Input
              id="subject"
              name="subject"
              type="text"
              required
              maxLength={150}
              placeholder={labels.formSubject}
              className="border-input"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="message" className="text-sm font-medium text-foreground">
              {labels.formMessage}
            </label>
            <Textarea
              id="message"
              name="message"
              rows={5}
              required
              maxLength={5000}
              placeholder={labels.formMessage}
              className="border-input"
            />
          </div>

          {/* Honeypot — hidden from humans; bots that tick it get flagged as spam. */}
          <input
            type="checkbox"
            name="botcheck"
            className="hidden"
            style={{ display: "none" }}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          <Button
            type="submit"
            disabled={sending}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                {labels.formSend}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                {labels.formSend}
              </span>
            )}
          </Button>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
