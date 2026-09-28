"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  subscribeUrl: string;
  tokenRequired: boolean;
};

export function CalendarSubscribe({ subscribeUrl, tokenRequired }: Props) {
  const [copied, setCopied] = useState(false);
  const googleAddUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
    subscribeUrl.replace(/^https:/, "webcal:"),
  )}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(subscribeUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Add to Google Calendar</h2>
        <p className="text-muted-foreground">
          Subscribe to the team meeting schedule (.ics). The feed updates when meetings are added
          or times change. It includes titles and times only — not attendance or notebook notes.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ics-subscribe-url" className="text-base">
          Subscribe link
        </Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            id="ics-subscribe-url"
            readOnly
            value={subscribeUrl}
            className="h-12 px-3 font-mono text-sm md:text-sm"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button type="button" size="lg" className="shrink-0" onClick={copyLink}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-base text-muted-foreground">
        <li>Open Google Calendar on the web.</li>
        <li>
          Under <span className="text-foreground">Other calendars</span>, choose{" "}
          <span className="text-foreground">From URL</span>.
        </li>
        <li>Paste the subscribe link above and click Add calendar.</li>
      </ol>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <a href={googleAddUrl} target="_blank" rel="noreferrer">
            Open in Google Calendar
          </a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href={subscribeUrl}>Download .ics</a>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {tokenRequired
          ? "This link includes a secret token so Google can fetch the feed without signing in. Share it with the team; treat it like a calendar invite link."
          : "Anyone with this URL can see meeting titles and times. A coach can add a subscribe token in server settings if you want a harder-to-guess link."}
      </p>
    </section>
  );
}
