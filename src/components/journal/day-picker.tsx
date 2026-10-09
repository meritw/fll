"use client";

import { useRouter } from "next/navigation";

/** "Different day?" — jump to another meeting's page, or today. */
export function DayPicker({
  current,
  options,
}: {
  current: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  if (options.length < 2) {
    return null;
  }
  return (
    <label className="flex flex-wrap items-center gap-2 text-base text-muted-foreground">
      Different day?
      <select
        value={current}
        onChange={(event) => {
          const value = event.target.value;
          router.push(value === "today" ? "/journal/today" : `/journal/${value}`);
        }}
        className="h-11 max-w-full rounded-lg border border-input bg-card px-3 text-base text-foreground"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
