import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HOME_ANCHORS, MISSION_PINS } from "./pins";
import { parsePlan, reducePlan, SEED_PLAN, type MatchPlan, type PlanCommand } from "./plan";
import { formatMatchClock, suggestedPath, viewPlan, type ToolChangeView } from "./view";

function counter() {
  let n = 0;
  return () => `new-${++n}`;
}

function apply(plan: MatchPlan, ...commands: PlanCommand[]): MatchPlan {
  const newId = counter();
  return commands.reduce((current, command) => reducePlan(current, command, newId), plan);
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
  it("totals best 185 s, worst 300 s, 125 pts, and is over the 150 s match", () => {
    const view = viewPlan(SEED_PLAN);
    assert.deepEqual(totals(SEED_PLAN), { points: 125, bestSec: 185, worstSec: 300 });
    assert.deepEqual(view.totals.best, { sec: 185, leftSec: -35, over: true });
    assert.equal(view.totals.worst.leftSec, -150);
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
      code: "M01",
      name: "Drone Survey",
      attachment: { slot: "front", name: "drone hook" },
    });
    assert.deepEqual(missionLine(SEED_PLAN, "m3").attachment, { slot: "rear", name: "rock flipper" });
    assert.deepEqual(missionLine(SEED_PLAN, "m7").attachment, { slot: "rear", name: "fungus arm" });
  });

  it("derives each tool change's swaps and home move from its neighbors", () => {
    const [first, second] = toolChanges(SEED_PLAN);
    assert.equal(first.runId, "r2");
    assert.deepEqual(first.toolChange.time, { bestSec: 20, worstSec: 35 });
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

describe("reducePlan runs", () => {
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
      toolChange: { time: { bestSec: 15, worstSec: 25 }, note: "" },
    });
    const last = toolChanges(plan)[2];
    assert.deepEqual([last.runId, last.swaps, last.move], ["new-1", [], null]);
    assert.deepEqual(totals(plan), { points: 125, bestSec: 200, worstSec: 325 });
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
    assert.deepEqual(toolChanges(plan)[0].toolChange.time, { bestSec: 15, worstSec: 25 });
    assert.deepEqual(totals(plan), { points: 60, bestSec: 90, worstSec: 150 });
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
        ["r3", { bestSec: 15, worstSec: 25 }],
      ],
    );
    assert.deepEqual(totals(plan), { points: 125, bestSec: 180, worstSec: 290 });
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

describe("reducePlan edits", () => {
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
    assert.deepEqual([line.code, line.name, line.attachment, line.mission.points], ["M13", "Keystone Species", null, 0]);
  });

  it("removes and moves missions within their run", () => {
    const removed = apply(SEED_PLAN, { type: "removeMission", missionId: "m1" });
    assert.deepEqual(removed.runs[0].missions.map((mission) => mission.id), ["m3"]);
    assert.deepEqual(totals(removed), { points: 105, bestSec: 160, worstSec: 260 });
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

  it("retimes so the edited end wins and best never passes worst", () => {
    const time = (patch: { bestSec?: number; worstSec?: number }) =>
      apply(SEED_PLAN, { type: "editMission", missionId: "m1", patch }).runs[0].missions[0].time;
    assert.deepEqual(time({ bestSec: 30 }), { bestSec: 30, worstSec: 40 });
    assert.deepEqual(time({ bestSec: 50 }), { bestSec: 50, worstSec: 50 });
    assert.deepEqual(time({ worstSec: 10 }), { bestSec: 10, worstSec: 10 });
    assert.deepEqual(time({ bestSec: 45, worstSec: 12 }), { bestSec: 12, worstSec: 45 });
    assert.deepEqual(time({ worstSec: 1500 }), { bestSec: 25, worstSec: 999 });
  });

  it("edits the tool change before a run with the same retime rule", () => {
    const plan = apply(SEED_PLAN, {
      type: "editToolChange",
      runId: "r2",
      patch: { worstSec: 10, note: "check the grip" },
    });
    assert.deepEqual(toolChanges(plan)[0].toolChange, { time: { bestSec: 10, worstSec: 10 }, note: "check the grip" });
    assert.deepEqual(totals(plan), { points: 125, bestSec: 175, worstSec: 275 });
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

const STORED_MISSION = { id: "m", code: 1, uses: "front", points: 10, time: { bestSec: 5, worstSec: 9 }, notes: "" };
const STORED_RUN = {
  id: "r",
  launcher: "Kai",
  start: "RED",
  end: "BLUE",
  loadout: { front: "hook", rear: "", other: "" },
  missions: [STORED_MISSION],
  path: [{ x: 10, y: 20 }],
  toolChange: { time: { bestSec: 5, worstSec: 9 }, note: "" },
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
      ["missing tool change", storedRun({ toolChange: undefined })],
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
        toolChange: { time: { bestSec: 40, worstSec: 10 } },
        missions: [{ id: "m", code: 1, uses: "none", points: 12.4, time: { bestSec: -3, worstSec: 1200 } }],
      }),
    );
    assert.ok(plan);
    const [run] = plan.runs;
    assert.deepEqual(run.loadout, { front: "hook", rear: "", other: "" });
    assert.deepEqual(run.path, [{ x: 100, y: 0 }]);
    assert.deepEqual(run.toolChange, { time: { bestSec: 10, worstSec: 40 }, note: "" });
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
