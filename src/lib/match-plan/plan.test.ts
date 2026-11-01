import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HOME_ANCHORS, MISSION_PINS } from "./pins";
import {
  applyOp,
  coalesceKey,
  MAX_OPS_PER_SAVE,
  MAX_PATH_POINTS,
  matPath,
  parseBatch,
  parseOps,
  parsePlan,
  SEED_PLAN,
  toOp,
  type MatchPlan,
  type PlanCommand,
  type PlanOp,
} from "./plan";
import { formatMatchClock, suggestedPath, viewPlan, type ToolChangeView } from "./view";

function counter() {
  let n = 0;
  return () => `new-${++n}`;
}

function apply(plan: MatchPlan, ...commands: PlanCommand[]): MatchPlan {
  const newId = counter();
  return commands.reduce((current, command) => {
    const op = toOp(current, command, newId);
    return op ? applyOp(current, op) : current;
  }, plan);
}

function applyAll(plan: MatchPlan, ...ops: PlanOp[]): MatchPlan {
  return ops.reduce(applyOp, plan);
}

function runIds(plan: MatchPlan) {
  return plan.runs.map((run) => run.id);
}

function toolChanges(plan: MatchPlan): ToolChangeView[] {
  return viewPlan(plan).steps.filter((step): step is ToolChangeView => step.kind === "toolChange");
}

function totals(plan: MatchPlan) {
  const { points, best, worst } = viewPlan(plan).totals;
  return { points, bestSec: best.sec, worstSec: worst.sec };
}

function missionLine(plan: MatchPlan, missionId: string) {
  const line = viewPlan(plan)
    .runs.flatMap((run) => run.missions)
    .find((candidate) => candidate.mission.id === missionId);
  assert.ok(line, `mission ${missionId} is in the view`);
  return line;
}

describe("seed plan", () => {
  it("totals 125 pts with a best time that fits the 150 s match and a worst time that runs over", () => {
    const view = viewPlan(SEED_PLAN);
    assert.deepEqual(totals(SEED_PLAN), { points: 125, bestSec: 115, worstSec: 190 });
    assert.deepEqual(view.totals.best, { sec: 115, leftSec: 35, over: false });
    assert.deepEqual(view.totals.worst, { sec: 190, leftSec: -40, over: true });
    assert.deepEqual(
      view.runs.map((run) => run.points),
      [45, 65, 15],
    );
  });

  it("alternates runs and tool changes, numbering and coloring runs by position", () => {
    const view = viewPlan(SEED_PLAN);
    assert.deepEqual(
      view.steps.map((step) => step.kind),
      ["run", "toolChange", "run", "toolChange", "run"],
    );
    assert.deepEqual(
      view.runs.map((run) => run.number),
      [1, 2, 3],
    );
    assert.equal(new Set(view.runs.map((run) => run.color)).size, 3);
  });

  it("names each mission line's attachment from its run's loadout", () => {
    assert.deepEqual(missionLine(SEED_PLAN, "m1"), {
      mission: SEED_PLAN.runs[0].missions[0],
      codeLabel: "M01",
      name: "Drone Survey",
      attachment: { slot: "front", name: "drone hook" },
    });
    assert.deepEqual(missionLine(SEED_PLAN, "m3").attachment, { slot: "rear", name: "rock flipper" });
    assert.deepEqual(missionLine(SEED_PLAN, "m7").attachment, { slot: "rear", name: "fungus arm" });
  });

  it("derives each tool change's swaps and home move from its neighbors", () => {
    const [first, second] = toolChanges(SEED_PLAN);
    assert.equal(first.runId, "r2");
    assert.deepEqual(first.toolChange.time, { bestSec: 10, worstSec: 20 });
    assert.deepEqual(first.swaps, [
      { slot: "front", off: "drone hook", on: "elder grip" },
      { slot: "rear", off: "rock flipper", on: "fungus arm" },
    ]);
    assert.equal(first.move, null);
    assert.equal(second.runId, "r3");
    assert.deepEqual(second.move, { from: "BLUE", to: "RED" });
    assert.deepEqual(second.swaps, [
      { slot: "front", off: "elder grip", on: "leaf scoop" },
      { slot: "rear", off: "fungus arm", on: "" },
    ]);
  });

  it("formats the match clock", () => {
    assert.equal(formatMatchClock(150), "2:30");
    assert.equal(formatMatchClock(65), "1:05");
    assert.equal(formatMatchClock(0), "0:00");
  });
});

