import { ArrowRight, Pencil, Plus, Route, Timer, Trash2 } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  HOMES,
  SLOTS,
  type HomeBase,
  type Loadout,
  type MissionCode,
  type MissionPatch,
  type RunPatch,
  type Slot,
} from "@/lib/match-plan/plan";
import type { PlanDispatch } from "@/lib/match-plan/sync";
import { SLOT_LABELS, type AttachmentChip, type MissionLineView, type RunView } from "@/lib/match-plan/view";

import { FIELD_CLASS, HOME_CLASSES, HomePill, MoveButtons, NumberField } from "./controls";
import { MissionPicker } from "./mission-picker";

const SLOT_CLASSES: Record<Slot, string> = {
  front: "bg-info-tint text-info-ink",
  rear: "bg-present-tint text-present-ink",
  other: "bg-brand-tint text-brand-dark",
};

const USES = [...SLOTS, "none"] as const;

const USE_CLASSES: Record<Slot | "none", string> = { ...SLOT_CLASSES, none: "bg-muted text-foreground" };

const ACTION_BUTTON = "h-11 px-3 text-base";

type RunCardProps = {
  view: RunView;
  runs: RunView[];
  selected: boolean;
  startEditing: boolean;
  onSelect: () => void;
  onShowPath: () => void;
  dispatch: PlanDispatch;
};

export function RunCard({ view, runs, selected, startEditing, onSelect, onShowPath, dispatch }: RunCardProps) {
  const { run, number, color, points, missions } = view;
  const [editing, setEditing] = useState(startEditing);
  const [openMissionId, setOpenMissionId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const title = run.launcher ? `Run ${number} · ${run.launcher}` : `Run ${number}`;

  function pick(code: MissionCode) {
    setOpenMissionId(dispatch({ type: "addMission", runId: run.id, code }));
    setPicking(false);
  }

  return (
    <article
      id={`run-${run.id}`}
      aria-label={title}
      onClickCapture={onSelect}
      className="scroll-mt-28 overflow-hidden rounded-2xl border-l-8 bg-card ring-1 ring-line"
      style={{ borderLeftColor: color, boxShadow: selected ? `0 0 0 3px ${color}` : undefined }}
    >
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 text-xl leading-tight font-semibold break-words">{title}</h3>
          <span className="shrink-0 rounded-lg bg-muted px-2 py-0.5 text-base font-bold tabular-nums">{points} pts</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5">
            <HomePill home={run.start} />
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">to</span>
            <HomePill home={run.end} />
          </span>
          <span className="ml-auto flex gap-2">
            <Button variant="outline" aria-pressed={selected} className={ACTION_BUTTON} onClick={onShowPath}>
              <Route className="size-5" aria-hidden />
              Path
            </Button>
            <Button
              variant={editing ? "secondary" : "outline"}
              aria-expanded={editing}
              className={ACTION_BUTTON}
              onClick={() => setEditing(!editing)}
            >
              <Pencil className="size-5" aria-hidden />
              Edit
            </Button>
          </span>
        </div>
        <LoadoutChips loadout={run.loadout} />
      </div>

      {editing ? (
        <RunEditor view={view} runCount={runs.length} dispatch={dispatch} onDone={() => setEditing(false)} />
      ) : null}

      {missions.length === 0 ? (
        <p className="border-t border-line px-3 py-3 text-base text-muted-foreground">
          Add a mission to plan this run.
        </p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {missions.map((line, index) => (
            <MissionLine
              key={line.mission.id}
              line={line}
              index={index}
              count={missions.length}
              loadout={run.loadout}
              open={openMissionId === line.mission.id}
              onToggle={() => setOpenMissionId(openMissionId === line.mission.id ? null : line.mission.id)}
              dispatch={dispatch}
            />
          ))}
        </ul>
      )}

      <div className="border-t border-line p-3">
        {picking ? (
          <MissionPicker runs={runs} onPick={pick} onClose={() => setPicking(false)} />
        ) : (
          <Button variant="outline" className="h-11 w-full text-base" onClick={() => setPicking(true)}>
            <Plus className="size-5" aria-hidden />
            <span className="sr-only">Add</span> Mission
          </Button>
        )}
      </div>
    </article>
  );
}

function LoadoutChips({ loadout }: { loadout: Loadout }) {
  const named = SLOTS.filter((slot) => loadout[slot]);
  if (named.length === 0) {
    return <p className="text-sm text-muted-foreground">No tools named yet. Tap Edit to add them.</p>;
  }
  return (
    <ul aria-label="Tools on the robot" className="flex flex-wrap gap-1.5">
      {named.map((slot) => (
        <li key={slot} className="min-w-0">
          <SlotChip slot={slot} name={loadout[slot]} />
        </li>
      ))}
    </ul>
  );
}

function SlotChip({ slot, name }: AttachmentChip) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm font-semibold",
        SLOT_CLASSES[slot],
      )}
    >
      <span className="text-xs tracking-wide uppercase opacity-80">{SLOT_LABELS[slot]}</span>
      <span className={cn("truncate", !name && "font-normal italic opacity-80")}>{name || "name it"}</span>
    </span>
  );
}

