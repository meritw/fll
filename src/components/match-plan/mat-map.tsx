import { Eraser, Pencil, Route, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type Ref } from "react";

import { MAT_HEIGHT, MAT_SRC, MAT_WIDTH, MISSION_PIN_EXTRAS, MISSION_PINS } from "@/lib/match-plan/pins";
import type { PathPoint } from "@/lib/match-plan/plan";
import { suggestedPath, type RunView } from "@/lib/match-plan/view";

import type { PlanDispatch } from "./use-match-plan";

/** Pointer samples closer than this, in mat percent, are dropped so a stroke stays small in storage. */
const MIN_STROKE_STEP = 0.4;

/** Paths this visit replaced, newest last. Kept per run so switching runs never undoes the wrong one. */
type UndoStack = { runId: string; paths: (readonly PathPoint[])[] };

export function MatMap({
  run,
  runs,
  dispatch,
  ref,
}: {
  run: RunView | null;
  runs: RunView[];
  dispatch: PlanDispatch;
  ref: Ref<HTMLElement>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<PathPoint[]>([]);
  const [stroke, setStroke] = useState<readonly PathPoint[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoStack>({ runId: "", paths: [] });
  const undoPaths = run && undoStack.runId === run.run.id ? undoStack.paths : [];
  const drawing = drawMode && run !== null;

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
      const trace = (path: readonly PathPoint[]) => {
        ctx.beginPath();
        path.forEach((point, i) => {
          const [x, y] = toPixels(point);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      };

      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 3;
      for (const other of runs) {
        if (other.run.id === run?.run.id) continue;
        ctx.strokeStyle = other.color;
        trace(other.run.path);
        ctx.stroke();
      }

      if (!run) return;
      const path = [...run.run.path, ...stroke];
      const end = path[path.length - 1];
      if (!end) return;
      ctx.globalAlpha = 1;
      trace(path);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = run.color;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      const [x, y] = toPixels(end);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = run.color;
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [runs, run, stroke]);

  function changePath(path: readonly PathPoint[]) {
    if (!run) return;
    setUndoStack({ runId: run.run.id, paths: [...undoPaths, run.run.path] });
    dispatch({ type: "editRun", runId: run.run.id, patch: { path } });
  }

  function undo() {
    const previous = undoPaths[undoPaths.length - 1];
    if (!run || !previous) return;
    setUndoStack({ runId: run.run.id, paths: undoPaths.slice(0, -1) });
    dispatch({ type: "editRun", runId: run.run.id, patch: { path: previous } });
  }

  function setStrokePoints(points: PathPoint[]) {
    strokeRef.current = points;
    setStroke(points);
  }

  function endStroke() {
    const points = strokeRef.current;
    setStrokePoints([]);
    if (run && points.length > 0) changePath([...run.run.path, ...points]);
  }

  const pins = run
    ? [...new Set(run.run.missions.map((mission) => mission.code))].flatMap((code) =>
        [MISSION_PINS[code], ...(MISSION_PIN_EXTRAS[code] ?? [])].filter(Boolean),
      )
    : [];
  const runName = run ? (run.run.launcher ? `Run ${run.number} · ${run.run.launcher}` : `Run ${run.number}`) : "";

  return (
    <section
      ref={ref}
      aria-labelledby="mat-heading"
      className="flex scroll-mt-28 scroll-mb-4 flex-col gap-2 lg:sticky lg:top-24"
    >
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="mat-heading" className="text-2xl font-semibold">
          Path
        </h2>
        {run ? (
          <span className="flex min-w-0 items-center gap-1.5 text-lg">
            <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: run.color }} aria-hidden />
            <span className="truncate font-semibold">{runName}</span>
          </span>
        ) : (
          <span className="text-base text-muted-foreground">Add a run to draw its path</span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <MatButton icon={Pencil} pressed={drawing} disabled={!run} onClick={() => setDrawMode(!drawMode)}>
          Draw
        </MatButton>
        <MatButton icon={Undo2} disabled={undoPaths.length === 0} onClick={undo}>
          Undo
        </MatButton>
        <MatButton icon={Eraser} disabled={!run || run.run.path.length === 0} onClick={() => changePath([])}>
          Clear
        </MatButton>
        <MatButton icon={Route} disabled={!run} onClick={() => run && changePath(suggestedPath(run.run))}>
          Auto path
        </MatButton>
      </div>

      {run ? (
        <p className="text-base text-muted-foreground" aria-live="polite">
          {drawing ? "Tap or drag on the mat to add to the path." : "Turn on Draw to change the path."}
        </p>
      ) : null}

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-header select-none",
          drawing ? "touch-none ring-3 ring-foreground" : "ring-1 ring-line",
        )}
        style={{ aspectRatio: `${MAT_WIDTH} / ${MAT_HEIGHT}` }}
      >
        <Image
          src={MAT_SRC}
          alt="Official BioGlow mat. Red home on the left, blue home on the right."
          fill
          sizes="(min-width: 1024px) 600px, 100vw"
          draggable={false}
          className="pointer-events-none"
        />
        {pins.map((point) => (
          <span
            key={`${point.x}-${point.y}`}
            aria-hidden
            className="pointer-events-none absolute aspect-square w-[5.5%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              boxShadow: `0 0 0 3px ${run?.color}, 0 0 0 5px white`,
            }}
          />
        ))}
        <canvas
          ref={canvasRef}
          aria-label={drawing ? `Draw the path for ${runName}` : undefined}
          className={cn("absolute inset-0 size-full", drawing ? "cursor-crosshair" : "pointer-events-none")}
          onPointerDown={(event) => {
            if (!drawing || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setStrokePoints([toMatPoint(event)]);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const point = toMatPoint(event);
            const last = strokeRef.current[strokeRef.current.length - 1];
            if (last && Math.hypot(last.x - point.x, last.y - point.y) < MIN_STROKE_STEP) return;
            setStrokePoints([...strokeRef.current, point]);
          }}
          onPointerUp={endStroke}
          onPointerCancel={() => setStrokePoints([])}
        />
      </div>
    </section>
  );
}

/** Pointer position in mat percent. It does not clamp, because reducePlan owns the 0..100 clamp. */
function toMatPoint(event: PointerEvent<HTMLCanvasElement>): PathPoint {
  const box = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * 100,
    y: ((event.clientY - box.top) / box.height) * 100,
  };
}

function MatButton({
  icon: Icon,
  pressed,
  disabled,
  onClick,
  children,
}: {
  icon: LucideIcon;
  pressed?: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-sm font-semibold sm:flex-row sm:gap-1.5 sm:text-base",
        pressed
          ? "bg-foreground text-background"
          : "bg-card ring-1 ring-line hover:bg-muted disabled:opacity-40 disabled:hover:bg-card",
      )}
    >
      <Icon className="size-5" aria-hidden />
      {children}
    </button>
  );
}
