import { MISSIONS } from "@/lib/missions";

import { SEED_JSON } from "./seed";

/** Robot game length. A rule of the game, not plan data. */
export const MATCH_SEC = 150;

export const HOMES = ["RED", "BLUE"] as const;
export type HomeBase = (typeof HOMES)[number];

export const SLOTS = ["front", "rear", "other"] as const;
export type Slot = (typeof SLOTS)[number];

/**
 * What is mounted on each slot when the run launches. "" means nothing is on that slot.
 * One attachment per slot per run, because nobody may touch the robot outside home.
 */
export type Loadout = Readonly<Record<Slot, string>>;

export type MissionCode = (typeof MISSIONS)[number][0];

/** A point on the mat in percent of its width and height, each 0..100. */
export type PathPoint = { x: number; y: number };

/** Whole seconds with 0 <= bestSec <= worstSec <= 999. */
export type SecRange = { bestSec: number; worstSec: number };

export type PlannedMission = {
  id: string;
  code: MissionCode;
  /** The slot whose attachment does this mission. Its name comes from the run's loadout. */
  uses: Slot | "none";
  points: number;
  time: SecRange;
  notes: string;
};

export type ToolChange = { time: SecRange; note: string };

export type Run = {
  id: string;
  launcher: string;
  start: HomeBase;
  end: HomeBase;
  loadout: Loadout;
  missions: readonly PlannedMission[];
  path: readonly PathPoint[];
  /** The stop in home before this run. Not shown or counted for the first run; kept so a reorder never loses it. */
  toolChange: ToolChange;
};

/** Shared snapshot state: never mutate. reducePlan returns new objects. */
export type MatchPlan = { runs: readonly Run[] };

export type RunPatch = Partial<{
  launcher: string;
  start: HomeBase;
  end: HomeBase;
  /** Merged slot by slot. */
  loadout: Partial<Loadout>;
  /** Replaces the whole path. `[]` clears it. */
  path: readonly PathPoint[];
}>;

export type MissionPatch = Partial<{
  uses: Slot | "none";
  points: number;
  bestSec: number;
  worstSec: number;
  notes: string;
}>;

export type ToolChangePatch = Partial<{ bestSec: number; worstSec: number; note: string }>;

export type PlanCommand =
  | { type: "addRun" }
  | { type: "removeRun"; runId: string }
  | { type: "moveRun"; runId: string; by: -1 | 1 }
  | { type: "editRun"; runId: string; patch: RunPatch }
  | { type: "addMission"; runId: string; code: MissionCode }
  | { type: "removeMission"; missionId: string }
  | { type: "moveMission"; missionId: string; by: -1 | 1 }
  | { type: "editMission"; missionId: string; patch: MissionPatch }
  /** `runId` is the run the tool change sits before. */
  | { type: "editToolChange"; runId: string; patch: ToolChangePatch }
  | { type: "reset" };

const MAX_NUMBER = 999;
const EMPTY_LOADOUT: Loadout = { front: "", rear: "", other: "" };
const NEW_TOOL_CHANGE_TIME: SecRange = { bestSec: 15, worstSec: 25 };
const NEW_MISSION_TIME: SecRange = { bestSec: 20, worstSec: 30 };

/**
 * Pure. `newId` mints the id of an added run or mission: crypto.randomUUID in the app, a counter in tests.
 *
 * Unknown ids and moves past either end return `plan` itself, so a double tap or a command that raced
 * a cross-tab update is a no-op and the store skips the save.
 *
 * A run owns the tool change before it, so moving or removing a run carries its tool change along.
 * Numbers in patches come straight from inputs; the reducer rounds and clamps them, and `retime`
 * keeps best <= worst.
 */