describe("plan ops on runs", () => {
  it("adds a run in the home the last run ended in, with the same tools", () => {
    const plan = apply(SEED_PLAN, { type: "addRun" });
    const added = plan.runs[3];
    assert.deepEqual(added, {
      id: "new-1",
      launcher: "",
      start: "RED",
      end: "RED",
      loadout: SEED_PLAN.runs[2].loadout,
      missions: [],
      path: [],
      toolChangeBefore: { time: { bestSec: 15, worstSec: 25 }, note: "" },
    });
    const last = toolChanges(plan)[2];
    assert.deepEqual([last.runId, last.swaps, last.move], ["new-1", [], null]);
    assert.deepEqual(totals(plan), { points: 125, bestSec: 130, worstSec: 215 });
  });

  it("adds the first run to an empty plan from RED with no tools and no tool change", () => {
    const plan = apply({ runs: [] }, { type: "addRun" });
    assert.deepEqual(
      [plan.runs[0].start, plan.runs[0].end, plan.runs[0].loadout],
      ["RED", "RED", { front: "", rear: "", other: "" }],
    );
    assert.deepEqual(
      viewPlan(plan).steps.map((step) => step.kind),
      ["run"],
    );
    assert.deepEqual(totals(plan), { points: 0, bestSec: 0, worstSec: 0 });
  });

  it("removes a run with the tool change before it", () => {
    const plan = apply(SEED_PLAN, { type: "removeRun", runId: "r2" });
    assert.deepEqual(runIds(plan), ["r1", "r3"]);
    assert.deepEqual(toolChanges(plan)[0].toolChange.time, { bestSec: 10, worstSec: 15 });
    assert.deepEqual(totals(plan), { points: 60, bestSec: 60, worstSec: 95 });
  });

  it("re-derives swaps and home moves after a reorder", () => {
    const plan = apply(SEED_PLAN, { type: "moveRun", runId: "r3", by: -1 });
    assert.deepEqual(runIds(plan), ["r1", "r3", "r2"]);
    const [beforeR3, beforeR2] = toolChanges(plan);
    assert.deepEqual(beforeR3.move, { from: "BLUE", to: "RED" });
    assert.deepEqual(beforeR3.swaps, [
      { slot: "front", off: "drone hook", on: "leaf scoop" },
      { slot: "rear", off: "rock flipper", on: "" },
    ]);
    assert.deepEqual(beforeR2.move, { from: "RED", to: "BLUE" });
    assert.deepEqual(beforeR2.swaps, [
      { slot: "front", off: "leaf scoop", on: "elder grip" },
      { slot: "rear", off: "", on: "fungus arm" },
    ]);
    assert.deepEqual(totals(plan), totals(SEED_PLAN));
  });

  it("moves each tool change with the run after it and never counts the first run's", () => {
    const plan = apply(SEED_PLAN, { type: "moveRun", runId: "r1", by: 1 });
    assert.deepEqual(runIds(plan), ["r2", "r1", "r3"]);
    assert.deepEqual(
      toolChanges(plan).map((change) => [change.runId, change.toolChange.time]),
      [
        ["r1", { bestSec: 15, worstSec: 25 }],
        ["r3", { bestSec: 10, worstSec: 15 }],
      ],
    );
    assert.deepEqual(totals(plan), { points: 125, bestSec: 120, worstSec: 195 });
  });

  it("returns the same plan for moves past either end", () => {
    assert.equal(apply(SEED_PLAN, { type: "moveRun", runId: "r1", by: -1 }), SEED_PLAN);
    assert.equal(apply(SEED_PLAN, { type: "moveRun", runId: "r3", by: 1 }), SEED_PLAN);
    assert.equal(apply(SEED_PLAN, { type: "moveMission", missionId: "m1", by: -1 }), SEED_PLAN);
    assert.equal(apply(SEED_PLAN, { type: "moveMission", missionId: "m3", by: 1 }), SEED_PLAN);
  });

  it("returns the same plan for unknown ids", () => {
    const commands: PlanCommand[] = [
      { type: "removeRun", runId: "nope" },
      { type: "moveRun", runId: "nope", by: 1 },
      { type: "editRun", runId: "nope", patch: { launcher: "Kai" } },
      { type: "addMission", runId: "nope", code: 2 },
      { type: "removeMission", missionId: "nope" },
      { type: "moveMission", missionId: "nope", by: 1 },
      { type: "editMission", missionId: "nope", patch: { points: 5 } },
      { type: "editToolChange", runId: "nope", patch: { note: "x" } },
    ];
    for (const command of commands) {
      assert.equal(apply(SEED_PLAN, command), SEED_PLAN, command.type);
    }
  });

  it("resets to the sample plan", () => {
    const plan = apply(SEED_PLAN, { type: "removeRun", runId: "r1" }, { type: "reset" });
    assert.deepEqual(plan, SEED_PLAN);
  });
});

