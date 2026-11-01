import type { Metadata } from "next";

import { MatchPlanner } from "@/components/match-plan/match-planner";
import { loadLivePlan } from "@/lib/match-plan/server";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Match plan",
};

export default async function MatchPlanPage() {
  const { user } = await requireUser();
  const live = await loadLivePlan(user);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Robot game · BioGlow</p>
        <h1 className="text-3xl font-semibold">Match plan</h1>
        <p className="text-lg text-muted-foreground">Plan your runs, tools, and points. Fit it all in 2:30.</p>
      </div>
      <MatchPlanner live={live} />
    </div>
  );
}
