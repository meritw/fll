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

/** `name` is "" when the run has not named what is on that slot yet. */
export type AttachmentChip = { slot: Slot; name: string };

export type MissionLineView = {
  mission: PlannedMission;
  /** "M07" */
  code: string;
  /** "Humongous Fungus" */
  name: string;
  /** The run's loadout at `mission.uses`. Null when the mission uses no attachment. */
  attachment: AttachmentChip | null;
};

export type RunView = {
  kind: "run";
  run: Run;
  /** 1-based position, so "Run 2" is always the second run. */
  number: number;
  /** RUN_COLORS by position. */
  color: string;
  points: number;
  missions: MissionLineView[];
};

/** `off` or `on` is "" when that side of the slot is empty. */
export type Swap = { slot: Slot; off: string; on: string };

export type ToolChangeView = {
  kind: "toolChange";
  /** The run this tool change sits before. */
  runId: string;
  toolChange: ToolChange;
  /** Slots whose attachment differs between the run before and the run after. Empty means relaunch as is. */
  swaps: Swap[];
  /** Set when the next run launches from the other home. */
  move: { from: HomeBase; to: HomeBase } | null;
};

export type StepView = RunView | ToolChangeView;

/** `over` turns the match bar red. */
export type Budget = { sec: number; leftSec: number; over: boolean };

export type Totals = { points: number; best: Budget; worst: Budget };

export type PlanView = {
  /** Run 1, the tool change before run 2, run 2, and so on. */
  steps: StepView[];
  runs: RunView[];
  totals: Totals;
};

/** Everything the page renders, derived in one pass so nothing derived is ever stored. */
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

/** Start home, then each mission's pin in order (missions with no pin skipped), then end home. */
export function suggestedPath(run: Run): PathPoint[] {
  const pins = run.missions.flatMap((mission) => {
    const pin = MISSION_PINS[mission.code];
    return pin ? [pin] : [];
  });
  return [HOME_ANCHORS[run.start], ...pins, HOME_ANCHORS[run.end]];
}

/** 150 formats as "2:30". Negative input formats as "0:00"; callers pass the absolute amount over. */
export function formatMatchClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