describe("plan ops that edit", () => {
  it("renames a slot on the run and every mission line that uses it", () => {
    const plan = apply(SEED_PLAN, {
      type: "editRun",
      runId: "r1",
      patch: { launcher: "Kai", loadout: { rear: "flipper v2" } },
    });
    assert.equal(plan.runs[0].launcher, "Kai");
    assert.deepEqual(plan.runs[0].loadout, { front: "drone hook", rear: "flipper v2", other: "" });
    assert.deepEqual(missionLine(plan, "m3").attachment, { slot: "rear", name: "flipper v2" });
    assert.deepEqual(missionLine(plan, "m1").attachment, { slot: "front", name: "drone hook" });
  });

  it("changes homes and the derived home move", () => {
    const plan = apply(SEED_PLAN, { type: "editRun", runId: "r1", patch: { end: "RED" } });
    assert.deepEqual(toolChanges(plan)[0].move, { from: "RED", to: "BLUE" });
  });

  it("replaces a path, clamping to the mat and rounding to a tenth of a percent", () => {
    const plan = apply(SEED_PLAN, {
      type: "editRun",
      runId: "r2",
      patch: { path: [{ x: -5, y: 120 }, { x: 33.333, y: 50.06 }] },
    });
    assert.deepEqual(plan.runs[1].path, [
      { x: 0, y: 100 },
      { x: 33.3, y: 50.1 },
    ]);
    assert.deepEqual(apply(plan, { type: "editRun", runId: "r2", patch: { path: [] } }).runs[1].path, []);
  });

  it("adds a mission with no tool and zero points", () => {
    const plan = apply(SEED_PLAN, { type: "addMission", runId: "r3", code: 13 });
    assert.deepEqual(plan.runs[2].missions.map((mission) => mission.id), ["m4", "new-1"]);
    const line = missionLine(plan, "new-1");
    assert.deepEqual([line.codeLabel, line.name, line.attachment, line.mission.points], ["M13", "Keystone Species", null, 0]);
  });

  it("removes and moves missions within their run", () => {
    const removed = apply(SEED_PLAN, { type: "removeMission", missionId: "m1" });
    assert.deepEqual(removed.runs[0].missions.map((mission) => mission.id), ["m3"]);
    assert.deepEqual(totals(removed), { points: 105, bestSec: 100, worstSec: 165 });
    const moved = apply(SEED_PLAN, { type: "moveMission", missionId: "m3", by: -1 });
    assert.deepEqual(moved.runs[0].missions.map((mission) => mission.id), ["m3", "m1"]);
  });

  it("rounds and clamps points to whole numbers from 0 to 999", () => {
    const points = (value: number) =>
      apply(SEED_PLAN, { type: "editMission", missionId: "m1", patch: { points: value } }).runs[0].missions[0].points;
    assert.equal(points(12.6), 13);
    assert.equal(points(-5), 0);
    assert.equal(points(5000), 999);
    assert.equal(points(Number.NaN), 0);
  });

  it("switches a mission's slot and notes", () => {
    const plan = apply(SEED_PLAN, {
      type: "editMission",
      missionId: "m3",
      patch: { uses: "front", notes: "aim left" },
    });
    assert.deepEqual(missionLine(plan, "m3").attachment, { slot: "front", name: "drone hook" });
    assert.equal(plan.runs[0].missions[1].notes, "aim left");
    const none = apply(plan, { type: "editMission", missionId: "m3", patch: { uses: "none" } });
    assert.equal(missionLine(none, "m3").attachment, null);
  });

  it("edits a time range so the edited end wins and best never passes worst", () => {
    const time = (patch: { bestSec?: number; worstSec?: number }) =>
      apply(SEED_PLAN, { type: "editMission", missionId: "m1", patch }).runs[0].missions[0].time;
    assert.deepEqual(time({ bestSec: 20 }), { bestSec: 20, worstSec: 25 });
    assert.deepEqual(time({ bestSec: 50 }), { bestSec: 50, worstSec: 50 });
    assert.deepEqual(time({ worstSec: 10 }), { bestSec: 10, worstSec: 10 });
    assert.deepEqual(time({ bestSec: 45, worstSec: 12 }), { bestSec: 12, worstSec: 45 });
    assert.deepEqual(time({ worstSec: 1500 }), { bestSec: 15, worstSec: 999 });
  });

  it("edits the tool change before a run with the same time-range rule", () => {
    const plan = apply(SEED_PLAN, {
      type: "editToolChange",
      runId: "r2",
      patch: { worstSec: 8, note: "check the grip" },
    });
    assert.deepEqual(toolChanges(plan)[0].toolChange, { time: { bestSec: 8, worstSec: 8 }, note: "check the grip" });
    assert.deepEqual(totals(plan), { points: 125, bestSec: 113, worstSec: 178 });
  });

  it("turns the worst total over the match when a mission's worst time rises", () => {
    const plan = apply(
      { runs: [] },
      { type: "addRun" },
      { type: "addMission", runId: "new-1", code: 1 },
      { type: "editMission", missionId: "new-2", patch: { worstSec: 150 } },
    );
    assert.equal(viewPlan(plan).totals.worst.over, false);
    const over = apply(plan, { type: "editMission", missionId: "new-2", patch: { worstSec: 151 } });
    assert.deepEqual(viewPlan(over).totals.worst, { sec: 151, leftSec: -1, over: true });
  });
});

