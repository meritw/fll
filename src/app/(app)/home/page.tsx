import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PybricksLicensePanel } from "@/components/pybricks-license-panel";
import { TeamProjectHome } from "@/components/team-project-home";
import { getLicenseForUser } from "@/lib/pybricks-licenses";
import { isCoach, isParent } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { getTeamProjectSummary } from "@/lib/team-project";

export const metadata: Metadata = {
  title: "Coding Page",
};

/**
 * The Pybricks license sits just above Step 1, collapsed so team members can find
 * it without being sidetracked while following the steps.
 * Parents do not use coding tools — send them to the Journal.
 */
export default async function HomeWorkspacePage() {
  const session = await requireUser();
  if (isParent(session.user.role)) {
    redirect("/journal");
  }

  const [summary, license] = await Promise.all([
    getTeamProjectSummary(),
    getLicenseForUser(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <TeamProjectHome
        headSha={summary.project.headSha}
        storageReady={summary.storageReady}
        openConflictCount={summary.openConflictCount}
        isCoach={isCoach(session.user.role)}
        commits={summary.commits}
        recentUploads={summary.recentUploads}
        beforeSteps={
          <PybricksLicensePanel
            code={license?.code ?? null}
            isCoachReserved={license?.seatKind === "coach_reserved"}
            viewerName={session.user.name}
          />
        }
      />
    </div>
  );
}
