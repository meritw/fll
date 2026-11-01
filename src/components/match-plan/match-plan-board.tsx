"use client";

import { ArrowDown, ArrowRight, ArrowUp, Eraser, Plus, RotateCcw, Route, Timer, Wrench } from "lucide-react";
import { cn } from "cn";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  attachmentChips,
  formatMatchClock,
  HOME_ANCHORS,
  MAT_HEIGHT,
  MAT_SRC,
  MAT_WIDTH,
  MATCH_PLAN_STORAGE_KEY,
  MISSION_PIN_EXTRAS,
  MISSION_PINS,
  planTotals,
  runPoints,
  SEED_MATCH_PLAN,
  type HomeBase,
  type MatchPlan,
  type MissionStep,
  type PathPoint,
  type PlanStep,
  type PlanTotals,
  type RunStep,
  type ToolChangeStep,
} from "@/lib/match-plan";
import { missionCode } from "@/lib/mission-status";

type Shift = -1 | 1;

type PlanEdit =
  | { type: "moveStep"; stepId: string; by: Shift }
  | { type: "moveMission"; runId: string; missionId: string; by: Shift }
  | { type: "addRun"; runId: string }
  | { type: "drawTo"; runId: string; point: PathPoint }
  | { type: "setPath"; runId: string; path: PathPoint[] }
  | { type: "reset" };

const RUN_COLORS = ["#e85d4c", "#1f8a7a", "#c48a1a", "#2f6fe4", "#3e7a4b", "#b4477a"];

/** Pointer samples closer than this (in mat %) are dropped so a stroke stays small in storage. */
const MIN_STROKE_STEP = 0.4;

const HOME_PILL: Record<HomeBase, string> = {
  RED: "bg-red-600 text-white",
  BLUE: "bg-blue-600 text-white",
};

const PIN_SPOTS = [
  ...Object.entries(MISSION_PINS).map(([code, point]) => ({ code: Number(code), point })),
  ...Object.entries(MISSION_PIN_EXTRAS).flatMap(([code, points]) =>
    points.map((point) => ({ code: Number(code), point })),
  ),
];

const MOVE_BUTTON =
  "inline-flex size-9 items-center justify-center rounded-lg bg-muted text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:hover:bg-muted";
const TOOL_BUTTON =
  "inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-card px-3 text-base font-semibold ring-1 ring-line hover:bg-muted disabled:opacity-40";

function isRun(step: PlanStep): step is RunStep {
  return step.kind === "run";
}

function shiftItem<T>(items: T[], index: number, by: Shift): T[] {
  const target = index + by;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function updateRun(plan: MatchPlan, runId: string, update: (run: RunStep) => RunStep): MatchPlan {
  return {
    ...plan,
    steps: plan.steps.map((step) => (step.kind === "run" && step.id === runId ? update(step) : step)),
  };
}

function editPlan(plan: MatchPlan, edit: PlanEdit): MatchPlan {
  switch (edit.type) {
    case "moveStep":
      return {
        ...plan,
        steps: shiftItem(plan.steps, plan.steps.findIndex((step) => step.id === edit.stepId), edit.by),
      };
    case "moveMission":
      return updateRun(plan, edit.runId, (run) => ({
        ...run,
        missions: shiftItem(
          run.missions,
          run.missions.findIndex((mission) => mission.id === edit.missionId),
          edit.by,
        ),
      }));
    case "addRun": {
      const count = plan.steps.filter(isRun).length;
      const run: RunStep = {
        kind: "run",
        id: edit.runId,
        label: `Run ${count + 1}`,
        color: RUN_COLORS[count % RUN_COLORS.length],
        launcher: "",
        start: "RED",
        end: "RED",
        path: [],
        missions: [],
      };
      return { ...plan, steps: [...plan.steps, run] };
    }
    case "drawTo":
      return updateRun(plan, edit.runId, (run) => {
        const last = run.path.at(-1);
        const tooClose =
          last && Math.hypot(last.x - edit.point.x, last.y - edit.point.y) < MIN_STROKE_STEP;
        return tooClose ? run : { ...run, path: [...run.path, edit.point] };
      });
    case "setPath":
      return updateRun(plan, edit.runId, (run) => ({ ...run, path: edit.path }));
    case "reset":
      return SEED_MATCH_PLAN;
  }
}

const listeners = new Set<() => void>();
let currentPlan: MatchPlan | null = null;

function isMatchPlan(value: unknown): value is MatchPlan {
  const plan = value as Partial<MatchPlan> | null;
  return (
    typeof plan?.matchSec === "number" &&
    Array.isArray(plan.steps) &&
    plan.steps.every(
      (step) =>
        step?.kind === "tool" ||
        (step?.kind === "run" && Array.isArray(step.missions) && Array.isArray(step.path)),
    )
  );
}

function readPlan(): MatchPlan {
  if (currentPlan) return currentPlan;
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(MATCH_PLAN_STORAGE_KEY) ?? "null");
    currentPlan = isMatchPlan(saved) ? saved : SEED_MATCH_PLAN;
  } catch {
    currentPlan = SEED_MATCH_PLAN;
  }
  return currentPlan;
}