describe("suggestedPath", () => {
  it("goes from the start home through each pinned mission to the end home", () => {
    assert.deepEqual(suggestedPath(SEED_PLAN.runs[0]), [
      HOME_ANCHORS.RED,
      MISSION_PINS[1],
      MISSION_PINS[3],
      HOME_ANCHORS.BLUE,
    ]);
    const plan = apply(SEED_PLAN, { type: "addMission", runId: "r3", code: 13 });
    assert.deepEqual(suggestedPath(plan.runs[2]), [HOME_ANCHORS.RED, MISSION_PINS[4], HOME_ANCHORS.RED]);
  });
});

const SAMPLE_OPS: { readonly [K in PlanOp["type"]]: Extract<PlanOp, { type: K }> } = {
  addRun: { type: "addRun", runId: "new-run" },
  removeRun: { type: "removeRun", runId: "r2" },
  moveRun: { type: "moveRun", runId: "r3", to: [{ before: "r1" }] },
  editRun: {
    type: "editRun",
    runId: "r1",
    patch: { launcher: "Ana", end: "RED", loadout: { front: "claw" }, path: [{ x: 10.04, y: 120 }] },
  },
  addMission: { type: "addMission", runId: "r1", missionId: "new-mission", code: 2 },
  removeMission: { type: "removeMission", missionId: "m1" },
  moveMission: { type: "moveMission", missionId: "m3", to: [{ before: "m1" }] },
  editMission: { type: "editMission", missionId: "m1", patch: { points: 30, bestSec: 40, notes: "aim left" } },
  editToolChange: { type: "editToolChange", runId: "r2", patch: { worstSec: 4, note: "swap arm" } },
  reset: { type: "reset" },
};

function runIn(plan: MatchPlan, runId: string) {
  const run = plan.runs.find((candidate) => candidate.id === runId);
  assert.ok(run, `run ${runId} is in the plan`);
  return run;
}

