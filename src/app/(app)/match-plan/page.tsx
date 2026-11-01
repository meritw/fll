import type { Metadata } from "next";

import { MatchPlanBoard } from "@/components/match-plan/match-plan-board";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Match plan",
};

export default async function MatchPlanPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Match plan</h1>
        <p className="text-lg text-muted-foreground">Runs, tools, paths · BioGlow</p>
      </div>
      <MatchPlanBoard />
    </div>
  );
}