function applyEdit(edit: PlanEdit) {
  currentPlan = editPlan(readPlan(), edit);
  try {
    window.localStorage.setItem(MATCH_PLAN_STORAGE_KEY, JSON.stringify(currentPlan));
  } catch {
    // Private mode blocks storage; the plan still works for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function seedPlan() {
  return SEED_MATCH_PLAN;
}

export function MatchPlanBoard() {
  const plan = useSyncExternalStore(subscribe, readPlan, seedPlan);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);

  const runs = plan.steps.filter(isRun);
  const activeRun = runs.find((run) => run.id === activeRunId) ?? runs.at(0);
  const selectedCode = runs
    .flatMap((run) => run.missions)
    .find((mission) => mission.id === selectedMissionId)?.code;

  function selectMission(run: RunStep, mission: MissionStep) {
    setActiveRunId(run.id);
    setSelectedMissionId(mission.id);
  }

  function addRun() {
    const runId = `r${Date.now().toString(36)}`;
    applyEdit({ type: "addRun", runId });
    setActiveRunId(runId);
  }

  function reset() {
    if (!window.confirm("Reset to the sample plan? Your runs and paths will be replaced.")) return;
    applyEdit({ type: "reset" });
    setActiveRunId(null);
    setSelectedMissionId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <MatchClock matchSec={plan.matchSec} totals={planTotals(plan)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section aria-labelledby="runs-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="runs-heading" className="text-2xl font-semibold">
              Runs
            </h2>
            <button
              type="button"
              onClick={addRun}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-present px-4 text-base font-semibold text-present-tint hover:bg-present/90"
            >
              <Plus className="size-5" aria-hidden />
              Add run
            </button>
          </div>

          <ol className="flex flex-col gap-3">
            {plan.steps.map((step, index) => (
              <li key={step.id}>
                {step.kind === "run" ? (
                  <RunCard
                    run={step}
                    index={index}
                    stepCount={plan.steps.length}
                    active={step.id === activeRun?.id}
                    selectedMissionId={selectedMissionId}
                    onActivate={() => setActiveRunId(step.id)}
                    onSelectMission={(mission) => selectMission(step, mission)}
                  />
                ) : (
                  <ToolRow tool={step} index={index} stepCount={plan.steps.length} />
                )}
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="size-4" aria-hidden />
            Reset to sample
          </button>
        </section>

        <MatPanel
          runs={runs}
          activeRun={activeRun}
          selectedCode={selectedCode}
          onPickMission={selectMission}
        />
      </div>
    </div>
  );
}

function MatchClock({ matchSec, totals }: { matchSec: number; totals: PlanTotals }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-background px-4 py-2">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-2xl bg-card px-4 py-3 ring-1 ring-line">
        <span className="flex items-baseline gap-1.5">
          <span className="text-base text-muted-foreground">Match</span>
          <span className="font-mono text-xl font-bold tabular-nums">{formatMatchClock(matchSec)}</span>
        </span>
        <ClockTime label="Best" usedSec={totals.bestSec} matchSec={matchSec} />
        <ClockTime label="Worst" usedSec={totals.worstSec} matchSec={matchSec} />
        <span className="ml-auto flex items-baseline gap-1.5">
          <span className="font-mono text-xl font-bold tabular-nums">{totals.points}</span>
          <span className="text-base text-muted-foreground">pts</span>
        </span>
      </div>
    </div>
  );
}

function ClockTime({ label, usedSec, matchSec }: { label: string; usedSec: number; matchSec: number }) {
  const leftSec = matchSec - usedSec;
  const over = leftSec < 0;
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-base text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xl font-bold tabular-nums", over && "text-destructive")}>
        {formatMatchClock(usedSec)}
      </span>
      <span className={cn("text-base font-semibold", over ? "text-destructive" : "text-present-ink")}>
        {over ? `${formatMatchClock(-leftSec)} over` : `${formatMatchClock(leftSec)} left`}
      </span>
    </span>
  );
}

function MoveButtons({
  label,
  canUp,
  canDown,
  onMove,
}: {
  label: string;
  canUp: boolean;
  canDown: boolean;
  onMove: (by: Shift) => void;
}) {
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={!canUp}
        onClick={() => onMove(-1)}
        className={MOVE_BUTTON}
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={!canDown}
        onClick={() => onMove(1)}
        className={MOVE_BUTTON}
      >
        <ArrowDown className="size-4" aria-hidden />
      </button>
    </span>
  );
}

function HomePill({ home }: { home: HomeBase }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold tracking-wide", HOME_PILL[home])}>
      {home}
    </span>
  );
}

