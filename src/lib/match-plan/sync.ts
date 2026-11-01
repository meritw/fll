import type { LiveQueryState } from "@neon/realtime/client";

import {
  applyOp,
  coalesceKey,
  MAX_OPS_PER_SAVE,
  toOp,
  type MatchPlan,
  type PlanBatch,
  type PlanCommand,
  type PlanOp,
} from "./plan";
import type { SaveResult } from "./server";
import { viewPlan, type PlanView } from "./view";

/** Returns the id of an added run or mission synchronously, or null. */
export type PlanDispatch = (command: PlanCommand) => string | null;

/** A plan the server committed, parsed from a live row. `version` only grows. */
export type Confirmed = Readonly<{
  plan: MatchPlan;
  version: number;
  generation: number;
  recentBatches: readonly string[];
  lastEditor: string | null;
}>;

export type PlanSyncOptions = Readonly<{
  confirmed: Confirmed;
  save: (batch: PlanBatch) => Promise<SaveResult>;
  /** The server refused this session. The store has stopped sending, and the caller leaves the page. */
  onSessionLost: () => void;
  newId: () => string;
}>;

export type Notice = "dropped" | "reset";

export type PlanSnapshot = Readonly<{
  view: PlanView;
  /** True while any op hasn't been saved yet. */
  unsent: boolean;
  /** Failed attempts at the batch being sent. */
  failures: number;
  notice: Notice | null;
  lastEditor: string | null;
}>;

export type PlanSync = Readonly<{
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => PlanSnapshot;
  dispatch: PlanDispatch;
  /** Takes every live row. Rows at or below the current version are ignored. */
  confirm: (confirmed: Confirmed) => void;
  dismissNotice: () => void;
  /** Sends whatever is queued right away. Not terminal, because Strict Mode keeps the store after a cleanup. */
  dispose: () => void;
}>;

/** Caps a typist at about three writes a second. Adds, moves, removes and resets don't wait for it. */
export const MIN_SEND_GAP_MS = 300;
export const RETRY_BACKOFF_MS = [1000, 2000, 5000, 10000] as const;
export const OFFLINE_AFTER_FAILURES = 2;
export const RELOAD_AFTER_FAILURES = 5;

type Queued = Readonly<{ op: PlanOp; generation: number }>;
type Saved = Readonly<{ batch: PlanBatch; version: number }>;

/**
 * The browser's only owner of plan state. The view is the confirmed plan with every unconfirmed op folded on
 * top, so a field being typed in keeps its local text while teammates' rows arrive. Ops are idempotent, so
 * folding one the confirmed row already includes changes nothing.
 */
