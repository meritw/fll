import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { applyOp, MAX_OPS_PER_SAVE, SEED_PLAN, type MatchPlan, type PlanBatch, type PlanOp } from "./plan";
import type { SaveResult } from "./server";
import {
  createPlanSync,
  MIN_SEND_GAP_MS,
  RETRY_BACKOFF_MS,
  syncStatus,
  type Confirmed,
  type PlanSnapshot,
} from "./sync";
import { viewPlan } from "./view";

type Call = Readonly<{ batch: PlanBatch; resolve: (result: SaveResult) => void; reject: (error: Error) => void }>;

function setup(confirmed: Confirmed = row(SEED_PLAN, 1)) {
  const calls: Call[] = [];
  let sessionLost = 0;
  let ids = 0;
  const sync = createPlanSync({
    confirmed,
    save: (batch) => new Promise((resolve, reject) => calls.push({ batch, resolve, reject })),
    onSessionLost: () => sessionLost++,
    newId: () => `id-${++ids}`,
  });
  return { sync, calls, sessionLost: () => sessionLost };
}

function row(plan: MatchPlan, version: number, extra: Partial<Confirmed> = {}): Confirmed {
  return { plan, version, generation: 0, recentBatches: [], lastEditor: null, ...extra };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

async function answer(call: Call | undefined, result: SaveResult | Error) {
  assert.ok(call, "a save was sent");
  if (result instanceof Error) call.reject(result);
  else call.resolve(result);
  await flush();
}

const saved = (version: number): SaveResult => ({ kind: "saved", version });
const launcher = (name: string): PlanOp => ({ type: "editRun", runId: "r1", patch: { launcher: name } });
const r1 = (snapshot: PlanSnapshot) => snapshot.view.runs[0].run;

describe("plan sync", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout", "Date"] }));
  afterEach(() => mock.timers.reset());

  it("returns an added run's id synchronously and shows the run before anything is sent", () => {
    const { sync, calls } = setup();
    const id = sync.dispatch({ type: "addRun" });
    assert.equal(id, "id-1");
    assert.ok(sync.getSnapshot().view.runs.some((view) => view.run.id === id), "the new run is on the page");
    assert.equal(calls.length, 0, "nothing is sent in the same turn");
    mock.timers.tick(0);
    assert.deepEqual(calls[0]?.batch.ops, [{ type: "addRun", runId: id }], "an add is sent on the next turn");
  });

  it("sends one save at a time and coalesces keystrokes typed while one is in flight", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "A" } });
    mock.timers.tick(0);
    assert.deepEqual(calls[0]?.batch.ops, [launcher("A")], "the first keystroke goes out at once");
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "An" } });
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } });
    mock.timers.tick(MIN_SEND_GAP_MS);
    assert.equal(calls.length, 1, "no second save while the first is in flight");
    await answer(calls[0], saved(2));
    mock.timers.tick(0);
    assert.deepEqual(calls[1]?.batch.ops, [launcher("Ana")], "the keystrokes typed meanwhile went out as one op");
  });

  it("waits out the send gap between text edits", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "A" } });
    mock.timers.tick(0);
    await answer(calls[0], saved(2));
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Al" } });
    mock.timers.tick(MIN_SEND_GAP_MS - 1);
    assert.equal(calls.length, 1, "a text edit waits for the gap");
    mock.timers.tick(1);
    assert.equal(calls.length, 2, "and goes out when the gap ends");
  });

  it("sends a structural op without waiting for a pending text edit's gap", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "A" } });
    mock.timers.tick(0);
    await answer(calls[0], saved(2));
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Al" } });
    sync.dispatch({ type: "removeRun", runId: "r3" });
    mock.timers.tick(0);
    assert.deepEqual(
      calls[1]?.batch.ops,
      [launcher("Al"), { type: "removeRun", runId: "r3" }],
      "the remove went out on the next turn",
    );
  });

  it("never coalesces edits to different loadout slots", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "A" } });
    mock.timers.tick(0);
    sync.dispatch({ type: "editRun", runId: "r1", patch: { loadout: { front: "net" } } });
    sync.dispatch({ type: "editRun", runId: "r1", patch: { loadout: { rear: "claw" } } });
    await answer(calls[0], saved(2));
    mock.timers.tick(MIN_SEND_GAP_MS);
    assert.equal(calls[1]?.batch.ops.length, 2, "both slot edits are in the next batch");
  });

  it("splits a long queue into batches the server accepts", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "addRun" });
    mock.timers.tick(0);
    for (let i = 0; i < MAX_OPS_PER_SAVE + 1; i++) sync.dispatch({ type: "addRun" });
    await answer(calls[0], saved(2));
    mock.timers.tick(0);
    assert.equal(calls[1]?.batch.ops.length, MAX_OPS_PER_SAVE, "the second batch is full");
    await answer(calls[1], saved(3));
    mock.timers.tick(0);
    assert.equal(calls[2]?.batch.ops.length, 1, "the rest goes in a third");
  });

  it("holds a saved batch until the live row reaches its version, then lets a later write win", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } });
    mock.timers.tick(0);
    await answer(calls[0], saved(3));
    const teammate = applyOp(SEED_PLAN, { type: "editRun", runId: "r2", patch: { launcher: "Kai" } });
    sync.confirm(row(teammate, 2));
    assert.equal(r1(sync.getSnapshot()).launcher, "Ana", "the saved edit stays on screen before its row arrives");
    assert.equal(sync.getSnapshot().view.runs[1].run.launcher, "Kai", "the teammate's edit shows too");
    assert.equal(sync.getSnapshot().unsent, false, "a saved batch is not unsent");
    sync.confirm(row(applyOp(teammate, launcher("Bob")), 4));
    assert.equal(r1(sync.getSnapshot()).launcher, "Bob", "a teammate's later write to the same field wins");
  });

  it("keeps text still being typed when a teammate's row for the same run arrives", () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "An" } });
    mock.timers.tick(0);
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } });
    const teammate = applyOp(SEED_PLAN, { type: "editRun", runId: "r1", patch: { end: "RED", launcher: "Kai" } });
    sync.confirm(row(teammate, 2));
    assert.deepEqual([r1(sync.getSnapshot()).launcher, r1(sync.getSnapshot()).end], ["Ana", "RED"]);
    assert.equal(calls.length, 1);
  });

  it("resends the exact batch after a lost reply, ahead of anything queued later", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } });
    mock.timers.tick(0);
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Anabel" } });
    await answer(calls[0], new Error("network"));
    mock.timers.tick(RETRY_BACKOFF_MS[0]);
    assert.deepEqual(calls[1]?.batch, calls[0]?.batch, "same id and same ops, not merged with the newer text");
    await answer(calls[1], saved(2));
    mock.timers.tick(MIN_SEND_GAP_MS);
    assert.deepEqual(calls[2]?.batch.ops, [launcher("Anabel")], "the newer text follows in its own batch");
  });

  it("settles a batch the live row already lists instead of resending it", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } });
    mock.timers.tick(0);
    await answer(calls[0], new Error("network"));
    const batchId = calls[0]?.batch.id ?? "";
    sync.confirm(row(applyOp(SEED_PLAN, launcher("Ana")), 2, { recentBatches: [batchId] }));
    mock.timers.tick(RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
    assert.equal(calls.length, 1, "no resend");
    assert.equal(syncStatus("live", sync.getSnapshot()).state, "saved");
  });

  it("backs off on BUSY and network failures, reports offline, and keeps the edit on screen", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } });
    mock.timers.tick(0);
    await answer(calls[0], { kind: "rejected", reason: "BUSY" });
    assert.equal(syncStatus("live", sync.getSnapshot()).state, "saving", "one failure still reads as saving");
    mock.timers.tick(RETRY_BACKOFF_MS[0] - 1);
    assert.equal(calls.length, 1, "waits out the first backoff");
    mock.timers.tick(1);
    await answer(calls[1], new Error("network"));
    assert.equal(syncStatus("live", sync.getSnapshot()).state, "offline", "two failures read as offline");
    assert.equal(r1(sync.getSnapshot()).launcher, "Ana", "the edit stays on screen while offline");
    mock.timers.tick(RETRY_BACKOFF_MS[1]);
    await answer(calls[2], saved(2));
    assert.equal(syncStatus("live", sync.getSnapshot()).state, "saved", "a save clears offline");
  });

  it("drops ops made before a teammate's reset and says the plan was reset", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } });
    mock.timers.tick(0);
    sync.dispatch({ type: "editMission", missionId: "m1", patch: { notes: "aim left" } });
    sync.confirm(row(SEED_PLAN, 2, { generation: 1 }));
    const snapshot = sync.getSnapshot();
    assert.deepEqual(snapshot.view, viewPlan(SEED_PLAN), "the page shows the sample, without the fenced edits");
    assert.equal(snapshot.unsent, false, "nothing is left to send");
    assert.deepEqual(syncStatus("live", snapshot).alert, { kind: "reset" });
    await answer(calls[0], saved(3));
    mock.timers.tick(RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
    assert.equal(calls.length, 1, "the fenced ops are never sent");
    sync.dismissNotice();
    assert.equal(syncStatus("live", sync.getSnapshot()).alert, null);
  });

  it("keeps a coach's own reset quiet and sends later edits under the new generation", async () => {
    const { sync, calls } = setup(row(applyOp(SEED_PLAN, launcher("Kai")), 1));
    sync.dispatch({ type: "reset" });
    mock.timers.tick(0);
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } });
    assert.deepEqual(calls[0]?.batch.ops, [{ type: "reset" }]);
    assert.equal(calls[0]?.batch.generation, 0);
    await answer(calls[0], saved(2));
    sync.confirm(row(SEED_PLAN, 2, { generation: 1 }));
    assert.equal(sync.getSnapshot().notice, null, "no reset notice for your own reset");
    mock.timers.tick(MIN_SEND_GAP_MS);
    assert.deepEqual(
      [calls[1]?.batch.generation, calls[1]?.batch.ops],
      [1, [launcher("Ana")]],
      "the edit made after the reset is sent under generation 1",
    );
  });

  it("drops a batch the server refuses as INVALID and says so", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } });
    mock.timers.tick(0);
    await answer(calls[0], { kind: "rejected", reason: "INVALID" });
    assert.equal(r1(sync.getSnapshot()).launcher, "Alex", "the refused edit leaves the page");
    assert.deepEqual(syncStatus("live", sync.getSnapshot()).alert, { kind: "dropped" });
  });

  it("stops sending and leaves the page when the server says the session is gone", async () => {
    const { sync, calls, sessionLost } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } });
    mock.timers.tick(0);
    sync.dispatch({ type: "editMission", missionId: "m1", patch: { notes: "x" } });
    await answer(calls[0], { kind: "rejected", reason: "UNAUTHENTICATED" });
    assert.equal(sessionLost(), 1);
    assert.equal(sync.getSnapshot().unsent, false, "no leave-page prompt for edits that can't be saved");
    assert.equal(sync.dispatch({ type: "addRun" }), null, "later edits are ignored");
    mock.timers.tick(RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
    assert.equal(calls.length, 1, "nothing else is sent");
  });

  it("sends a text edit still waiting for its gap when the page goes away", async () => {
    const { sync, calls } = setup();
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "A" } });
    mock.timers.tick(0);
    await answer(calls[0], saved(2));
    sync.dispatch({ type: "editRun", runId: "r1", patch: { launcher: "Al" } });
    sync.dispose();
    assert.deepEqual(calls[1]?.batch.ops, [launcher("Al")], "sent without waiting");
  });
});

