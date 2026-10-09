import type { Metadata } from "next";

import { DayPage } from "@/components/journal/day-page";
import { getSessionRecord, sessionLabel } from "@/lib/meetings";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const record = await getSessionRecord(id);
  return { title: record ? sessionLabel(record) : "Journal" };
}

export default async function JournalDayPage({ params, searchParams }: PageProps) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return <DayPage meetingId={id} tab={tab} />;
}
