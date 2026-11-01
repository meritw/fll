export type HomeBase = "RED" | "BLUE";

export type PathPoint = { x: number; y: number };

export type MissionStep = {
  id: string;
  code: number;
  name: string;
  front: string;
  rear: string;
  other: string;
  points: number;
  bestSec: number;
  worstSec: number;
  notes: string;
};

export type RunStep = {
  kind: "run";
  id: string;
  label: string;
  color: string;
  launcher: string;
  start: HomeBase;
  end: HomeBase;
  path: PathPoint[];
  missions: MissionStep[];
};

export type ToolChangeStep = {
  kind: "tool";
  id: string;
  note: string;
  bestSec: number;
  worstSec: number;
};

export type PlanStep = RunStep | ToolChangeStep;

export type MatchPlan = {
  matchSec: number;
  steps: PlanStep[];
};

export type PlanTotals = {
  bestSec: number;
  worstSec: number;
  points: number;
};
