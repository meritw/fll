/** Robot-game mission status, shared by the Missions page and the journal. */
export const MISSION_STATUSES = ["none", "trying", "some", "every"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  none: "Not yet",
  trying: "Trying",
  some: "Sometimes",
  every: "Every time",
};

export const MISSION_STATUS_HINTS: Record<MissionStatus, string> = {
  none: "Nobody has tried",
  trying: "Started, not working yet",
  some: "Works some runs",
  every: "Works on every run",
};

/** Tailwind classes for a filled status pill or selected button. One blue ramp, lightness-separated. */
export const MISSION_STATUS_CLASSES: Record<MissionStatus, string> = {
  none: "bg-status-none text-status-none-ink",
  trying: "bg-status-trying text-status-trying-ink",
  some: "bg-status-some text-status-some-ink",
  every: "bg-status-every text-status-every-ink",
};

export function isMissionStatus(value: string): value is MissionStatus {
  return (MISSION_STATUSES as readonly string[]).includes(value);
}

export function toMissionStatus(value: string | null | undefined): MissionStatus {
  return value && isMissionStatus(value) ? value : "none";
}

/** "Working" = sometimes or every time. Used for "6 of 15 working". */
export function isWorking(status: MissionStatus) {
  return status === "some" || status === "every";
}

export function missionCode(number: number) {
  return `M${String(number).padStart(2, "0")}`;
}
