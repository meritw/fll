import { MISSIONS } from "@/lib/missions";

import { SEED_JSON } from "./seed";

export const MATCH_SEC = 150;

export const HOMES = ["RED", "BLUE"] as const;
export type HomeBase = (typeof HOMES)[number];

export const SLOTS = ["front", "rear", "other"] as const;
export type Slot = (typeof SLOTS)[number];

export type Loadout = Readonly<Record<Slot, string>>;

export type MissionCode = (typeof MISSIONS)[number][0];

export type PathPoint = Readonly<{ x: number; y: number }>;

export type SecRange = Readonly<{ bestSec: number; worstSec: number }>;

export type PlannedMission = Readonly<{
  id: string;
  code: MissionCode;
  uses: Slot | "none";
  points: number;
  time: SecRange;
  notes: string;
}>;

export type ToolChange = Readonly<{ time: SecRange; note: string }>;

export type Run = Readonly<{
  id: string;
  launcher: string;
  start: HomeBase;
  end: HomeBase;
  loadout: Loadout;
  missions: readonly PlannedMission[];
  path: readonly PathPoint[];
  toolChangeBefore: ToolChange;
}>;

export type MatchPlan = Readonly<{ runs: readonly Run[] }>;

export type RunPatch = Partial<{
  launcher: string;
  start: HomeBase;
  end: HomeBase;
  loadout: Partial<Loadout>;
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
  | { type: "editToolChange"; runId: string; patch: ToolChangePatch }
  | { type: "reset" };

export type Anchor = Readonly<{ before: string }> | Readonly<{ after: string }>;

/** The neighbors a moved item lands next to, the one it jumped over first. The first one still there decides. */
export type Place = readonly [Anchor] | readonly [Anchor, Anchor];

export type PlanOp =
  | Readonly<{ type: "addRun"; runId: string }>
  | Readonly<{ type: "removeRun"; runId: string }>
  | Readonly<{ type: "moveRun"; runId: string; to: Place }>
  | Readonly<{ type: "editRun"; runId: string; patch: RunPatch }>
  | Readonly<{ type: "addMission"; runId: string; missionId: string; code: MissionCode }>
  | Readonly<{ type: "removeMission"; missionId: string }>
  | Readonly<{ type: "moveMission"; missionId: string; to: Place }>
  | Readonly<{ type: "editMission"; missionId: string; patch: MissionPatch }>
  | Readonly<{ type: "editToolChange"; runId: string; patch: ToolChangePatch }>
  | Readonly<{ type: "reset" }>;

export const TEXT_LIMITS = { launcher: 40, slot: 40, notes: 500, note: 200 } as const;
export const MAX_PATH_POINTS = 2000;
export const MAX_OPS_PER_SAVE = 500;
const MAX_ID_LENGTH = 64;

const MAX_NUMBER = 999;
const EMPTY_LOADOUT: Loadout = { front: "", rear: "", other: "" };
const NEW_TOOL_CHANGE_TIME: SecRange = { bestSec: 15, worstSec: 25 };
const NEW_MISSION_TIME: SecRange = { bestSec: 20, worstSec: 30 };

export function toOp(plan: MatchPlan, command: PlanCommand, newId: () => string): PlanOp | null {
  switch (command.type) {
    case "addRun":
      return { type: "addRun", runId: newId() };
    case "addMission":
      return { type: "addMission", runId: command.runId, missionId: newId(), code: command.code };
    case "moveRun": {
      const to = placeFor(plan.runs, command.runId, command.by);
      return to ? { type: "moveRun", runId: command.runId, to } : null;
    }
    case "moveMission": {
      const run = plan.runs.find((candidate) => candidate.missions.some((mission) => mission.id === command.missionId));
      const to = run && placeFor(run.missions, command.missionId, command.by);
      return to ? { type: "moveMission", missionId: command.missionId, to } : null;
    }
    case "removeRun":
    case "editRun":
    case "removeMission":
    case "editMission":
    case "editToolChange":
    case "reset":
      return command;
  }
}

export function reducePlan(plan: MatchPlan, command: PlanCommand, newId: () => string): MatchPlan {
  const op = toOp(plan, command, newId);
  return op ? applyOp(plan, op) : plan;
}

/** Returns the same plan reference when nothing changes, so callers can skip a write or a queue entry. */
export function applyOp(plan: MatchPlan, op: PlanOp): MatchPlan {
  switch (op.type) {
    case "addRun": {
      if (hasId(plan, op.runId)) return plan;
      const last = plan.runs[plan.runs.length - 1];
      const home = last ? last.end : "RED";
      const run: Run = {
        id: op.runId,
        launcher: "",
        start: home,
        end: home,
        loadout: last ? last.loadout : EMPTY_LOADOUT,
        missions: [],
        path: [],
        toolChangeBefore: { time: NEW_TOOL_CHANGE_TIME, note: "" },
      };
      return { runs: [...plan.runs, run] };
    }
    case "removeRun": {
      const runs = plan.runs.filter((run) => run.id !== op.runId);
      return runs.length === plan.runs.length ? plan : { runs };
    }
    case "moveRun": {
      const runs = moveTo(plan.runs, op.runId, op.to);
      return runs === plan.runs ? plan : { runs };
    }
    case "editRun": {
      const { patch } = op;
      return updateRun(plan, op.runId, (run) => {
        const launcher = patch.launcher === undefined ? run.launcher : clip(patch.launcher, TEXT_LIMITS.launcher);
        const start = patch.start ?? run.start;
        const end = patch.end ?? run.end;
        const loadout = patch.loadout ? editLoadout(run.loadout, patch.loadout) : run.loadout;
        const drawn = patch.path === undefined ? run.path : matPath(patch.path);
        const path = samePath(drawn, run.path) ? run.path : drawn;
        if (
          launcher === run.launcher &&
          start === run.start &&
          end === run.end &&
          loadout === run.loadout &&
          path === run.path
        ) {
          return run;
        }
        return { ...run, launcher, start, end, loadout, path };
      });
    }
    case "editToolChange": {
      const { patch } = op;
      return updateRun(plan, op.runId, (run) => {
        const before = run.toolChangeBefore;
        const time = editSecRange(before.time, patch);
        const note = patch.note === undefined ? before.note : clip(patch.note, TEXT_LIMITS.note);
        return time === before.time && note === before.note ? run : { ...run, toolChangeBefore: { time, note } };
      });
    }
    case "addMission": {
      if (hasId(plan, op.missionId)) return plan;
      const mission: PlannedMission = {
        id: op.missionId,
        code: op.code,
        uses: "none",
        points: 0,
        time: NEW_MISSION_TIME,
        notes: "",
      };
      return updateRun(plan, op.runId, (run) => ({ ...run, missions: [...run.missions, mission] }));
    }
    case "removeMission":
      return updateMissions(plan, op.missionId, (missions) =>
        missions.filter((mission) => mission.id !== op.missionId),
      );
    case "moveMission":
      return updateMissions(plan, op.missionId, (missions) => moveTo(missions, op.missionId, op.to));
    case "editMission": {
      const { patch } = op;
      return updateMissions(plan, op.missionId, (missions) =>
        missions.map((mission) => {
          if (mission.id !== op.missionId) return mission;
          const uses = patch.uses ?? mission.uses;
          const points = patch.points === undefined ? mission.points : wholeNumber(patch.points);
          const time = editSecRange(mission.time, patch);
          const notes = patch.notes === undefined ? mission.notes : clip(patch.notes, TEXT_LIMITS.notes);
          if (uses === mission.uses && points === mission.points && time === mission.time && notes === mission.notes) {
            return mission;
          }
          return { ...mission, uses, points, time, notes };
        }),
      );
    }
    case "reset":
      return SEED_PLAN;
  }
}

/** Ops with equal keys set exactly the same fields of the same target, so a later one replaces an earlier one. */
export function coalesceKey(op: PlanOp): string | null {
  switch (op.type) {
    case "editRun": {
      const { loadout, ...rest } = op.patch;
      const slots = loadout ? Object.keys(loadout).map((slot) => `loadout.${slot}`) : [];
      return `editRun:${op.runId}:${[...Object.keys(rest), ...slots].sort().join(",")}`;
    }
    case "editMission":
      return `editMission:${op.missionId}:${Object.keys(op.patch).sort().join(",")}`;
    case "editToolChange":
      return `editToolChange:${op.runId}:${Object.keys(op.patch).sort().join(",")}`;
    case "addRun":
    case "removeRun":
    case "moveRun":
    case "addMission":
    case "removeMission":
    case "moveMission":
    case "reset":
      return null;
  }
}

/** Checks shape only, and builds each op from known keys. Value ranges are applyOp's job. */
export function parseOps(raw: unknown): readonly PlanOp[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_OPS_PER_SAVE) return null;
  return parseEach(raw, (item) => {
    if (!isRecord(item) || typeof item.type !== "string" || !Object.hasOwn(OP_PARSERS, item.type)) return null;
    return OP_PARSERS[item.type as PlanOp["type"]](item);
  });
}

