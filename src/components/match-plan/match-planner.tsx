"use client";

import { Plus, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { RealtimeRoot } from "@/components/realtime-root";
import { Button } from "@/components/ui/button";
import type { LivePlan } from "@/lib/match-plan/server";

import { MatMap } from "./mat-map";
import { MatchBar } from "./match-bar";
import { RunCard } from "./run-card";
import { ToolChangeRow } from "./tool-change-row";
import { useMatchPlan } from "./use-match-plan";

/** A re-render for the same query keeps the subscription. A deploy that changed the query remounts. */
export function MatchPlanner({ live }: { live: LivePlan }) {
  return (
    <RealtimeRoot key={live.sealedQuery.queryFingerprint} url={live.realtimeUrl}>
      <Planner live={live} />
    </RealtimeRoot>
  );
}

function Planner({ live }: { live: LivePlan }) {
  const { view, dispatch, status, dismissNotice } = useMatchPlan(live);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [addedRunId, setAddedRunId] = useState<string | null>(null);
  const matRef = useRef<HTMLElement>(null);

  const selected = view.runs.find((runView) => runView.run.id === selectedRunId) ?? view.runs[0] ?? null;

  function addRun() {
    const id = flushSync(() => {
      const added = dispatch({ type: "addRun" });
      setSelectedRunId(added);
      setAddedRunId(added);
      return added;
    });
    document.getElementById(`run-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showPath(runId: string) {
    setSelectedRunId(runId);
    matRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function reset() {
    if (!window.confirm("Replace the team's plan with the sample? Everyone sees it right away. This can't be undone.")) {
      return;
    }
    dispatch({ type: "reset" });
    setSelectedRunId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <MatchBar totals={view.totals} status={status} onDismissAlert={dismissNotice} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section aria-labelledby="runs-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="runs-heading" className="text-2xl font-semibold">
              Runs
            </h2>
            {view.runs.length > 0 ? (
              <Button className="h-11 px-4 text-base" onClick={addRun}>
                <Plus className="size-5" aria-hidden />
                Add run
              </Button>
            ) : null}
          </div>

          {view.runs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center">
              <p className="text-lg text-muted-foreground">No runs yet. Each run starts in a home.</p>
              <Button size="xl" onClick={addRun}>
                <Plus className="size-5" aria-hidden />
                Add your first run
              </Button>
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {view.steps.map((step) =>
                step.kind === "run" ? (
                  <li key={step.run.id}>
                    <RunCard
                      view={step}
                      runs={view.runs}
                      selected={step === selected}
                      startEditing={step.run.id === addedRunId}
                      onSelect={() => setSelectedRunId(step.run.id)}
                      onShowPath={() => showPath(step.run.id)}
                      dispatch={dispatch}
                    />
                  </li>
                ) : (
                  <li key={`before-${step.runId}`}>
                    <ToolChangeRow view={step} dispatch={dispatch} />
                  </li>
                ),
              )}
            </ol>
          )}

          {live.canReset ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl px-3 text-base text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="size-4" aria-hidden />
              Start over with the sample
            </button>
          ) : null}
        </section>

        <MatMap ref={matRef} run={selected} runs={view.runs} dispatch={dispatch} />
      </div>
    </div>
  );
}
