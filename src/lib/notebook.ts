/** Notebook line kinds matching the 2026 Engineering Notebook template. */
export const NOTEBOOK_KINDS = ["progress", "action", "lesson"] as const;
export type NotebookKind = (typeof NOTEBOOK_KINDS)[number];

export const NOTEBOOK_SECTION_LABELS: Record<NotebookKind, string> = {
  progress: "Today’s Progress",
  action: "Action Items for Next Meeting",
  lesson: "Lessons Learned",
};

export function isNotebookKind(value: string): value is NotebookKind {
  return (NOTEBOOK_KINDS as readonly string[]).includes(value);
}
