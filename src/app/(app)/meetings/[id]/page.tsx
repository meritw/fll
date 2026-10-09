import { redirect } from "next/navigation";

/** Old meeting links open that day in the journal. */
export default async function MeetingRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/journal/${encodeURIComponent(id)}`);
}