export function reducePlan(plan: MatchPlan, command: PlanCommand, newId: () => string): MatchPlan {
  switch (command.type) {
    case "addRun": {
      const last = plan.runs[plan.runs.length - 1];
      const home = last ? last.end : "RED";
      const run: Run = {
        id: newId(),
        launcher: "",
        start: home,
        end: home,
        loadout: last ? last.loadout : EMPTY_LOADOUT,
        missions: [],
        path: [],
        toolChange: { time: NEW_TOOL_CHANGE_TIME, note: "" },
      };
      return { runs: [...plan.runs, run] };
    }
    case "removeRun": {
      const runs = plan.runs.filter((run) => run.id !== command.runId);
      return runs.length === plan.runs.length ? plan : { runs };
    }
    case "moveRun": {
      const runs = swapNeighbors(plan.runs, plan.runs.findIndex((run) => run.id === command.runId), command.by);
      return runs === plan.runs ? plan : { runs };
    }
    case "editRun": {
      const { patch } = command;
      return updateRun(plan, command.runId, (run) => ({
        ...run,
        launcher: patch.launcher ?? run.launcher,
        start: patch.start ?? run.start,
        end: patch.end ?? run.end,
        loadout: patch.loadout ? { ...run.loadout, ...patch.loadout } : run.loadout,
        path: patch.path ? patch.path.map((point) => matPoint(point.x, point.y)) : run.path,
      }));
    }
    case "editToolChange": {
      const { patch } = command;
      return updateRun(plan, command.runId, (run) => ({
        ...run,
        toolChange: { time: retime(run.toolChange.time, patch), note: patch.note ?? run.toolChange.note },
      }));
    }
    case "addMission": {
      const mission: PlannedMission = {
        id: newId(),
        code: command.code,
        uses: "none",
        points: 0,
        time: NEW_MISSION_TIME,
        notes: "",
      };
      return updateRun(plan, command.runId, (run) => ({ ...run, missions: [...run.missions, mission] }));
    }
    case "removeMission":
      return updateMissions(plan, command.missionId, (missions, index) =>
        missions.filter((_, i) => i !== index),
      );
    case "moveMission":
      return updateMissions(plan, command.missionId, (missions, index) =>
        swapNeighbors(missions, index, command.by),
      );
    case "editMission": {
      const { patch } = command;
      return updateMissions(plan, command.missionId, (missions, index) =>
        missions.map((mission, i) =>
          i === index
            ? {
                ...mission,
                uses: patch.uses ?? mission.uses,
                points: patch.points === undefined ? mission.points : wholeNumber(patch.points),
                time: retime(mission.time, patch),
                notes: patch.notes ?? mission.notes,
              }
            : mission,
        ),
      );
    }
    case "reset":
      return SEED_PLAN;
  }
}

/**
 * The trust boundary for plan data. `json` is what JSON.parse returned from localStorage, or SEED_JSON.
 *
 * Returns null when the value is not `{ runs: [...] }`, a field has the wrong type, a home or slot is
 * unknown, a mission code is not in MISSIONS, or an id repeats. It repairs without rejecting by
 * rounding and clamping numbers to 0..999, ordering best and worst, clamping path points to 0..100,
 * and filling a missing loadout slot or note with "".
 */
export function parsePlan(json: unknown): MatchPlan | null {
  if (!isRecord(json) || !Array.isArray(json.runs)) return null;
  const runs = parseEach(json.runs, parseRun);
  if (!runs) return null;
  const ids = runs.flatMap((run) => [run.id, ...run.missions.map((mission) => mission.id)]);
  return new Set(ids).size === ids.length ? { runs } : null;
}

export const SEED_PLAN: MatchPlan = parseSeed();

function parseSeed(): MatchPlan {
  const plan = parsePlan(SEED_JSON);
  if (!plan) throw new Error("SEED_JSON is not a valid match plan");
  return plan;
}

function updateRun(plan: MatchPlan, runId: string, update: (run: Run) => Run): MatchPlan {
  const index = plan.runs.findIndex((run) => run.id === runId);
  if (index < 0) return plan;
  return { runs: plan.runs.map((run, i) => (i === index ? update(run) : run)) };
}

/** Returns `plan` itself when `update` returns the same list. */
function updateMissions(
  plan: MatchPlan,
  missionId: string,
  update: (missions: readonly PlannedMission[], index: number) => readonly PlannedMission[],
): MatchPlan {
  for (const run of plan.runs) {
    const index = run.missions.findIndex((mission) => mission.id === missionId);
    if (index < 0) continue;
    const missions = update(run.missions, index);
    return missions === run.missions ? plan : updateRun(plan, run.id, () => ({ ...run, missions }));
  }
  return plan;
}

