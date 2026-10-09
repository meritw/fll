import type { Metadata } from "next";

import { DayPage } from "@/components/journal/day-page";
import { findTodayMeeting } from "@/lib/meetings";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Today",
};

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

/** Today's page: today's meeting if it has started, otherwise the screen that starts it. */
export default async function JournalTodayPage({ searchParams }: PageProps) {
  await requireUser();
  const { tab } = await searchParams;
  // Stays on /journal/today all meeting long, so the page never remounts mid-save.
  const today = await findTodayMeeting();
  return <DayPage meetingId={today?.id ?? null} tab={tab} />;
}
