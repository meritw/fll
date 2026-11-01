import { missionCode } from "@/lib/mission-status";
import { MISSIONS } from "@/lib/missions";

import { HOME_ANCHORS, MISSION_PINS } from "./pins";
import {
  MATCH_SEC,
  SLOTS,
  type HomeBase,
  type MatchPlan,
  type PathPoint,
  type PlannedMission,
  type Run,
  type Slot,
  type ToolChange,
} from "./plan";

export const RUN_COLORS = ["#e85d4c", "#1f8a7a", "#c48a1a", "#5866d8", "#b04f8e"] as const;

export const SLOT_LABELS: Record<Slot, string> = { front: "Front", rear: "Rear", other: "Other" };

const MISSION_NAMES = new Map<number, string>(MISSIONS);

export type AttachmentChip = { slot: Slot; name: string };

export type MissionLineView = {
  mission: PlannedMission;
  /** "M07" */
  code: string;
  /** "Humongous Fungus" */
  name: string;
  attachment: AttachmentChip | null;
};

export type RunView = {
  kind: "run";
  run: Run;
  number: number;
  color: string;
  points: number;
  missions: MissionLineView[];
};

export type Swap = { slot: Slot; off: string; on: string };

export type ToolChangeView = {
  kind: "toolChange";
  runId: string;
  toolChange: ToolChange;
  swaps: Swap[];
  move: { from: HomeBase; to: HomeBase } | null;
};

export type StepView = RunView | ToolChangeView;

export type Budget = { sec: number; leftSec: number; over: boolean };

export type Totals = { points: number; best: Budget; worst: Budget };

export type PlanView = {
  steps: StepView[];
  runs: RunView[];
  totals: Totals;
};

export function viewPlan(plan: MatchPlan): PlanView {
  const steps: StepView[] = [];
  const runs: RunView[] = [];
  let points = 0;
  let bestSec = 0;
  let worstSec = 0;

  plan.runs.forEach((run, index) => {
    const previous = plan.runs[index - 1];
    if (previous) {
      steps.push({
        kind: "toolChange",
        runId: run.id,
        toolChange: run.toolChange,
        swaps: SLOTS.filter((slot) => previous.loadout[slot] !== run.loadout[slot]).map((slot) => ({
          slot,
          off: previous.loadout[slot],
          on: run.loadout[slot],
        })),
        move: previous.end === run.start ? null : { from: previous.end, to: run.start },
      });
      bestSec += run.toolChange.time.bestSec;
      worstSec += run.toolChange.time.worstSec;
    }

    const view: RunView = {
      kind: "run",
      run,
      number: index + 1,
      color: RUN_COLORS[index % RUN_COLORS.length],
      points: run.missions.reduce((sum, mission) => sum + mission.points, 0),
      missions: run.missions.map((mission) => ({
        mission,
        code: missionCode(mission.code),
        name: MISSION_NAMES.get(mission.code) ?? "",
        attachment: mission.uses === "none" ? null : { slot: mission.uses, name: run.loadout[mission.uses] },
      })),
    };
    steps.push(view);
    runs.push(view);
    points += view.points;
    for (const mission of run.missions) {
      bestSec += mission.time.bestSec;
      worstSec += mission.time.worstSec;
    }
  });

  return { steps, runs, totals: { points, best: budget(bestSec), worst: budget(worstSec) } };
}

function budget(sec: number): Budget {
  return { sec, leftSec: MATCH_SEC - sec, over: sec > MATCH_SEC };
}

export function suggestedPath(run: Run): PathPoint[] {
  const pins = run.missions.flatMap((mission) => {
    const pin = MISSION_PINS[mission.code];
    return pin ? [pin] : [];
  });
  return [HOME_ANCHORS[run.start], ...pins, HOME_ANCHORS[run.end]];
}

export function formatMatchClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