function PointsBadge({ points }: { points: number }) {
  return (
    <span className="flex min-w-14 shrink-0 flex-col items-center rounded-xl bg-foreground px-2 py-1.5 text-background">
      <span className="text-2xl leading-none font-bold tabular-nums">{points}</span>
      <span className="text-xs font-semibold tracking-wide uppercase">pts</span>
    </span>
  );
}

function MissionLine({
  line,
  index,
  count,
  loadout,
  open,
  onToggle,
  dispatch,
}: {
  line: MissionLineView;
  index: number;
  count: number;
  loadout: Loadout;
  open: boolean;
  onToggle: () => void;
  dispatch: PlanDispatch;
}) {
  const { mission, codeLabel, name, attachment } = line;
  return (
    <li className={cn(open && "bg-muted/60")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-lg leading-snug font-semibold">
            <span className="font-mono text-base font-medium text-muted-foreground">{codeLabel}</span> {name}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {attachment ? (
              <SlotChip {...attachment} />
            ) : (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-sm font-semibold text-muted-foreground">
                No tool
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
              <Timer className="size-3.5" aria-hidden />
              {mission.time.bestSec}–{mission.time.worstSec}s
            </span>
          </span>
        </span>
        <PointsBadge points={mission.points} />
      </button>
      {open ? (
        <MissionEditor line={line} index={index} count={count} loadout={loadout} dispatch={dispatch} onDone={onToggle} />
      ) : null}
    </li>
  );
}

function MissionEditor({
  line,
  index,
  count,
  loadout,
  dispatch,
  onDone,
}: {
  line: MissionLineView;
  index: number;
  count: number;
  loadout: Loadout;
  dispatch: PlanDispatch;
  onDone: () => void;
}) {
  const { mission, codeLabel } = line;
  const edit = (patch: MissionPatch) => dispatch({ type: "editMission", missionId: mission.id, patch });
  return (
    <div className="flex flex-col gap-4 px-3 pt-1 pb-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-base font-medium">Points</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            aria-label="5 fewer points"
            className="h-11 w-14 bg-card text-lg"
            onClick={() => edit({ points: mission.points - 5 })}
          >
            −5
          </Button>
          <NumberField
            aria-label="Points"
            value={mission.points}
            onValue={(points) => edit({ points })}
            className="w-20 text-center text-xl font-bold md:text-xl"
          />
          <Button
            variant="outline"
            aria-label="5 more points"
            className="h-11 w-14 bg-card text-lg"
            onClick={() => edit({ points: mission.points + 5 })}
          >
            +5
          </Button>
        </div>
      </div>

      <fieldset className="flex flex-col">
        <legend className="mb-1.5 text-base font-medium">Attachment</legend>
        <div className="grid grid-cols-4 gap-2">
          {USES.map((uses) => {
            const chosen = mission.uses === uses;
            return (
              <button
                key={uses}
                type="button"
                aria-pressed={chosen}
                onClick={() => edit({ uses })}
                className={cn(
                  "flex min-h-14 min-w-0 flex-col items-center justify-center rounded-xl px-1 py-1.5",
                  chosen ? cn(USE_CLASSES[uses], "ring-2 ring-current") : "bg-card ring-1 ring-line hover:bg-muted",
                )}
              >
                <span className="text-base font-semibold">{uses === "none" ? "None" : SLOT_LABELS[uses]}</span>
                <span className="w-full truncate text-center text-xs">
                  {uses === "none" ? "No tool" : loadout[uses] || "not named"}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-base font-medium">
          Best seconds
          <NumberField value={mission.time.bestSec} onValue={(bestSec) => edit({ bestSec })} />
        </label>
        <label className="flex flex-col gap-1.5 text-base font-medium">
          Worst seconds
          <NumberField value={mission.time.worstSec} onValue={(worstSec) => edit({ worstSec })} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-base font-medium">
        Notes
        <Textarea
          value={mission.notes}
          onChange={(event) => edit({ notes: event.target.value })}
          placeholder="Anything to remember?"
          className="min-h-11 bg-card text-base font-normal md:text-base dark:bg-input/30"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <MoveButtons
          label={codeLabel}
          canUp={index > 0}
          canDown={index < count - 1}
          onMove={(by) => dispatch({ type: "moveMission", missionId: mission.id, by })}
        />
        <Button
          variant="destructive"
          className={ACTION_BUTTON}
          onClick={() => dispatch({ type: "removeMission", missionId: mission.id })}
        >
          <Trash2 className="size-5" aria-hidden />
          Remove<span className="sr-only"> {codeLabel}</span>
        </Button>
        <Button className="ml-auto h-11 px-5 text-base" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function RunEditor({
  view,
  runCount,
  dispatch,
  onDone,
}: {
  view: RunView;
  runCount: number;
  dispatch: PlanDispatch;
  onDone: () => void;
}) {
  const { run, number } = view;
  const edit = (patch: RunPatch) => dispatch({ type: "editRun", runId: run.id, patch });

  function remove() {
    if (window.confirm(`Remove Run ${number} and its missions?`)) dispatch({ type: "removeRun", runId: run.id });
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line bg-muted/60 p-3">
      <label className="flex flex-col gap-1.5 text-base font-medium">
        Who launches?
        <Input
          value={run.launcher}
          onChange={(event) => edit({ launcher: event.target.value })}
          placeholder="Name"
          className={cn(FIELD_CLASS, "font-normal")}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <HomeChoice label="Starts in" value={run.start} onChange={(start) => edit({ start })} />
        <HomeChoice label="Ends in" value={run.end} onChange={(end) => edit({ end })} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-base font-medium">Tools on the robot</legend>
        {SLOTS.map((slot) => (
          <label key={slot} className="flex items-center gap-2">
            <span
              className={cn(
                "w-16 shrink-0 rounded-md px-1.5 py-1 text-center text-xs font-semibold tracking-wide uppercase",
                SLOT_CLASSES[slot],
              )}
            >
              {SLOT_LABELS[slot]}
            </span>
            <Input
              value={run.loadout[slot]}
              onChange={(event) => edit({ loadout: { [slot]: event.target.value } })}
              placeholder="Nothing"
              className={FIELD_CLASS}
            />
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <MoveButtons
          label={`Run ${number}`}
          canUp={number > 1}
          canDown={number < runCount}
          onMove={(by) => dispatch({ type: "moveRun", runId: run.id, by })}
        />
        <Button variant="destructive" className={ACTION_BUTTON} onClick={remove}>
          <Trash2 className="size-5" aria-hidden />
          Remove run
        </Button>
        <Button className="ml-auto h-11 px-5 text-base" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function HomeChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HomeBase;
  onChange: (home: HomeBase) => void;
}) {
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-1.5 text-base font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-1.5">
        {HOMES.map((home) => (
          <button
            key={home}
            type="button"
            aria-pressed={value === home}
            onClick={() => onChange(home)}
            className={cn(
              "min-h-11 rounded-lg text-sm font-bold tracking-wide",
              value === home ? HOME_CLASSES[home] : "bg-card text-muted-foreground ring-1 ring-line hover:bg-muted",
            )}
          >
            {home}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
