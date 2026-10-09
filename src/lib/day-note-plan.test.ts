import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { journalEntryAt, planDayNoteWrites } from "./day-note-plan";

describe("planDayNoteWrites", () => {
  it("writes only a meeting note for a normal notebook line", () => {
    assert.deepEqual(
      planDayNoteWrites({ kind: "progress", milestone: false, hasMeeting: true }),
      [{ type: "meetingNote", kind: "progress" }],
    );
  });

  it("dual-writes notebook note + milestone when big-moment is checked on a meeting day", () => {
    assert.deepEqual(
      planDayNoteWrites({ kind: "progress", milestone: true, hasMeeting: true }),
      [
        { type: "meetingNote", kind: "progress" },
        { type: "journalEntry", milestone: true },
      ],
    );
  });

  it("dual-writes other day note + milestone on a meeting day", () => {
    assert.deepEqual(
      planDayNoteWrites({ kind: "other", milestone: true, hasMeeting: true }),
      [
        { type: "journalEntry", milestone: false },
        { type: "journalEntry", milestone: true },
      ],
    );
  });

  it("keeps a single milestone journal entry when writing from home", () => {
    assert.deepEqual(
      planDayNoteWrites({ kind: "other", milestone: true, hasMeeting: false }),
      [{ type: "journalEntry", milestone: true }],
    );
  });
});

describe("journalEntryAt", () => {
  it("uses the related meeting startsAt so backfilled milestones land on that day", () => {
    const meetingDay = new Date("2025-09-24T22:00:00.000Z");
    const insertedNow = new Date("2026-10-09T17:00:00.000Z");
    assert.equal(
      journalEntryAt({
        createdAt: insertedNow,
        relatedMeeting: { startsAt: meetingDay },
      }).getTime(),
      meetingDay.getTime(),
    );
  });

  it("falls back to createdAt when there is no meeting", () => {
    const createdAt = new Date("2026-10-09T17:00:00.000Z");
    assert.equal(
      journalEntryAt({ createdAt, relatedMeeting: null }).getTime(),
      createdAt.getTime(),
    );
  });
});
