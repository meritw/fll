import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assignLanes, buildSeasonTimeline, dayNumber, type TimelinePointInput } from "./season-timeline";

const event = (dayKey: string, label: string): TimelinePointInput => ({
  key: `ev-${dayKey}`,
  dayKey,
  label,
  kind: "event",
});
const milestone = (dayKey: string, label: string): TimelinePointInput => ({
  key: `ms-${dayKey}`,
  dayKey,
  label,
  kind: "milestone",
});

describe("dayNumber", () => {
  it("counts calendar days across a DST change", () => {
    assert.equal(dayNumber("2026-11-02") - dayNumber("2026-10-31"), 2);
  });
});

describe("buildSeasonTimeline", () => {
  it("places points by date, so gaps match the time between them", () => {
    const timeline = buildSeasonTimeline({
      points: [event("2026-09-01", "Kickoff"), milestone("2026-09-11", "First run"), event("2026-12-10", "Qualifier")],
      today: "2026-10-01",
    });
    const [kickoff, firstRun, qualifier] = timeline.marks;
    assert.equal(kickoff.at, 0);
    assert.equal(qualifier.at, 1);
    // 10 of the season's 100 days.
    assert.equal(firstRun.at, 0.1);
    assert.equal(timeline.todayAt, 0.3);
  });

  it("reports progress toward the last upcoming season date", () => {
    const timeline = buildSeasonTimeline({
      points: [event("2026-12-10", "Qualifier")],
      today: "2026-10-01",
      firstMeetingDay: "2026-09-01",
    });
    assert.deepEqual(timeline.progress, { percent: 30, weeksLeft: 10, endLabel: "Qualifier" });
    assert.equal(timeline.week, 5);
    assert.equal(timeline.startDay, "2026-09-01");
    assert.equal(timeline.endDay, "2026-12-10");
  });

  it("starts at the earliest point when it is before the first meeting", () => {
    const timeline = buildSeasonTimeline({
      points: [event("2026-08-04", "Season release")],
      today: "2026-10-01",
      firstMeetingDay: "2026-09-01",
    });
    assert.equal(timeline.startDay, "2026-08-04");
  });

  it("leaves the end open, with no percent, until a future date is set", () => {
    const timeline = buildSeasonTimeline({
      points: [milestone("2026-09-20", "First run")],
      today: "2026-10-01",
      firstMeetingDay: "2026-09-01",
    });
    assert.equal(timeline.progress, null);
    assert.equal(timeline.endDay, "2026-10-22");
    assert.ok(timeline.todayAt < 1);
  });

  it("marks points on or before today as past", () => {
    const timeline = buildSeasonTimeline({
      points: [milestone("2026-10-01", "Today's win"), event("2026-11-01", "Scrimmage")],
      today: "2026-10-01",
      firstMeetingDay: "2026-09-01",
    });
    assert.deepEqual(
      timeline.marks.map((mark) => mark.past),
      [true, false],
    );
  });

  it("adds a tick for the first of each month inside the axis", () => {
    const timeline = buildSeasonTimeline({
      points: [event("2026-12-10", "Qualifier")],
      today: "2026-10-01",
      firstMeetingDay: "2026-08-20",
    });
    assert.deepEqual(
      timeline.months.map((month) => month.label),
      ["Sep", "Oct", "Nov", "Dec"],
    );
  });

  it("hangs labels near the right edge leftward", () => {
    const timeline = buildSeasonTimeline({
      points: [event("2026-12-10", "Qualifier")],
      today: "2026-10-01",
      firstMeetingDay: "2026-09-01",
    });
    assert.equal(timeline.marks[0].align, "end");
  });
});

describe("today's label", () => {
  it("always takes the first row and pushes a crowding point down", () => {
    const timeline = buildSeasonTimeline({
      points: [milestone("2026-09-30", "Big win")],
      today: "2026-10-01",
      firstMeetingDay: "2026-09-01",
    });
    assert.equal(timeline.todayLane, 0);
    assert.equal(timeline.marks[0].lane, 1);
    assert.equal(timeline.laneCount, 2);
  });
});

describe("assignLanes", () => {
  it("fits a label before an earlier-placed one in the same row", () => {
    assert.deepEqual(
      assignLanes([
        { from: 0.5, to: 0.7 },
        { from: 0.1, to: 0.3 },
      ]),
      [0, 0],
    );
  });

  it("stacks overlapping labels and reuses a row once it is clear", () => {
    assert.deepEqual(
      assignLanes([
        { from: 0, to: 0.2 },
        { from: 0.1, to: 0.3 },
        { from: 0.25, to: 0.45 },
      ]),
      [0, 1, 0],
    );
  });

  it("drops the label when every row is taken", () => {
    assert.deepEqual(
      assignLanes(
        [
          { from: 0, to: 0.2 },
          { from: 0.05, to: 0.25 },
        ],
        1,
      ),
      [0, null],
    );
  });
});
