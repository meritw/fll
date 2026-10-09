import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  daySpan,
  layoutSeasonMarks,
  nudgeFractions,
  seasonFraction,
  SEASON_END_DAY,
  SEASON_START_DAY,
} from "./season";

describe("seasonFraction", () => {
  it("puts season start at 0 and end at 1", () => {
    assert.equal(seasonFraction(SEASON_START_DAY), 0);
    assert.equal(seasonFraction(SEASON_END_DAY), 1);
  });

  it("maps mid-season dates proportionally", () => {
    const span = daySpan(SEASON_START_DAY, SEASON_END_DAY);
    const mid = seasonFraction("2026-10-17");
    // Aug 4 → Dec 31 is 149 days; Oct 17 is 74 days in → ~0.497
    assert.ok(Math.abs(mid - 74 / span) < 1e-9);
  });

  it("clamps outside the axis", () => {
    assert.equal(seasonFraction("2026-01-01"), 0);
    assert.equal(seasonFraction("2027-06-01"), 1);
  });
});

describe("nudgeFractions", () => {
  it("keeps large gaps larger than consecutive-day clusters", () => {
    // Sep 24, Oct 1 (~1 week), Oct 2 (next day) on a short axis for clarity.
    const raw = [0.1, 0.147, 0.154];
    const nudged = nudgeFractions(raw, 0.02);
    const weekGap = nudged[1]! - nudged[0]!;
    const dayGap = nudged[2]! - nudged[1]!;
    assert.ok(weekGap > dayGap);
    assert.ok(dayGap >= 0.02 - 1e-9);
  });

  it("compresses back into 0..1 when min gaps would overflow", () => {
    const nudged = nudgeFractions([0.9, 0.91, 0.92], 0.02);
    assert.ok(nudged[nudged.length - 1]! <= 1 + 1e-9);
    assert.ok(nudged[0]! <= nudged[1]!);
  });
});

describe("layoutSeasonMarks", () => {
  it("places today on the progress fill and groups same-day keys", () => {
    const layout = layoutSeasonMarks(
      ["2026-09-24", "2026-09-24", "2026-10-01", "2026-10-02"],
      "2026-10-09",
      { minGap: 0.02 },
    );
    assert.equal(layout.axisStart, SEASON_START_DAY);
    assert.equal(layout.axisEnd, SEASON_END_DAY);
    assert.equal(layout.marks.length, 4); // Sep 24, Oct 1, Oct 2, today
    assert.ok(layout.progress > layout.marks[0]!.rawLeft);
    assert.ok(layout.progress < 1);

    const sep = layout.marks[0]!;
    const oct1 = layout.marks[1]!;
    const oct2 = layout.marks[2]!;
    assert.equal(sep.dayKey, "2026-09-24");
    assert.equal(oct1.dayKey, "2026-10-01");
    assert.equal(oct2.dayKey, "2026-10-02");
    // Week gap (Sep 24→Oct 1) stays wider than consecutive days (Oct 1→Oct 2).
    assert.ok(oct1.rawLeft - sep.rawLeft > oct2.rawLeft - oct1.rawLeft);
    assert.ok(oct1.left - sep.left > oct2.left - oct1.left);
  });

  it("extends the axis when a coach date is after season end", () => {
    const layout = layoutSeasonMarks(["2027-02-15"], "2026-10-09");
    assert.equal(layout.axisEnd, "2027-02-15");
    assert.ok(layout.progress < 1);
  });
});
