import type { MatchPlan, PlanTotals, RunStep } from "./types";

export function planTotals(plan: MatchPlan): PlanTotals {
  let bestSec = 0;
  let worstSec = 0;
  let points = 0;
  for (const step of plan.steps) {
    if (step.kind === "tool") {
      bestSec += step.bestSec;
      worstSec += step.worstSec;
      continue;
    }
    for (const mission of step.missions) {
      bestSec += mission.bestSec;
      worstSec += mission.worstSec;
      points += mission.points;
    }
  }
  return { bestSec, worstSec, points };
}

export function runPoints(run: RunStep): number {
  return run.missions.reduce((sum, mission) => sum + mission.points, 0);
}

export function formatMatchClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function attachmentChips(mission: {
  front: string;
  rear: string;
  other: string;
}): Array<{ slot: "Front" | "Rear" | "Other"; name: string }> {
  const chips: Array<{ slot: "Front" | "Rear" | "Other"; name: string }> = [];
  if (mission.front) chips.push({ slot: "Front", name: mission.front });
  if (mission.rear) chips.push({ slot: "Rear", name: mission.rear });
  if (mission.other) chips.push({ slot: "Other", name: mission.other });
  return chips;
}
