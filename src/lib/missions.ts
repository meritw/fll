export const MISSIONS = [
  [1, "Drone Survey"],
  [2, "Exploding Seeds"],
  [3, "Flip the Rock"],
  [4, "Lucky Leaves"],
  [5, "Reaching Roots"],
  [6, "Leafcutter Frenzy"],
  [7, "Humongous Fungus"],
  [8, "Tangled"],
  [9, "Research Platform"],
  [10, "Fragile Microhabitats"],
  [11, "Window to the Past"],
  [12, "Forest Elder"],
  [13, "Keystone Species"],
  [14, "Seeds of Renewal"],
  [15, "Biocentric Architecture"],
] as const;

export type MissionSeed = (typeof MISSIONS)[number];
