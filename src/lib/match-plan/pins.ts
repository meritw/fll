import type { HomeBase, PathPoint } from "./types";

/** Official mat 1064×530. Marker centers as % from interactive-RGR PNG. */
export const MISSION_PINS: Record<number, PathPoint> = {
  1: { x: 45.7, y: 88.5 },
  2: { x: 36.3, y: 53.2 },
  3: { x: 15.3, y: 43.0 },
  4: { x: 17.7, y: 19.1 },
  5: { x: 27.1, y: 13.6 },
  6: { x: 69.9, y: 13.6 },
  7: { x: 74.8, y: 13.6 },
  8: { x: 32.5, y: 13.6 },
  9: { x: 37.0, y: 13.6 },
  10: { x: 41.7, y: 16.8 },
  11: { x: 65.6, y: 48.9 },
  12: { x: 85.5, y: 36.4 },
};

/** Duplicate mission 10 near the river fork. */
export const MISSION_PIN_EXTRAS: Record<number, Array<PathPoint & { note?: string }>> = {
  10: [{ x: 53.7, y: 36.0, note: "river fork" }],
};

export const HOME_ANCHORS: Record<HomeBase, PathPoint> = {
  RED: { x: 14.0, y: 88.0 },
  BLUE: { x: 86.0, y: 88.0 },
};

export const MAT_SRC = "/match-plan/bioglow-mat.png";
export const MAT_WIDTH = 1064;
export const MAT_HEIGHT = 530;
