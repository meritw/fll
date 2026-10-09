import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { cn } from "cn";

import { MissionDetail } from "@/components/journal/mission-detail";
import { StatusBar, StatusLegend, StatusPill } from "@/components/journal/status-pill";
import { listStudents } from "@/lib/accounts";
import { isWorking, missionCode, type MissionStatus } from "@/lib/mission-status";
import { listMissionBoard, listMissionNotes } from "@/lib/missions-board";
import { isCoach, isParent, isStudent } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { formatTeamStamp } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Missions",
};

const FILTERS = ["all", "mine", "open", "notyet"] as const;
type Filter = (typeof FILTERS)[number];

type PageProps = {
  searchParams: Promise<{ m?: string; show?: string }>;
};

export default async function MissionsPage({ searchParams }: PageProps) {
  const session = await requireUser();
  const role = session.user.role;
  const coach = isCoach(role);
  const student = isStudent(role);
  const me = session.user.id;
  const params = await searchParams;
  const show: Filter = (FILTERS as readonly string[]).includes(params.show ?? "")
    ? (params.show as Filter)
    : "all";

  const [board, students] = await Promise.all([listMissionBoard(), listStudents()]);

  const counts: Record<MissionStatus, number> = { none: 0, trying: 0, some: 0, every: 0 };
  for (const item of board) {
    counts[item.status] += 1;
  }
  const workingCount = board.filter((item) => isWorking(item.status)).length;
  const openCount = board.filter((item) => item.assignees.length === 0).length;

  const visible = board.filter((item) => {
    if (show === "mine") {
      return coach
        ? item.assignees.length === 0
        : item.assignees.some((person) => person.id === me);
    }
    if (show === "open") return item.assignees.length === 0;
    if (show === "notyet") return !isWorking(item.status);
    return true;
  });

  const requested = Number(params.m);
  const selected =
    board.find((item) => item.number === requested) ??
    board.find((item) => item.assignees.some((person) => person.id === me)) ??
    board[0];

  const notes = selected ? await listMissionNotes(selected.id) : [];
  const loads = new Map<string, number>();
  for (const item of board) {
    for (const person of item.assignees) {
      loads.set(person.id, (loads.get(person.id) ?? 0) + 1);
    }
  }

  const filterLabels: Record<Filter, string> = {
    all: `All ${board.length}`,
    mine: coach ? "Unassigned" : "My missions",
    open: "Need people",
    notyet: "Not working yet",
  };
  const filters = FILTERS.filter((key) => key !== "mine" || coach || student);
  const hrefFor = (next: { m?: number; show?: Filter }) => {
    const query = new URLSearchParams();
    const nextShow = next.show ?? show;
    if (nextShow !== "all") query.set("show", nextShow);
    const nextM = next.m ?? selected?.number;
    if (nextM) query.set("m", String(nextM));
    const text = query.toString();
    return text ? `/missions?${text}` : "/missions";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-sm tracking-[0.08em] text-primary uppercase">
            Robot game · {board.length} missions
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Missions</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Pick a mission to work on, keep notes about what you tried, and update how it&apos;s
            going. Changes save by themselves.
          </p>
        </div>
        <div className="flex min-w-[260px] flex-[0_1_380px] flex-col gap-2">
          <div className="flex justify-between text-base">
            <span className="font-semibold">
              {workingCount} of {board.length} working
            </span>
            <span className="text-muted-foreground">{openCount} need people</span>
          </div>
          <StatusBar counts={counts} />
          <StatusLegend counts={counts} />
        </div>
      </div>

      {coach ? (
        <p className="flex items-center gap-3 rounded-2xl bg-info-tint px-4 py-3 text-base text-info-ink">
          <ShieldCheck className="size-6 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Coach view.</span> You can add or remove team members on any
            mission. Team members still choose their own and set status.
          </span>
        </p>
      ) : null}

      <nav aria-label="Show" className="flex flex-wrap gap-2">
        {filters.map((key) => (
          <Link
            key={key}
            href={hrefFor({ show: key })}
            aria-current={show === key ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-base",
              show === key
                ? "border-foreground bg-foreground text-background"
                : "border-line bg-card hover:bg-muted",
            )}
          >
            {filterLabels[key]}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-start gap-6">
        <ul aria-label="Missions" className="flex min-w-0 flex-[1_1_340px] flex-col gap-2">
          {visible.length === 0 ? (
            <li className="rounded-2xl bg-card px-4 py-5 text-muted-foreground ring-1 ring-line">
              {show === "mine" && !coach
                ? "You're not on a mission yet. Pick one and tap “I want to work on this”."
                : "No missions here."}
            </li>
          ) : null}
          {visible.map((item) => {
            const current = item.id === selected?.id;
            const mine = item.assignees.some((person) => person.id === me);
            return (
              <li key={item.id}>
                <Link
                  href={`${hrefFor({ m: item.number })}#detail`}
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-2xl px-4 py-2.5",
                    current
                      ? "bg-brand-soft ring-2 ring-primary"
                      : "bg-card ring-1 ring-line hover:bg-muted/60",
                  )}
                >
                  <span className="w-9 shrink-0 font-mono text-base text-muted-foreground">
                    {missionCode(item.number)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-lg leading-snug font-semibold">{item.name}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {item.assignees.length > 0
                        ? item.assignees.map((person) => person.name).join(", ") +
                          (mine && student ? " · you" : "")
                        : "Needs people"}
                    </span>
                  </span>
                  <StatusPill status={item.status} />
                </Link>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <MissionDetail
            key={selected.id}
            mission={{
              id: selected.id,
              number: selected.number,
              name: selected.name,
              status: selected.status,
              lastChange:
                selected.statusUpdatedAt && selected.statusUpdatedByName
                  ? `Last changed by ${selected.statusUpdatedByName}, ${formatTeamStamp(selected.statusUpdatedAt)}`
                  : null,
              assignees: selected.assignees,
            }}
            notes={notes.map((note) => ({
              id: note.id,
              body: note.body,
              byline: [
                note.authorName,
                formatTeamStamp(note.createdAt),
                note.sessionNumber != null ? `Session ${note.sessionNumber}` : null,
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
            viewer={{
              id: me,
              role: coach ? "coach" : student ? "student" : isParent(role) ? "parent" : "other",
            }}
            students={students.map((person) => ({
              id: person.id,
              name: person.name,
              load: loads.get(person.id) ?? 0,
            }))}
          />
        ) : null}
      </div>
    </div>
  );
}
