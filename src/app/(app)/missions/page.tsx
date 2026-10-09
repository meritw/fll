import { Shield } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  MissionNoteForm,
  MissionPeople,
  MissionStatusPicker,
} from "@/components/missions-board";
import {
  countStatuses,
  MissionStatusBar,
  MissionStatusLegend,
} from "@/components/mission-status-bar";
import { StatusPill } from "@/components/status-pill";
import { listStudents } from "@/lib/accounts";
import { shortDate } from "@/lib/journal-format";
import { isWorking, MISSION_STATUS_LABELS, missionCode } from "@/lib/mission-status";
import {
  getMissionDetail,
  listMissionBoard,
  missionLoadByStudent,
} from "@/lib/missions-board";
import { isCoach, isParent, isStudent } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Missions",
};

type PageProps = {
  searchParams: Promise<{ m?: string | string[]; show?: string | string[] }>;
};

const FILTERS = ["all", "mine", "open", "notyet"] as const;
type Filter = (typeof FILTERS)[number];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MissionsPage({ searchParams }: PageProps) {
  const session = await requireUser();
  const params = await searchParams;
  const viewer = {
    id: session.user.id,
    name: session.user.name,
    role: session.user.role,
  };
  const coach = isCoach(viewer.role);
  const parent = isParent(viewer.role);
  const student = isStudent(viewer.role);

  const board = await listMissionBoard();
  const requested = Number(first(params.m));
  const mine = board.filter((item) => item.assignees.some((person) => person.id === viewer.id));
  const selectedNumber = board.some((item) => item.number === requested)
    ? requested
    : (mine[0]?.number ?? board[0]?.number ?? 1);

  const showRaw = first(params.show);
  let show: Filter = FILTERS.includes(showRaw as Filter) ? (showRaw as Filter) : "all";
  if (show === "mine" && !student) {
    show = "all";
  }

  const [detail, students, load] = await Promise.all([
    getMissionDetail(selectedNumber),
    coach ? listStudents() : Promise.resolve([]),
    coach ? missionLoadByStudent() : Promise.resolve(new Map<string, number>()),
  ]);

  const counts = countStatuses(board);
  const workingCount = board.filter((item) => isWorking(item.status)).length;
  const needPeople = board.filter((item) => item.assignees.length === 0).length;

  const visible = board.filter((item) => {
    if (show === "mine") {
      return item.assignees.some((person) => person.id === viewer.id);
    }
    if (show === "open") {
      return item.assignees.length === 0;
    }
    if (show === "notyet") {
      return item.status === "none" || item.status === "trying";
    }
    return true;
  });

  const filterPills: { key: Filter; label: string }[] = [
    { key: "all", label: `All ${board.length}` },
    ...(student ? [{ key: "mine" as const, label: "My missions" }] : []),
    { key: "open", label: coach ? "Unassigned" : "Need people" },
    { key: "notyet", label: "Not working yet" },
  ];

  const href = (number: number, nextShow: Filter) =>
    `/missions?m=${number}${nextShow === "all" ? "" : `&show=${nextShow}`}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-xl flex-col gap-2">
          <p className="font-mono text-sm tracking-widest text-primary uppercase">
            Robot game · {board.length} missions
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Missions</h1>
          <p className="text-lg text-ink-muted">
            Pick a mission to work on, keep notes about what you tried, and update how
            it&apos;s going. Changes save by themselves.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-80">
          <p className="font-semibold">
            {workingCount} of {board.length} working · {needPeople} need people
          </p>
          <MissionStatusBar counts={counts} />
          <MissionStatusLegend counts={counts} />
        </div>
      </header>

      {coach ? (
        <div className="flex items-start gap-3 rounded-2xl bg-info-bg p-4 text-info-text">
          <Shield className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <strong>Coach view.</strong> You can add or remove kids on any mission. Kids still
            choose their own and set status.
          </p>
        </div>
      ) : null}

      <nav aria-label="Filter missions" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {filterPills.map((pill) => (
          <Link
            key={pill.key}
            href={href(selectedNumber, pill.key)}
            aria-current={show === pill.key ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 font-medium",
              show === pill.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-line bg-card hover:border-primary",
            )}
          >
            {pill.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section aria-label="Mission list" className="order-2 flex flex-col gap-2 lg:order-1 lg:w-[360px] lg:shrink-0">
          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-4 text-ink-muted">
              No missions match this filter.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((item) => {
                const selected = item.number === selectedNumber;
                const names = item.assignees
                  .map((person) => (person.id === viewer.id ? "you" : person.name))
                  .join(", ");
                const youOn = item.assignees.some((person) => person.id === viewer.id);
                return (
                  <li key={item.id}>
                    <Link
                      href={href(item.number, show)}
                      aria-current={selected ? "true" : undefined}
                      className={cn(
                        "flex min-h-16 items-center gap-3 rounded-2xl border-2 px-3 py-2 transition-colors",
                        selected
                          ? "border-primary bg-primary-tint-soft"
                          : "border-line bg-card hover:border-primary/60",
                      )}
                    >
                      <span className="font-mono text-sm font-semibold text-primary">
                        {missionCode(item.number)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-semibold">{item.name}</span>
                        <span className="truncate text-sm text-ink-muted">
                          {item.assignees.length === 0
                            ? "Needs people"
                            : youOn && item.assignees.length > 1
                              ? `${item.assignees
                                  .filter((person) => person.id !== viewer.id)
                                  .map((person) => person.name)
                                  .join(", ")} · you`
                              : names}
                        </span>
                      </span>
                      <StatusPill status={item.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          id="detail"
          aria-label="Mission detail"
          className="order-1 flex min-w-0 scroll-mt-4 flex-col gap-8 rounded-2xl border border-line bg-card p-5 sm:p-6 lg:order-2 lg:flex-1"
        >
          {detail ? (
            <>
              <div className="flex flex-col gap-1">
                <p className="font-mono text-sm tracking-widest text-primary uppercase">
                  Mission {detail.number}
                </p>
                <h2 className="text-3xl font-bold">{detail.name}</h2>
              </div>

              <MissionPeople
                key={`people-${detail.id}`}
                missionId={detail.id}
                assignees={detail.assignees}
                viewer={viewer}
                students={students.map((person) => ({
                  id: person.id,
                  name: person.name,
                  load: load.get(person.id) ?? 0,
                }))}
              />

              <MissionStatusPicker
                key={`status-${detail.id}`}
                missionId={detail.id}
                status={detail.status}
                readOnly={parent}
                lastChange={
                  detail.statusUpdatedAt
                    ? `Last changed${detail.statusUpdatedBy ? ` by ${detail.statusUpdatedBy.name}` : ""}, ${shortDate(detail.statusUpdatedAt)} (${MISSION_STATUS_LABELS[detail.status]})`
                    : null
                }
              />

              <section aria-labelledby="mission-notes" className="flex flex-col gap-3">
                <h3 id="mission-notes" className="text-xl font-semibold">
                  Mission notes
                </h3>
                {detail.notes.length === 0 ? (
                  <p className="text-ink-muted">
                    No notes yet. Write down your first idea for this mission.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {detail.notes.map((note) => (
                      <li key={note.id} className="rounded-xl bg-primary-tint-soft px-4 py-3">
                        <p className="whitespace-pre-wrap">{note.body}</p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {note.authorName} · {shortDate(note.createdAt)}
                          {note.sessionNumber != null ? (
                            <>
                              {" · "}
                              {note.meetingId ? (
                                <Link
                                  href={`/journal/${note.meetingId}`}
                                  className="underline-offset-4 hover:underline"
                                >
                                  Session {note.sessionNumber}
                                </Link>
                              ) : (
                                `Session ${note.sessionNumber}`
                              )}
                            </>
                          ) : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {!parent ? <MissionNoteForm key={`note-${detail.id}`} missionId={detail.id} /> : null}
              </section>
            </>
          ) : (
            <p className="text-ink-muted">Pick a mission from the list.</p>
          )}
        </section>
      </div>
    </div>
  );
}