/** Returns `items` itself when either index is out of range. */
function swapNeighbors<T>(items: readonly T[], index: number, by: -1 | 1): readonly T[] {
  const target = index + by;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function wholeNumber(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_NUMBER, Math.max(0, Math.round(value))) : 0;
}

function percent(value: number): number {
  return Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value)) * 10) / 10 : 0;
}

function matPoint(x: number, y: number): PathPoint {
  return { x: percent(x), y: percent(y) };
}

function secRange(bestSec: number, worstSec: number): SecRange {
  const a = wholeNumber(bestSec);
  const b = wholeNumber(worstSec);
  return { bestSec: Math.min(a, b), worstSec: Math.max(a, b) };
}

/** The edited end wins. Raising best past worst lifts worst, and lowering worst under best drops best. */
function retime(range: SecRange, patch: { bestSec?: number; worstSec?: number }): SecRange {
  const { bestSec, worstSec } = patch;
  if (bestSec !== undefined && worstSec !== undefined) return secRange(bestSec, worstSec);
  if (bestSec !== undefined) {
    const best = wholeNumber(bestSec);
    return { bestSec: best, worstSec: Math.max(best, range.worstSec) };
  }
  if (worstSec !== undefined) {
    const worst = wholeNumber(worstSec);
    return { bestSec: Math.min(range.bestSec, worst), worstSec: worst };
  }
  return range;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return (options as readonly unknown[]).includes(value);
}

function isMissionCode(value: unknown): value is MissionCode {
  return MISSIONS.some(([code]) => code === value);
}

function parseEach<T>(items: readonly unknown[], parse: (raw: unknown) => T | null): T[] | null {
  const parsed: T[] = [];
  for (const raw of items) {
    const item = parse(raw);
    if (item === null) return null;
    parsed.push(item);
  }
  return parsed;
}

/** A missing note reads as "". */
function optionalText(value: unknown): string | null {
  if (value === undefined) return "";
  return typeof value === "string" ? value : null;
}

function parseRun(raw: unknown): Run | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== "string" ||
    typeof raw.launcher !== "string" ||
    !isOneOf(HOMES, raw.start) ||
    !isOneOf(HOMES, raw.end) ||
    !Array.isArray(raw.missions) ||
    !Array.isArray(raw.path)
  ) {
    return null;
  }
  const loadout = parseLoadout(raw.loadout);
  const missions = parseEach(raw.missions, parseMission);
  const path = parseEach(raw.path, parsePoint);
  const toolChange = parseToolChange(raw.toolChange);
  if (!loadout || !missions || !path || !toolChange) return null;
  return { id: raw.id, launcher: raw.launcher, start: raw.start, end: raw.end, loadout, missions, path, toolChange };
}

function parseLoadout(raw: unknown): Loadout | null {
  const source = raw === undefined ? {} : raw;
  if (!isRecord(source)) return null;
  const front = optionalText(source.front);
  const rear = optionalText(source.rear);
  const other = optionalText(source.other);
  return front === null || rear === null || other === null ? null : { front, rear, other };
}

function parseMission(raw: unknown): PlannedMission | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== "string" ||
    !isMissionCode(raw.code) ||
    !(raw.uses === "none" || isOneOf(SLOTS, raw.uses)) ||
    typeof raw.points !== "number"
  ) {
    return null;
  }
  const time = parseSecRange(raw.time);
  const notes = optionalText(raw.notes);
  if (!time || notes === null) return null;
  return { id: raw.id, code: raw.code, uses: raw.uses, points: wholeNumber(raw.points), time, notes };
}

function parseToolChange(raw: unknown): ToolChange | null {
  if (!isRecord(raw)) return null;
  const time = parseSecRange(raw.time);
  const note = optionalText(raw.note);
  return time && note !== null ? { time, note } : null;
}

function parseSecRange(raw: unknown): SecRange | null {
  if (!isRecord(raw) || typeof raw.bestSec !== "number" || typeof raw.worstSec !== "number") return null;
  return secRange(raw.bestSec, raw.worstSec);
}

function parsePoint(raw: unknown): PathPoint | null {
  if (!isRecord(raw) || typeof raw.x !== "number" || typeof raw.y !== "number") return null;
  return matPoint(raw.x, raw.y);
}
