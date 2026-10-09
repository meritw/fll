"use client";

/** "Jump to" a month section on the timeline. */
export function JumpToMonth({ months }: { months: { id: string; label: string }[] }) {
  if (months.length < 2) {
    return null;
  }
  return (
    <label className="flex items-center gap-2 text-base text-muted-foreground">
      Jump to
      <select
        defaultValue=""
        onChange={(event) => {
          const id = event.target.value;
          if (id) {
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }}
        className="h-11 rounded-lg border border-input bg-card px-3 text-base text-foreground"
      >
        <option value="" disabled>
          Pick a month
        </option>
        {months.map((month) => (
          <option key={month.id} value={month.id}>
            {month.label}
          </option>
        ))}
      </select>
    </label>
  );
}
