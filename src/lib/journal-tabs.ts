export const JOURNAL_TABS = ["attend", "note", "media", "robot"] as const;
export type JournalTab = (typeof JOURNAL_TABS)[number];

export const JOURNAL_TAB_LABELS: Record<JournalTab, string> = {
  attend: "Attendance",
  note: "Note",
  media: "Photos",
  robot: "Robot",
};

/** Parents only see Photos and Note. */
export function tabsFor(parent: boolean): JournalTab[] {
  return parent ? ["media", "note"] : [...JOURNAL_TABS];
}

export function resolveInitialTab(
  raw: string | string[] | undefined,
  options: { isToday: boolean; parent: boolean },
): JournalTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const allowed = tabsFor(options.parent);
  if (value && (allowed as string[]).includes(value)) {
    return value as JournalTab;
  }
  if (options.parent) {
    return "media";
  }
  return options.isToday ? "attend" : "note";
}