/**
 * One save. `generation` counts the resets the ops were made after, so the server can drop ops a reset
 * has since replaced. `id` lets the server recognize a resend of a batch it already applied.
 */
export type PlanBatch = Readonly<{ id: string; generation: number; ops: readonly PlanOp[] }>;

export function parseBatch(raw: unknown): PlanBatch | null {
  if (!isRecord(raw) || !isId(raw.id) || typeof raw.generation !== "number") return null;
  if (!Number.isSafeInteger(raw.generation) || raw.generation < 0) return null;
  const ops = parseOps(raw.ops);
  return ops && ops.length > 0 ? { id: raw.id, generation: raw.generation, ops } : null;
}

export function matPath(points: readonly PathPoint[]): readonly PathPoint[] {
  return points.slice(0, MAX_PATH_POINTS).map((point) => matPoint(point.x, point.y));
}

export function samePath(a: readonly PathPoint[], b: readonly PathPoint[]): boolean {
  return a.length === b.length && a.every((point, i) => point.x === b[i].x && point.y === b[i].y);
}

type OpParsers = {
  readonly [K in PlanOp["type"]]: (raw: Readonly<Record<string, unknown>>) => Extract<PlanOp, { type: K }> | null;
};

const OP_PARSERS: OpParsers = {
  addRun: (raw) => (isId(raw.runId) ? { type: "addRun", runId: raw.runId } : null),
  removeRun: (raw) => (isId(raw.runId) ? { type: "removeRun", runId: raw.runId } : null),
  moveRun: (raw) => {
    const to = parsePlace(raw.to);
    return isId(raw.runId) && to ? { type: "moveRun", runId: raw.runId, to } : null;
  },
  editRun: (raw) => {
    const patch = parsePatch(raw.patch, RUN_PATCH);
    return isId(raw.runId) && patch ? { type: "editRun", runId: raw.runId, patch } : null;
  },
  addMission: (raw) =>
    isId(raw.runId) && isId(raw.missionId) && isMissionCode(raw.code)
      ? { type: "addMission", runId: raw.runId, missionId: raw.missionId, code: raw.code }
      : null,
  removeMission: (raw) => (isId(raw.missionId) ? { type: "removeMission", missionId: raw.missionId } : null),
  moveMission: (raw) => {
    const to = parsePlace(raw.to);
    return isId(raw.missionId) && to ? { type: "moveMission", missionId: raw.missionId, to } : null;
  },
  editMission: (raw) => {
    const patch = parsePatch(raw.patch, MISSION_PATCH);
    return isId(raw.missionId) && patch ? { type: "editMission", missionId: raw.missionId, patch } : null;
  },
  editToolChange: (raw) => {
    const patch = parsePatch(raw.patch, TOOL_CHANGE_PATCH);
    return isId(raw.runId) && patch ? { type: "editToolChange", runId: raw.runId, patch } : null;
  },
  reset: () => ({ type: "reset" }),
};

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
  const run = update(plan.runs[index]);
  return run === plan.runs[index] ? plan : { runs: plan.runs.map((current, i) => (i === index ? run : current)) };
}