function RunCard({
  run,
  index,
  stepCount,
  active,
  selectedMissionId,
  onActivate,
  onSelectMission,
}: {
  run: RunStep;
  index: number;
  stepCount: number;
  active: boolean;
  selectedMissionId: string | null;
  onActivate: () => void;
  onSelectMission: (mission: MissionStep) => void;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl bg-card",
        active ? "ring-2 ring-present" : "ring-1 ring-line",
      )}
    >
      <div className="flex items-center gap-2 border-b border-line py-2 pr-2 pl-3">
        <button
          type="button"
          aria-pressed={active}
          onClick={onActivate}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 text-left"
        >
          <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: run.color }} aria-hidden />
          <span className="text-lg font-semibold">
            {run.label}
            {run.launcher ? ` · ${run.launcher}` : ""}
          </span>
          <span className="rounded-md bg-present-tint px-2 py-0.5 text-base font-bold text-present-ink tabular-nums">
            {runPoints(run)} pts
          </span>
          <span className="flex items-center gap-1">
            <HomePill home={run.start} />
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">to</span>
            <HomePill home={run.end} />
          </span>
        </button>
        <MoveButtons
          label={run.label}
          canUp={index > 0}
          canDown={index < stepCount - 1}
          onMove={(by) => applyEdit({ type: "moveStep", stepId: run.id, by })}
        />
      </div>

      {run.missions.length === 0 ? (
        <p className="px-4 py-3 text-base text-muted-foreground">No missions yet</p>
      ) : (
        <ul className="divide-y divide-line">
          {run.missions.map((mission, missionIndex) => {
            const selected = mission.id === selectedMissionId;
            const chips = attachmentChips(mission);
            return (
              <li
                key={mission.id}
                className={cn("flex items-center gap-3 py-2.5 pr-2 pl-3", selected && "bg-brand-soft")}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectMission(mission)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left"
                >
                  <span className="text-lg leading-snug font-semibold">
                    <span className="font-mono text-base font-normal text-muted-foreground">
                      {missionCode(mission.code)}
                    </span>{" "}
                    {mission.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {chips.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No attachment</span>
                    ) : (
                      chips.map((chip) => (
                        <span
                          key={chip.slot}
                          className="inline-flex items-center gap-1 rounded-md bg-present-tint px-1.5 py-0.5 text-sm font-semibold text-present-ink ring-1 ring-present/25"
                        >
                          <span className="text-[0.7rem] tracking-wide uppercase opacity-75">{chip.slot}</span>
                          {chip.name}
                        </span>
                      ))
                    )}
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
                      <Timer className="size-3.5" aria-hidden />
                      {mission.bestSec}–{mission.worstSec}s
                    </span>
                  </span>
                </button>
                <span className="flex min-w-14 shrink-0 flex-col items-center rounded-xl bg-present-ink px-2 py-1.5 text-present-tint">
                  <span className="text-2xl leading-none font-bold tabular-nums">{mission.points}</span>
                  <span className="text-[0.65rem] font-semibold tracking-wide uppercase">pts</span>
                </span>
                <MoveButtons
                  label={`${missionCode(mission.code)} ${mission.name}`}
                  canUp={missionIndex > 0}
                  canDown={missionIndex < run.missions.length - 1}
                  onMove={(by) =>
                    applyEdit({ type: "moveMission", runId: run.id, missionId: mission.id, by })
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function ToolRow({ tool, index, stepCount }: { tool: ToolChangeStep; index: number; stepCount: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-muted/60 py-2 pr-2 pl-3">
      <Wrench className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 text-base">
        <span className="font-semibold">Tool change</span> · {tool.note}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums">
        <Timer className="size-3.5" aria-hidden />
        {tool.bestSec}–{tool.worstSec}s
      </span>
      <MoveButtons
        label="tool change"
        canUp={index > 0}
        canDown={index < stepCount - 1}
        onMove={(by) => applyEdit({ type: "moveStep", stepId: tool.id, by })}
      />
    </div>
  );
}

function pointFrom(event: React.PointerEvent<HTMLCanvasElement>): PathPoint {
  const box = event.currentTarget.getBoundingClientRect();
  const percent = (offset: number, size: number) =>
    Math.round(Math.min(100, Math.max(0, (offset / size) * 100)) * 10) / 10;
  return { x: percent(event.clientX - box.left, box.width), y: percent(event.clientY - box.top, box.height) };
}

function MatPanel({
  runs,
  activeRun,
  selectedCode,
  onPickMission,
}: {
  runs: RunStep[];
  activeRun: RunStep | undefined;
  selectedCode: number | undefined;
  onPickMission: (run: RunStep, mission: MissionStep) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const paint = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const toPixels = (point: PathPoint) => [(point.x / 100) * width, (point.y / 100) * height] as const;
      const trace = (path: PathPoint[]) => {
        ctx.beginPath();
        path.forEach((point, i) => {
          const [x, y] = toPixels(point);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      };

      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 3.5;
      for (const run of runs) {
        if (run === activeRun) continue;
        ctx.strokeStyle = run.color;
        trace(run.path);
        ctx.stroke();
      }

      const end = activeRun?.path.at(-1);
      if (!activeRun || !end) return;
      ctx.globalAlpha = 1;
      trace(activeRun.path);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = activeRun.color;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      const [x, y] = toPixels(end);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = activeRun.color;
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [runs, activeRun]);

  const planned = new Map<number, { run: RunStep; mission: MissionStep }>();
  for (const run of runs) {
    for (const mission of run.missions) {
      if (!planned.has(mission.code)) planned.set(mission.code, { run, mission });
    }
  }
  const pins = PIN_SPOTS.flatMap((spot) => {
    const hit = planned.get(spot.code);
    return hit ? [{ ...spot, ...hit }] : [];
  });

  return (
    <section aria-label="Mat" className="flex flex-col gap-2 lg:sticky lg:top-24">
      <div className="flex flex-wrap items-center gap-2">
        {activeRun ? (
          <span className="mr-auto flex items-center gap-2 text-base">
            <span className="text-muted-foreground">Drawing</span>
            <span className="size-3.5 rounded-full" style={{ backgroundColor: activeRun.color }} aria-hidden />
            <span className="font-semibold">{activeRun.label}</span>
          </span>
        ) : (
          <span className="mr-auto text-base text-muted-foreground">Add a run to draw</span>
        )}
        <button
          type="button"
          disabled={!activeRun}
          onClick={() => activeRun && applyEdit({ type: "setPath", runId: activeRun.id, path: [] })}
          className={TOOL_BUTTON}
        >
          <Eraser className="size-4" aria-hidden />
          Clear path
        </button>
        <button
          type="button"
          disabled={!activeRun}
          onClick={() =>
            activeRun &&
            applyEdit({
              type: "setPath",
              runId: activeRun.id,
              path: [
                HOME_ANCHORS[activeRun.start],
                ...activeRun.missions.map((mission) => MISSION_PINS[mission.code]).filter(Boolean),
                HOME_ANCHORS[activeRun.end],
              ],
            })
          }
          className={TOOL_BUTTON}
        >
          <Route className="size-4" aria-hidden />
          Sample path
        </button>
      </div>

      <div
        className="relative touch-none overflow-hidden rounded-2xl bg-header ring-1 ring-line select-none"
        style={{ aspectRatio: `${MAT_WIDTH} / ${MAT_HEIGHT}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static mat art sized by its wrapper */}
        <img
          src={MAT_SRC}
          width={MAT_WIDTH}
          height={MAT_HEIGHT}
          alt="Official BioGlow mat. Red home on the left, blue home on the right."
          draggable={false}
          className="pointer-events-none absolute inset-0 size-full"
        />
        <canvas
          ref={canvasRef}
          aria-label={activeRun ? `Draw the path for ${activeRun.label}` : undefined}
          className="absolute inset-0 size-full cursor-crosshair"
          onPointerDown={(event) => {
            if (!activeRun || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            applyEdit({ type: "drawTo", runId: activeRun.id, point: pointFrom(event) });
          }}
          onPointerMove={(event) => {
            if (!activeRun || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            applyEdit({ type: "drawTo", runId: activeRun.id, point: pointFrom(event) });
          }}
        />
        {pins.map(({ code, point, run, mission }) => {
          const label = `${missionCode(code)} ${mission.name}`;
          return (
            <button
              key={`${code}-${point.x}-${point.y}`}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={code === selectedCode}
              onClick={() => onPickMission(run, mission)}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              className={cn(
                "absolute aspect-square w-[4.4%] -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring",
                code === selectedCode
                  ? "ring-3 ring-present ring-offset-2 ring-offset-white"
                  : "hover:ring-2 hover:ring-white/90",
              )}
            />
          );
        })}
      </div>
    </section>
  );
}
