import { redirect } from "next/navigation";

export default async function MeetingRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/journal/${encodeURIComponent(id)}`);
}