function updateMissions(
  plan: MatchPlan,
  missionId: string,
  update: (missions: readonly PlannedMission[]) => readonly PlannedMission[],
): MatchPlan {
  const run = plan.runs.find((candidate) => candidate.missions.some((mission) => mission.id === missionId));
  if (!run) return plan;
  const missions = update(run.missions);
  if (missions.length === run.missions.length && missions.every((mission, i) => mission === run.missions[i])) {
    return plan;
  }
  return updateRun(plan, run.id, () => ({ ...run, missions }));
}

function hasId(plan: MatchPlan, id: string): boolean {
  return plan.runs.some((run) => run.id === id || run.missions.some((mission) => mission.id === id));
}

function placeFor(items: readonly { id: string }[], id: string, by: -1 | 1): Place | null {
  const index = items.findIndex((item) => item.id === id);
  const jumped = index < 0 ? undefined : items[index + by];
  if (!jumped) return null;
  const beyond = items[index + 2 * by];
  if (by === -1) return beyond ? [{ before: jumped.id }, { after: beyond.id }] : [{ before: jumped.id }];
  return beyond ? [{ after: jumped.id }, { before: beyond.id }] : [{ after: jumped.id }];
}

function moveTo<T extends { id: string }>(items: readonly T[], id: string, to: Place): readonly T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const rest = items.filter((_, i) => i !== index);
  for (const anchor of to) {
    const at = rest.findIndex((item) => item.id === ("before" in anchor ? anchor.before : anchor.after));
    if (at < 0) continue;
    const target = "before" in anchor ? at : at + 1;
    return target === index ? items : [...rest.slice(0, target), items[index], ...rest.slice(target)];
  }
  return items;
}

