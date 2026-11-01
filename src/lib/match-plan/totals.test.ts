import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SEED_MATCH_PLAN } from "./seed";
import { attachmentChips, formatMatchClock, planTotals, runPoints } from "./totals";

describe("match-plan totals", () => {
  it("sums seed best/worst/points", () => {
    const totals = planTotals(SEED_MATCH_PLAN);
    assert.equal(totals.bestSec, 185);
    assert.equal(totals.worstSec, 300);
    assert.equal(totals.points, 125);
  });

  it("formats clock", () => {
    assert.equal(formatMatchClock(150), "2:30");
    assert.equal(formatMatchClock(0), "0:00");
  });

  it("lists attachment chips in slot order", () => {
    assert.deepEqual(
      attachmentChips({ front: "hook", rear: "arm", other: "" }),
      [
        { slot: "Front", name: "hook" },
        { slot: "Rear", name: "arm" },
      ],
    );
  });

  it("sums run points", () => {
    const run = SEED_MATCH_PLAN.steps.find((step) => step.kind === "run" && step.id === "r1");
    assert.ok(run && run.kind === "run");
    assert.equal(runPoints(run), 45);
  });
});
