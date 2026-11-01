import { useSyncExternalStore } from "react";

import { parsePlan, reducePlan, SEED_PLAN, type MatchPlan, type PlanCommand } from "@/lib/match-plan/plan";
import { viewPlan, type PlanView } from "@/lib/match-plan/view";

/** Bump the suffix when the stored shape changes incompatibly. */
const STORAGE_KEY = "rolling-sparks.match-plan.v1";

type Loaded = { plan: MatchPlan; view: PlanView };

/** This tab's plan and its view. Null until the first client read, and again once nothing is subscribed. */
let loaded: Loaded | null = null;
const listeners = new Set<() => void>();

function planFrom(raw: string | null): MatchPlan {
  if (raw === null) return SEED_PLAN;
  try {
    return parsePlan(JSON.parse(raw)) ?? SEED_PLAN;
  } catch {
    return SEED_PLAN;
  }
}

function loadedFrom(plan: MatchPlan): Loaded {
  return { plan, view: viewPlan(plan) };
}

function load(): Loaded {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Some private modes throw on any storage access; the sample plan still works for this visit.
  }
  return loadedFrom(planFrom(raw));
}

function save(plan: MatchPlan) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Full or blocked storage keeps the plan in memory for this visit.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  loaded = loadedFrom(planFrom(event.newValue));
  emit();
}

function subscribe(onChange: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
    if (listeners.size > 0) return;
    window.removeEventListener("storage", onStorage);
    // Another tab may write while this page is closed, so the next visit reads storage again.
    loaded = null;
  };
}

function getSnapshot(): PlanView {
  loaded ??= load();
  return loaded.view;
}

/** Server HTML and the hydration pass render the skeleton; React re-renders with the stored plan right after. */
function getServerSnapshot(): null {
  return null;
}

/** Returns the id of the run or mission the command added, else null. */
export type PlanDispatch = (command: PlanCommand) => string | null;

function dispatch(command: PlanCommand): string | null {
  const current = (loaded ??= load());
  let added: string | null = null;
  const plan = reducePlan(current.plan, command, () => (added = crypto.randomUUID()));
  if (plan === current.plan) return null;
  loaded = loadedFrom(plan);
  save(plan);
  emit();
  return added;
}

/** The plan as the page renders it, and the one way to change it. `view` is null on the server and while hydrating. */
export function useMatchPlan(): readonly [PlanView | null, PlanDispatch] {
  const view = useSyncExternalStore<PlanView | null>(subscribe, getSnapshot, getServerSnapshot);
  return [view, dispatch];
}