export function createPlanSync({ confirmed: initial, save, onSessionLost, newId }: PlanSyncOptions): PlanSync {
  let confirmed = initial;
  let saved: Saved[] = [];
  // Sent, or waiting to be resent after a failure. Resent as is, never merged with newer ops, so a resend
  // the server already applied is recognized by its id.
  let head: PlanBatch | null = null;
  let inFlight = false;
  let queued: Queued[] = [];
  let failures = 0;
  let notice: Notice | null = null;
  let stopped = false;
  let timer: Readonly<{ handle: ReturnType<typeof setTimeout>; at: number }> | null = null;
  let lastSentAt = -Infinity;
  const listeners = new Set<() => void>();
  let plan = initial.plan;
  let snapshot = buildSnapshot();

  function pendingOps(): PlanOp[] {
    return [...saved.flatMap(({ batch }) => batch.ops), ...(head?.ops ?? []), ...queued.map(({ op }) => op)];
  }

  function buildSnapshot(): PlanSnapshot {
    return {
      view: viewPlan(plan),
      unsent: head !== null || queued.length > 0,
      failures,
      notice,
      lastEditor: confirmed.lastEditor,
    };
  }

  function refresh() {
    plan = pendingOps().reduce(applyOp, confirmed.plan);
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  }

  function localGeneration(): number {
    return confirmed.generation + pendingOps().filter((op) => op.type === "reset").length;
  }

  function dispatch(command: PlanCommand): string | null {
    if (stopped) return null;
    const op = toOp(plan, command, newId);
    if (!op || applyOp(plan, op) === plan) return null;
    const last = queued[queued.length - 1];
    const key = coalesceKey(op);
    queued =
      last && key !== null && coalesceKey(last.op) === key
        ? [...queued.slice(0, -1), { op, generation: last.generation }]
        : [...queued, { op, generation: localGeneration() }];
    refresh();
    schedule();
    return op.type === "addRun" ? op.runId : op.type === "addMission" ? op.missionId : null;
  }

  function delay(): number {
    if (failures > 0) return RETRY_BACKOFF_MS[Math.min(failures, RETRY_BACKOFF_MS.length) - 1];
    if (queued.some(({ op }) => coalesceKey(op) === null)) return 0;
    return Math.max(0, lastSentAt + MIN_SEND_GAP_MS - Date.now());
  }

  function schedule() {
    if (stopped || inFlight || (head === null && queued.length === 0)) return;
    const at = Date.now() + delay();
    if (timer && timer.at <= at) return;
    if (timer) clearTimeout(timer.handle);
    timer = { at, handle: setTimeout(send, at - Date.now()) };
  }

  function takeBatch(): PlanBatch | null {
    const first = queued[0];
    if (!first) return null;
    let count = 1;
    while (count < queued.length && count < MAX_OPS_PER_SAVE && queued[count].generation === first.generation) {
      count++;
    }
    const ops = queued.slice(0, count).map(({ op }) => op);
    queued = queued.slice(count);
    return { id: newId(), generation: first.generation, ops };
  }

  async function send() {
    timer = null;
    if (stopped || inFlight) return;
    head ??= takeBatch();
    if (!head) return;
    const batch = head;
    inFlight = true;
    lastSentAt = Date.now();
    let result: SaveResult | null;
    try {
      result = await save(batch);
    } catch {
      result = null;
    }
    inFlight = false;
    if (batch === head) settle(batch, result);
    refresh();
    schedule();
  }

  function settle(batch: PlanBatch, result: SaveResult | null) {
    if (result === null || (result.kind === "rejected" && result.reason === "BUSY")) {
      failures++;
      return;
    }
    head = null;
    failures = 0;
    if (result.kind === "saved") {
      if (result.version > confirmed.version) saved = [...saved, { batch, version: result.version }];
    } else if (result.reason === "UNAUTHENTICATED") {
      stopped = true;
      queued = [];
      onSessionLost();
    } else {
      notice = "dropped";
    }
  }

  function confirm(next: Confirmed) {
    if (next.version <= confirmed.version) return;
    if (next.generation > confirmed.generation && !pendingOps().some((op) => op.type === "reset")) {
      notice = "reset";
    }
    confirmed = next;
    saved = saved.filter(({ batch, version }) => version > next.version && batch.generation >= next.generation);
    if (head && (head.generation < next.generation || next.recentBatches.includes(head.id))) {
      head = null;
      failures = 0;
    }
    queued = queued.filter(({ generation }) => generation >= next.generation);
    refresh();
    schedule();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    dispatch,
    confirm,
    dismissNotice() {
      notice = null;
      refresh();
    },
    dispose() {
      if (timer) clearTimeout(timer.handle);
      timer = null;
      void send();
    },
  };
}

/** What the page tells the user. One value, so the badge and the alert can't disagree. */
export type SyncStatus = Readonly<{
  state: "connecting" | "saving" | "saved" | "reconnecting" | "offline" | "stopped";
  lastEditor: string | null;
  alert:
    | null
    | Readonly<{ kind: "offline"; canReload: boolean }>
    | Readonly<{ kind: "stopped" }>
    | Readonly<{ kind: Notice }>;
}>;

/** Live status "error" is final and "closed" never reopens, so both stop the page until a reload. */
export function syncStatus(live: LiveQueryState["status"], snapshot: PlanSnapshot): SyncStatus {
  const { failures, unsent, notice, lastEditor } = snapshot;
  if (live === "error" || live === "closed") return { state: "stopped", lastEditor, alert: { kind: "stopped" } };
  if (failures >= OFFLINE_AFTER_FAILURES) {
    return { state: "offline", lastEditor, alert: { kind: "offline", canReload: failures >= RELOAD_AFTER_FAILURES } };
  }
  const alert = notice ? { kind: notice } : null;
  if (unsent) return { state: "saving", lastEditor, alert };
  if (live === "stale") return { state: "reconnecting", lastEditor, alert };
  if (live === "connecting") return { state: "connecting", lastEditor, alert };
  return { state: "saved", lastEditor, alert };
}