describe("plan ops are safe to replay", () => {
  it("applying an op twice equals applying it once", () => {
    const start = applyOp(SEED_PLAN, { type: "editRun", runId: "r3", patch: { launcher: "Kai" } });
    for (const op of Object.values(SAMPLE_OPS)) {
      const once = applyOp(start, op);
      assert.notEqual(once, start, `${op.type} changes the plan`);
      assert.deepEqual(applyOp(once, op), once, op.type);
    }
  });

  it("keeps two people's edits to different fields of the same run, in either order", () => {
    const launcher: PlanOp = { type: "editRun", runId: "r1", patch: { launcher: "Ana" } };
    const end: PlanOp = { type: "editRun", runId: "r1", patch: { end: "RED" } };
    const rear: PlanOp = { type: "editRun", runId: "r1", patch: { loadout: { rear: "claw" } } };
    const merged = applyAll(SEED_PLAN, launcher, end, rear);
    assert.deepEqual(applyAll(SEED_PLAN, rear, end, launcher), merged);
    assert.deepEqual(
      [merged.runs[0].launcher, merged.runs[0].end, merged.runs[0].loadout],
      ["Ana", "RED", { front: "drone hook", rear: "claw", other: "" }],
    );
  });

  it("replays a move pinned to the neighbor the user saw over a teammate's reorder", () => {
    const op = toOp(SEED_PLAN, { type: "moveRun", runId: "r3", by: -1 }, counter());
    assert.deepEqual(op, { type: "moveRun", runId: "r3", to: [{ before: "r2" }, { after: "r1" }] });
    const teammate = applyOp(SEED_PLAN, { type: "moveRun", runId: "r1", to: [{ after: "r3" }] });
    assert.deepEqual(runIds(teammate), ["r2", "r3", "r1"]);
    assert.ok(op);
    assert.deepEqual(runIds(applyOp(teammate, op)), ["r3", "r2", "r1"]);
  });

  it("lands a move next to its other neighbor when a teammate deleted the one it jumped over", () => {
    const op = toOp(SEED_PLAN, { type: "moveRun", runId: "r3", by: -1 }, counter());
    const teammate = applyAll(
      SEED_PLAN,
      { type: "removeRun", runId: "r2" },
      { type: "moveRun", runId: "r3", to: [{ before: "r1" }] },
    );
    assert.deepEqual(runIds(teammate), ["r3", "r1"]);
    assert.ok(op);
    assert.deepEqual(runIds(applyOp(teammate, op)), ["r1", "r3"]);
  });

  it("drops a move when a teammate deleted both of its neighbors", () => {
    const op = toOp(SEED_PLAN, { type: "moveRun", runId: "r3", by: -1 }, counter());
    const teammate = applyAll(SEED_PLAN, { type: "removeRun", runId: "r1" }, { type: "removeRun", runId: "r2" });
    assert.ok(op);
    assert.equal(applyOp(teammate, op), teammate);
  });

  it("replays an added run over a teammate's added run, inheriting from whichever run is last", () => {
    const mine: PlanOp = { type: "addRun", runId: "mine" };
    const teammate = applyAll(SEED_PLAN, { type: "addRun", runId: "theirs" }, {
      type: "editRun",
      runId: "theirs",
      patch: { end: "BLUE", loadout: { front: "net" } },
    });
    const plan = applyOp(teammate, mine);
    assert.deepEqual(runIds(plan), ["r1", "r2", "r3", "theirs", "mine"]);
    assert.deepEqual([runIn(plan, "mine").start, runIn(plan, "mine").loadout.front], ["BLUE", "net"]);
  });

  it("replays a mission edit after a teammate moved that mission's neighbor", () => {
    const teammate = applyOp(SEED_PLAN, { type: "moveMission", missionId: "m3", to: [{ before: "m1" }] });
    const plan = applyOp(teammate, { type: "editMission", missionId: "m1", patch: { notes: "aim left" } });
    assert.deepEqual(
      runIn(plan, "r1").missions.map((mission) => [mission.id, mission.notes]),
      [
        ["m3", ""],
        ["m1", "aim left"],
      ],
    );
  });
});

describe("plan ops that change nothing return the same plan", () => {
  const removed = applyOp(SEED_PLAN, { type: "removeRun", runId: "r2" });

  it("for ops aimed at a run or mission someone deleted", () => {
    const ops: PlanOp[] = [
      { type: "removeRun", runId: "r2" },
      { type: "moveRun", runId: "r2", to: [{ before: "r1" }] },
      { type: "moveRun", runId: "r3", to: [{ before: "r2" }] },
      { type: "editRun", runId: "r2", patch: { launcher: "Kai" } },
      { type: "editToolChange", runId: "r2", patch: { note: "x" } },
      { type: "addMission", runId: "r2", missionId: "x", code: 2 },
      { type: "removeMission", missionId: "m7" },
      { type: "moveMission", missionId: "m7", to: [{ after: "m12" }] },
      { type: "moveMission", missionId: "m1", to: [{ before: "m7" }] },
      { type: "editMission", missionId: "m7", patch: { points: 5 } },
    ];
    for (const op of ops) {
      assert.equal(applyOp(removed, op), removed, `${op.type} ${JSON.stringify(op)}`);
    }
  });

  it("for patches equal to the current values", () => {
    const r1 = SEED_PLAN.runs[0];
    const ops: PlanOp[] = [
      { type: "editRun", runId: "r1", patch: {} },
      { type: "editRun", runId: "r1", patch: { launcher: "Alex", start: "RED", end: "BLUE" } },
      { type: "editRun", runId: "r1", patch: { loadout: { front: "drone hook", other: "" } } },
      { type: "editRun", runId: "r1", patch: { path: r1.path.map((point) => ({ ...point })) } },
      { type: "editMission", missionId: "m1", patch: { uses: "front", points: 20, notes: "" } },
      { type: "editMission", missionId: "m1", patch: { bestSec: 15, worstSec: 25 } },
      { type: "editToolChange", runId: "r2", patch: { bestSec: 10, worstSec: 20, note: "" } },
    ];
    for (const op of ops) {
      assert.equal(applyOp(SEED_PLAN, op), SEED_PLAN, JSON.stringify(op));
    }
  });

  it("for moves to the place an item already holds", () => {
    const ops: PlanOp[] = [
      { type: "moveRun", runId: "r2", to: [{ after: "r1" }] },
      { type: "moveRun", runId: "r2", to: [{ before: "r3" }, { after: "r3" }] },
      { type: "moveRun", runId: "r2", to: [{ before: "r2" }] },
      { type: "moveMission", missionId: "m3", to: [{ after: "m1" }] },
      { type: "moveMission", missionId: "m1", to: [{ before: "m3" }] },
    ];
    for (const op of ops) {
      assert.equal(applyOp(SEED_PLAN, op), SEED_PLAN, JSON.stringify(op));
    }
  });

  it("for adds whose id is already used by any run or mission", () => {
    assert.equal(applyOp(SEED_PLAN, { type: "addRun", runId: "m3" }), SEED_PLAN);
    assert.equal(applyOp(SEED_PLAN, { type: "addMission", runId: "r1", missionId: "r2", code: 2 }), SEED_PLAN);
  });
});

