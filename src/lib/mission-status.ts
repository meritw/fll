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

/** Tailwind classes for a filled status pill or selected button. One orange ramp, lightness-separated. */
export const MISSION_STATUS_CLASSES: Record<MissionStatus, string> = {
  none: "bg-[#F1EEE7] text-[#3F3B35]",
  trying: "bg-[#F3CDAE] text-[#5A2A0E]",
  some: "bg-[#DB8A52] text-[#2A1406]",
  every: "bg-[#A84A1C] text-white",
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
