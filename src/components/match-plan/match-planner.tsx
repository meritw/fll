"use client";

import { useMatchPlan } from "./use-match-plan";

export function MatchPlanner() {
  const [view] = useMatchPlan();
  if (!view) return <p aria-busy>Loading your plan…</p>;
  return (
    <p>
      {view.runs.length} runs · {view.totals.points} pts
    </p>
  );
}