describe("plan op caps", () => {
  it("clips text to the shared caps", () => {
    const plan = applyAll(
      SEED_PLAN,
      { type: "editRun", runId: "r1", patch: { launcher: "a".repeat(100), loadout: { rear: "b".repeat(100) } } },
      { type: "editMission", missionId: "m1", patch: { notes: "c".repeat(900) } },
      { type: "editToolChange", runId: "r2", patch: { note: "d".repeat(300) } },
    );
    assert.equal(plan.runs[0].launcher.length, 40);
    assert.equal(plan.runs[0].loadout.rear.length, 40);
    assert.equal(plan.runs[0].missions[0].notes.length, 500);
    assert.equal(plan.runs[1].toolChangeBefore.note.length, 200);
  });

  it("never cuts an emoji in half when clipping", () => {
    const plan = applyOp(SEED_PLAN, { type: "editRun", runId: "r1", patch: { launcher: `${"a".repeat(39)}🤖🤖` } });
    assert.equal(plan.runs[0].launcher, "a".repeat(39));
    assert.ok(plan.runs[0].launcher.isWellFormed());
  });

  it("stores a path clamped to the mat and at most MAX_PATH_POINTS long, the same way matPath does", () => {
    const drawn = Array.from({ length: MAX_PATH_POINTS + 5 }, (_, i) => ({ x: i % 150, y: -1 }));
    const plan = applyOp(SEED_PLAN, { type: "editRun", runId: "r1", patch: { path: drawn } });
    assert.equal(plan.runs[0].path.length, MAX_PATH_POINTS);
    assert.deepEqual(plan.runs[0].path, matPath(drawn));
    assert.deepEqual(plan.runs[0].path[120], { x: 100, y: 0 });
  });
});

describe("coalesceKey", () => {
  it("matches edits to the same fields of the same target, whatever the values", () => {
    const key = (op: PlanOp) => coalesceKey(op);
    assert.equal(
      key({ type: "editRun", runId: "r1", patch: { launcher: "A" } }),
      key({ type: "editRun", runId: "r1", patch: { launcher: "Ana" } }),
    );
    assert.equal(
      key({ type: "editMission", missionId: "m1", patch: { notes: "a", points: 1 } }),
      key({ type: "editMission", missionId: "m1", patch: { points: 2, notes: "b" } }),
    );
    assert.equal(
      key({ type: "editToolChange", runId: "r2", patch: { note: "a" } }),
      key({ type: "editToolChange", runId: "r2", patch: { note: "b" } }),
    );
  });

  it("tells apart different targets, fields, and loadout slots", () => {
    const keys = [
      coalesceKey({ type: "editRun", runId: "r1", patch: { launcher: "A" } }),
      coalesceKey({ type: "editRun", runId: "r2", patch: { launcher: "A" } }),
      coalesceKey({ type: "editRun", runId: "r1", patch: { loadout: { front: "a" } } }),
      coalesceKey({ type: "editRun", runId: "r1", patch: { loadout: { rear: "a" } } }),
      coalesceKey({ type: "editRun", runId: "r1", patch: { launcher: "A", loadout: { rear: "a" } } }),
      coalesceKey({ type: "editMission", missionId: "m1", patch: { bestSec: 1 } }),
      coalesceKey({ type: "editMission", missionId: "m1", patch: { worstSec: 1 } }),
      coalesceKey({ type: "editToolChange", runId: "r1", patch: { bestSec: 1 } }),
    ];
    assert.equal(new Set(keys).size, keys.length);
  });

  it("never coalesces adds, removes, moves, or a reset", () => {
    for (const op of Object.values(SAMPLE_OPS)) {
      if (op.type.startsWith("edit")) continue;
      assert.equal(coalesceKey(op), null, op.type);
    }
  });
});

