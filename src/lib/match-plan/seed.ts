import { HOME_ANCHORS, MISSION_PINS } from "./pins";

/**
 * The sample plan as stored JSON. plan.ts parses it through the same gate as saved data, so a bad
 * seed fails at import and in the tests. Run 1's rock flipper sits on the rear slot, because one
 * slot holds one attachment.
 */
export const SEED_JSON = {
  runs: [
    {
      id: "r1",
      launcher: "Alex",
      start: "RED",
      end: "BLUE",
      loadout: { front: "drone hook", rear: "rock flipper", other: "" },
      path: [HOME_ANCHORS.RED, MISSION_PINS[3], MISSION_PINS[1], HOME_ANCHORS.BLUE],
      missions: [
        { id: "m1", code: 1, uses: "front", points: 20, time: { bestSec: 15, worstSec: 25 }, notes: "" },
        { id: "m3", code: 3, uses: "rear", points: 25, time: { bestSec: 20, worstSec: 30 }, notes: "" },
      ],
      toolChange: { time: { bestSec: 15, worstSec: 25 }, note: "" },
    },
    {
      id: "r2",
      launcher: "Sam",
      start: "BLUE",
      end: "BLUE",
      loadout: { front: "elder grip", rear: "fungus arm", other: "" },
      path: [HOME_ANCHORS.BLUE, MISSION_PINS[7], MISSION_PINS[12], HOME_ANCHORS.BLUE],
      missions: [
        { id: "m7", code: 7, uses: "rear", points: 30, time: { bestSec: 20, worstSec: 35 }, notes: "" },
        { id: "m12", code: 12, uses: "front", points: 35, time: { bestSec: 25, worstSec: 40 }, notes: "" },
      ],
      toolChange: { time: { bestSec: 10, worstSec: 20 }, note: "" },
    },
    {
      id: "r3",
      launcher: "Alex",
      start: "RED",
      end: "RED",
      loadout: { front: "leaf scoop", rear: "", other: "" },
      path: [HOME_ANCHORS.RED, MISSION_PINS[4], HOME_ANCHORS.RED],
      missions: [
        { id: "m4", code: 4, uses: "front", points: 15, time: { bestSec: 15, worstSec: 25 }, notes: "" },
      ],
      toolChange: { time: { bestSec: 10, worstSec: 15 }, note: "" },
    },
  ],
};