function editLoadout(loadout: Loadout, patch: Partial<Loadout>): Loadout {
  const next = { ...loadout };
  for (const slot of SLOTS) {
    const name = patch[slot];
    if (name !== undefined) next[slot] = clip(name, TEXT_LIMITS.slot);
  }
  return SLOTS.every((slot) => next[slot] === loadout[slot]) ? loadout : next;
}

function clip(text: string, limit: number): string {
  if (text.length <= limit) return text;
  // jsonb rejects a lone surrogate, so never cut an emoji in half.
  const end = /[\uD800-\uDBFF]/.test(text[limit - 1]) ? limit - 1 : limit;
  return text.slice(0, end);
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

function editSecRange(range: SecRange, patch: { bestSec?: number; worstSec?: number }): SecRange {
  const next = nextSecRange(range, patch);
  return next.bestSec === range.bestSec && next.worstSec === range.worstSec ? range : next;
}

function nextSecRange(range: SecRange, { bestSec, worstSec }: { bestSec?: number; worstSec?: number }): SecRange {
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
  const toolChangeBefore = parseToolChange(raw.toolChangeBefore);
  if (!loadout || !missions || !path || !toolChangeBefore) return null;
  return {
    id: raw.id,
    launcher: raw.launcher,
    start: raw.start,
    end: raw.end,
    loadout,
    missions,
    path,
    toolChangeBefore,
  };
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

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function parsePlace(raw: unknown): Place | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 2) return null;
  const first = parseAnchor(raw[0]);
  if (!first || raw.length === 1) return first && [first];
  const second = parseAnchor(raw[1]);
  return second && [first, second];
}

function parseAnchor(raw: unknown): Anchor | null {
  if (!isRecord(raw)) return null;
  if (isId(raw.before) && raw.after === undefined) return { before: raw.before };
  if (isId(raw.after) && raw.before === undefined) return { after: raw.after };
  return null;
}

type PatchGuards<T> = { readonly [K in keyof T]-?: (value: unknown) => value is NonNullable<T[K]> };

// jsonb rejects a lone surrogate, and a batch the database can't store would be resent forever.
const isText = (value: unknown): value is string => typeof value === "string" && value.isWellFormed();
const isNumber = (value: unknown) => typeof value === "number";

const RUN_PATCH: PatchGuards<RunPatch> = {
  launcher: isText,
  start: (value) => isOneOf(HOMES, value),
  end: (value) => isOneOf(HOMES, value),
  loadout: (value): value is Partial<Loadout> =>
    isRecord(value) && Object.entries(value).every(([slot, name]) => isOneOf(SLOTS, slot) && isText(name)),
  path: (value): value is readonly PathPoint[] => Array.isArray(value) && value.every((point) => parsePoint(point)),
};

const MISSION_PATCH: PatchGuards<MissionPatch> = {
  uses: (value) => value === "none" || isOneOf(SLOTS, value),
  points: isNumber,
  bestSec: isNumber,
  worstSec: isNumber,
  notes: isText,
};

const TOOL_CHANGE_PATCH: PatchGuards<ToolChangePatch> = {
  bestSec: isNumber,
  worstSec: isNumber,
  note: isText,
};

/** Copies only the guarded keys. applyOp rebuilds loadouts and path points, so nothing nested leaks through. */
function parsePatch<T extends object>(raw: unknown, guards: PatchGuards<T>): T | null {
  if (!isRecord(raw)) return null;
  const patch: Record<string, unknown> = {};
  for (const [key, guard] of Object.entries<(value: unknown) => boolean>(guards)) {
    const value = raw[key];
    if (value === undefined) continue;
    if (!guard(value)) return null;
    patch[key] = value;
  }
  return patch as T;
}

