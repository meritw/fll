import { HOME_ANCHORS, MISSION_PINS } from "./pins";

export const SEED_JSON = {
  runs: [
    {
      id: "r1",
      launcher: "Alex",
      start: "RED",
      end: "BLUE",
      loadout: { front: "drone hook", rear: "rock flipper", other: "" },
      time: { bestSec: 35, worstSec: 55 },
      path: [HOME_ANCHORS.RED, MISSION_PINS[3], MISSION_PINS[1], HOME_ANCHORS.BLUE],
      missions: [
        { id: "m1", code: 1, uses: "front", points: 20, notes: "" },
        { id: "m3", code: 3, uses: "rear", points: 25, notes: "" },
      ],
      toolChangeBefore: { time: { bestSec: 15, worstSec: 25 }, note: "" },
    },
    {
      id: "r2",
      launcher: "Sam",
      start: "BLUE",
      end: "BLUE",
      loadout: { front: "elder grip", rear: "fungus arm", other: "" },
      time: { bestSec: 45, worstSec: 75 },
      path: [HOME_ANCHORS.BLUE, MISSION_PINS[7], MISSION_PINS[12], HOME_ANCHORS.BLUE],
      missions: [
        { id: "m7", code: 7, uses: "rear", points: 30, notes: "" },
        { id: "m12", code: 12, uses: "front", points: 35, notes: "" },
      ],
      toolChangeBefore: { time: { bestSec: 10, worstSec: 20 }, note: "" },
    },
    {
      id: "r3",
      launcher: "Alex",
      start: "RED",
      end: "RED",
      loadout: { front: "leaf scoop", rear: "", other: "" },
      time: { bestSec: 15, worstSec: 25 },
      path: [HOME_ANCHORS.RED, MISSION_PINS[4], HOME_ANCHORS.RED],
      missions: [
        { id: "m4", code: 4, uses: "front", points: 15, notes: "" },
      ],
      toolChangeBefore: { time: { bestSec: 10, worstSec: 15 }, note: "" },
    },
  ],
};