describe("parseOps", () => {
  it("accepts every op type after a JSON round trip", () => {
    const ops = Object.values(SAMPLE_OPS);
    assert.deepEqual(parseOps(JSON.parse(JSON.stringify(ops))), ops);
    assert.deepEqual(parseOps([]), []);
  });

  it("rejects the whole batch when any op is malformed", () => {
    const good: PlanOp = { type: "removeRun", runId: "r1" };
    const rejects: [string, unknown][] = [
      ["not an array", { type: "reset" }],
      ["unknown type", [good, { type: "explode" }]],
      ["inherited type name", [{ type: "toString", runId: "r1" }]],
      ["missing runId", [{ type: "removeRun" }]],
      ["empty id", [{ type: "removeRun", runId: "" }]],
      ["id longer than 64", [{ type: "removeRun", runId: "x".repeat(65) }]],
      ["place not a list", [{ type: "moveRun", runId: "r1", to: { before: "r2" } }]],
      ["place with no anchors", [{ type: "moveRun", runId: "r1", to: [] }]],
      [
        "place with three anchors",
        [{ type: "moveRun", runId: "r1", to: [{ before: "r2" }, { after: "r2" }, { after: "r3" }] }],
      ],
      ["anchor with both ends", [{ type: "moveRun", runId: "r1", to: [{ before: "r2", after: "r3" }] }]],
      ["anchor with neither end", [{ type: "moveRun", runId: "r1", to: [{ after: "r2" }, {}] }]],
      ["unknown home", [{ type: "editRun", runId: "r1", patch: { start: "GREEN" } }]],
      ["launcher not text", [{ type: "editRun", runId: "r1", patch: { launcher: 7 } }]],
      ["lone surrogate in text", [{ type: "editMission", missionId: "m1", patch: { notes: "a\uD800" } }]],
      ["lone surrogate in a slot", [{ type: "editRun", runId: "r1", patch: { loadout: { rear: "\uDC00" } } }]],
      ["unknown loadout slot", [{ type: "editRun", runId: "r1", patch: { loadout: { side: "claw" } } }]],
      ["path point without y", [{ type: "editRun", runId: "r1", patch: { path: [{ x: 1 }] } }]],
      ["points not a number", [{ type: "editMission", missionId: "m1", patch: { points: "5" } }]],
      ["unknown attachment", [{ type: "editMission", missionId: "m1", patch: { uses: "top" } }]],
      ["patch not a record", [{ type: "editToolChange", runId: "r1", patch: "note" }]],
      ["unknown mission code", [{ type: "addMission", runId: "r1", missionId: "x", code: 99 }]],
      ["too many ops", Array.from({ length: MAX_OPS_PER_SAVE + 1 }, () => good)],
    ];
    for (const [label, raw] of rejects) {
      assert.equal(parseOps(raw), null, label);
    }
    assert.equal(parseOps(Array.from({ length: MAX_OPS_PER_SAVE }, () => good))?.length, MAX_OPS_PER_SAVE);
  });

  it("drops keys it doesn't know", () => {
    assert.deepEqual(
      parseOps([
        { type: "editRun", runId: "r1", patch: { launcher: "A", evil: 1 }, extra: true },
        { type: "moveMission", missionId: "m1", to: [{ after: "m3", evil: 1 }] },
        { type: "reset", runId: "r1" },
      ]),
      [
        { type: "editRun", runId: "r1", patch: { launcher: "A" } },
        { type: "moveMission", missionId: "m1", to: [{ after: "m3" }] },
        { type: "reset" },
      ],
    );
  });
});