describe("syncStatus", () => {
  const snapshot = (patch: Partial<PlanSnapshot>): PlanSnapshot => ({
    ...setup().sync.getSnapshot(),
    ...patch,
  });

  it("prefers the strongest signal", () => {
    const cases: [Parameters<typeof syncStatus>[0], Partial<PlanSnapshot>, string, string | null][] = [
      ["error", { unsent: true, failures: 3 }, "stopped", "stopped"],
      ["closed", {}, "stopped", "stopped"],
      ["live", { unsent: true, failures: 2, notice: "dropped" }, "offline", "offline"],
      ["stale", { unsent: true, notice: "reset" }, "saving", "reset"],
      ["stale", {}, "reconnecting", null],
      ["connecting", {}, "connecting", null],
      ["live", { notice: "dropped" }, "saved", "dropped"],
      ["live", {}, "saved", null],
    ];
    for (const [live, patch, state, alert] of cases) {
      const status = syncStatus(live, snapshot(patch));
      assert.deepEqual([status.state, status.alert?.kind ?? null], [state, alert], `${live} ${JSON.stringify(patch)}`);
    }
  });

  it("offers a reload only after repeated failures", () => {
    assert.deepEqual(syncStatus("live", snapshot({ unsent: true, failures: 4 })).alert, {
      kind: "offline",
      canReload: false,
    });
    assert.deepEqual(syncStatus("live", snapshot({ unsent: true, failures: 5 })).alert, {
      kind: "offline",
      canReload: true,
    });
  });
});
