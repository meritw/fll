import type { Metadata } from "next";

import { TeamProjectHome } from "@/components/team-project-home";
import { requireUser } from "@/lib/session";
import { getTeamProjectSummary } from "@/lib/team-project";

export const metadata: Metadata = {
  title: "Coding Page",
};

export default async function HomeWorkspacePage() {
  const session = await requireUser();
  const summary = await getTeamProjectSummary();

  return (
    <TeamProjectHome
      headSha={summary.project.headSha}
      storageReady={summary.storageReady}
      openConflictCount={summary.openConflictCount}
      isCoach={session.user.role === "coach"}
      commits={summary.commits}
      recentUploads={summary.recentUploads}
    />
  );
}