describe("parseBatch", () => {
  const ops = [SAMPLE_OPS.editRun, SAMPLE_OPS.reset];

  it("accepts a batch after a JSON round trip", () => {
    const batch = { id: "batch-1", generation: 3, ops };
    assert.deepEqual(parseBatch(JSON.parse(JSON.stringify(batch))), batch);
  });

  it("rejects a batch without an id, a whole generation, or any ops", () => {
    const rejects: [string, unknown][] = [
      ["not a record", [ops]],
      ["missing id", { generation: 0, ops }],
      ["id longer than 64", { id: "x".repeat(65), generation: 0, ops }],
      ["generation as text", { id: "b", generation: "0", ops }],
      ["negative generation", { id: "b", generation: -1, ops }],
      ["fractional generation", { id: "b", generation: 0.5, ops }],
      ["no ops", { id: "b", generation: 0, ops: [] }],
      ["malformed op", { id: "b", generation: 0, ops: [...ops, { type: "explode" }] }],
    ];
    for (const [label, raw] of rejects) {
      assert.equal(parseBatch(raw), null, label);
    }
  });
});

const STORED_MISSION = { id: "m", code: 1, uses: "front", points: 10, time: { bestSec: 5, worstSec: 9 }, notes: "" };
const STORED_RUN = {
  id: "r",
  launcher: "Kai",
  start: "RED",
  end: "BLUE",
  loadout: { front: "hook", rear: "", other: "" },
  missions: [STORED_MISSION],
  path: [{ x: 10, y: 20 }],
  toolChangeBefore: { time: { bestSec: 5, worstSec: 9 }, note: "" },
};

function storedRun(patch: Record<string, unknown>) {
  return { runs: [{ ...STORED_RUN, ...patch }] };
}

function storedMission(patch: Record<string, unknown>) {
  return storedRun({ missions: [{ ...STORED_MISSION, ...patch }] });
}

describe("parsePlan", () => {
  it("round-trips an edited plan through JSON", () => {
    const plan = apply(
      SEED_PLAN,
      { type: "addRun" },
      { type: "addMission", runId: "new-1", code: 9 },
      { type: "editRun", runId: "new-1", patch: { path: [{ x: 12.5, y: 40 }] } },
    );
    assert.deepEqual(parsePlan(JSON.parse(JSON.stringify(plan))), plan);
    assert.deepEqual(parsePlan(storedRun({})), storedRun({}));
  });

  it("rejects data that is not a plan", () => {
    const rejects: [string, unknown][] = [
      ["null", null],
      ["a string", "plan"],
      ["an array", []],
      ["no runs", {}],
      ["runs not a list", { runs: {} }],
      ["unknown home", storedRun({ start: "GREEN" })],
      ["launcher not text", storedRun({ launcher: 7 })],
      ["missing tool change", storedRun({ toolChangeBefore: undefined })],
      ["loadout slot not text", storedRun({ loadout: { front: 3 } })],
      ["path point missing y", storedRun({ path: [{ x: 1 }] })],
      ["unknown mission code", storedMission({ code: 16 })],
      ["unknown slot", storedMission({ uses: "top" })],
      ["points not a number", storedMission({ points: "10" })],
      ["time not a range", storedMission({ time: { bestSec: 5 } })],
      ["repeated id", storedMission({ id: "r" })],
    ];
    for (const [label, json] of rejects) {
      assert.equal(parsePlan(json), null, label);
    }
  });

  it("repairs numbers, missing text, and out-of-order times", () => {
    const plan = parsePlan(
      storedRun({
        loadout: { front: "hook" },
        path: [{ x: 150, y: -2 }],
        toolChangeBefore: { time: { bestSec: 40, worstSec: 10 } },
        missions: [{ id: "m", code: 1, uses: "none", points: 12.4, time: { bestSec: -3, worstSec: 1200 } }],
      }),
    );
    assert.ok(plan);
    const [run] = plan.runs;
    assert.deepEqual(run.loadout, { front: "hook", rear: "", other: "" });
    assert.deepEqual(run.path, [{ x: 100, y: 0 }]);
    assert.deepEqual(run.toolChangeBefore, { time: { bestSec: 10, worstSec: 40 }, note: "" });
    assert.deepEqual(run.missions[0], {
      id: "m",
      code: 1,
      uses: "none",
      points: 12,
      time: { bestSec: 0, worstSec: 999 },
      notes: "",
    });
    assert.deepEqual(parsePlan(storedRun({ loadout: undefined }))?.runs[0].loadout, { front: "", rear: "", other: "" });
  });
});
