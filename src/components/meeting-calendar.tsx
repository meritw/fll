import Link from "next/link";

import { teamDateKey } from "@/lib/timezone";

type CalendarMeeting = {
  id: string;
  startsAt: Date;
  title: string | null;
  sessionNumber?: number | null;
};

type DayCell = {
  dateKey: string;
  day: number;
  inMonth: boolean;
  meetings: CalendarMeeting[];
};

function buildMonthGrid(year: number, month: number, meetings: CalendarMeeting[]): DayCell[] {
  const byDay = new Map<string, CalendarMeeting[]>();
  for (const item of meetings) {
    const key = teamDateKey(item.startsAt);
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }

  // Week starts Sunday to match common US calendars.
  const startWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const daysInPrev = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();

  const cells: DayCell[] = [];
  for (let i = 0; i < startWeekday; i++) {
    const day = daysInPrev - startWeekday + i + 1;
    const dateKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ dateKey, day, inMonth: false, meetings: byDay.get(dateKey) ?? [] });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ dateKey, day, inMonth: true, meetings: byDay.get(dateKey) ?? [] });
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - (startWeekday + daysInMonth) + 1;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const dateKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ dateKey, day, inMonth: false, meetings: byDay.get(dateKey) ?? [] });
  }

  return cells;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MeetingCalendar({
  year,
  month,
  meetings,
  prevHref,
  nextHref,
  label,
}: {
  year: number;
  month: number;
  meetings: CalendarMeeting[];
  prevHref: string;
  nextHref: string;
  label: string;
}) {
  const cells = buildMonthGrid(year, month, meetings);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <ButtonLink href={prevHref}>Previous</ButtonLink>
        <h2 className="text-2xl font-semibold">{label}</h2>
        <ButtonLink href={nextHref}>Next</ButtonLink>
      </div>
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="grid min-w-[40rem] grid-cols-7 border-b">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-3 text-center text-sm font-semibold sm:text-base">
              {day}
            </div>
          ))}
        </div>
        <div className="grid min-w-[40rem] grid-cols-7">
          {cells.map((cell) => (
            <div
              key={cell.dateKey}
              className={`min-h-24 border-t border-r p-2 last:border-r-0 [&:nth-child(7n)]:border-r-0 ${
                cell.inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground"
              }`}
            >
              <div className="mb-1 text-sm font-medium">{cell.day}</div>
              <ul className="flex flex-col gap-1">
                {cell.meetings.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/meetings/${item.id}`}
                      className="block rounded-md bg-primary/10 px-1.5 py-1 text-sm font-medium text-foreground underline-offset-2 hover:bg-primary/20 hover:underline"
                    >
                      {item.sessionNumber != null
                        ? `Session ${item.sessionNumber}`
                        : item.title?.trim() || "Meeting"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border px-4 py-2 text-base font-medium hover:bg-muted"
    >
      {children}
    </Link>
  );
}
