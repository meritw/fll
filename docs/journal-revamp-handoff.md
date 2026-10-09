# Handoff: Journal revamp + Missions page (replaces Meetings)

This is a build spec for the Rolling Sparks (FLL team 55900) app. It was written after a design pass with the team's coach. Build it in this repo, in the order under **Build order**. Each phase can ship as its own PR.

**Read first:** `AGENTS.md`. This is Next.js 16.3 (`proxy.ts`, not middleware; async `params` and `searchParams`; `refresh()` from `next/cache` in server actions). Read the matching guide in `node_modules/next/dist/docs/` before using any Next API you're unsure of.

---

## 1. What we're building and for whom

**Audience:** an FLL Challenge team of 5th graders, plus their parents and coaches.
- **Kids** add most of the content: attendance, notes and robot progress, mostly from a shared tablet or laptop during the meeting.
- **Parents and coaches** mostly add photos and videos, often from a phone.

**Goals:**
1. **Journal** (`/journal`) becomes the team's season story, newest first, with a clear timeline. It's also *the* place to add things: attendance, notes, photos and videos, and robot progress.
2. **Missions** (`/missions`) is a new page that replaces the Meetings tab. It lists all 15 robot-game missions. Kids assign themselves, keep notes and set each mission's status. Coaches can change who is assigned.
3. **Meetings are no longer scheduled.** The Meetings tab, calendar and `.ics` feed go away. A meeting is started live from the Journal, and starts automatically when the first kid taps their name for attendance.

**Decisions the coach made in the design review (don't revisit these):**
- **Attendance lists students only**, with no grown-ups row. The current code already filters to `role = 'student'`; keep that.
- **Auto-save wherever possible.** Tapping a name, picking a status, joining a mission or uploading a photo saves immediately and shows a small "Saved" confirmation.
- **Typed text keeps a Save button**, because kids expect one. Drafts in text boxes are kept locally while typing so nothing is lost if the tab closes.
- **Meetings tab → Missions tab.** The meeting calendar and subscription feed are removed entirely, with no replacement.

**Design reference:** the coach has a private design canvas with four artboards: Journal timeline, Add-to-journal screen, Journal on a phone, and Missions. If they share it with you, treat it as the source of truth for layout. This document describes everything needed without it.

---

## 2. What exists today (the parts that matter)

| Area | Files | Notes |
|---|---|---|
| Schema | `src/db/schema.ts`, `src/db/auth-schema.ts` | Drizzle + Postgres. `user.role` ∈ `student \| coach \| parent`. |
| Migrations | `drizzle/*.sql`, `drizzle/meta/_journal.json` | **Hand-written SQL.** Only `0000` has a snapshot, so `drizzle-kit generate` won't diff correctly. Add `0008_*.sql` by hand and append an entry to `_journal.json` (`idx: 8`, `when: 1791000000000`, the same shape as the others). `npm run build` runs `drizzle-kit migrate` first. |
| Meetings | `src/lib/meetings.ts` | Meetings are **pre-seeded** Mon/Thu evenings through Dec 5, 2026 by `ensureRecurringMeetings()` (called from `src/lib/bootstrap.ts`). Empty future rows ("shells") exist in the DB. `listNotebookSessions()` already hides shells with no content. |
| Notebook notes | `meeting_note` (`kind`: `progress \| action \| lesson`), `src/lib/notebook.ts` | Labels are "Today's Progress", "Action Items for Next Meeting" and "Lessons Learned" (from the 2026 Engineering Notebook template). |
| Extra notes | `journal_entry` (`title?`, `body`, `relatedMeetingId?`), `src/lib/journal.ts` | Notes not tied to a notebook section. |
| Attendance | `meeting_attendee`, `saveAttendance()` | Replaces the whole set per save. Students only. |
| Media | `meeting_media`, `src/lib/media.ts`, `POST /api/storage/media/upload` (presign), `saveMeetingMedia` action, `src/components/meeting-media.tsx` (client upload flow), `/media/[id]` (auth-gated stream with Range support) | Object keys are `journal/<meetingId>/<uuid>.<ext>`, validated by `isJournalMediaKey`. **Media must belong to a meeting.** |
| Missions | `mission` table (id, number, name), seeded from `src/lib/missions.ts` (15 missions, 2026 season) in `bootstrap.ts` | Only used today by the legacy program-version tagging (`version_mission`). |
| Pages | `src/app/(app)/journal/page.tsx`, `meetings/page.tsx`, `meetings/[id]/page.tsx`, `gallery/page.tsx`, `home/page.tsx` | `(app)/layout.tsx` wraps pages in `<Header>` and `requireUser()`. |
| Components | `journal-form.tsx`, `journal-session-card.tsx`, `meeting-forms.tsx`, `meeting-calendar.tsx`, `calendar-subscribe.tsx`, `gallery-grid.tsx`, `header.tsx` | shadcn-style UI in `src/components/ui/*`. `Button` has `size="xl"` (h-12, text-lg), which is the house size for kid-facing buttons. |
| Auth helpers | `src/lib/session.ts` (`requireUser`, `requireCoach`, `postAuthPath`), `src/lib/roles.ts` | |
| Time | `src/lib/timezone.ts` | Team time zone is `America/New_York`. Use `teamDateKey()`, `zonedDateTime()`, `formatTeamDay()` and the like. Never use the server's local time. |

---

## 3. Data model changes (migration `0008_journal_missions.sql`)

### 3a. Drizzle schema (`src/db/schema.ts`)

Add `boolean` to the `drizzle-orm/pg-core` import.

```ts
// mission: add status columns
export const mission = pgTable("mission", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  name: text("name").notNull(),
  // none | trying | some | every (see lib/mission-status.ts)
  status: text("status").notNull().default("none"),
  statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }),
  statusUpdatedById: text("status_updated_by_id").references(() => user.id, { onDelete: "set null" }),
});

/** Kids working on a mission. Kids add themselves; coaches can add or remove anyone. */
export const missionAssignment = pgTable(
  "mission_assignment",
  {
    missionId: integer("mission_id").notNull().references(() => mission.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    assignedById: text("assigned_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.missionId, table.userId] }),
    index("mission_assignment_user_idx").on(table.userId),
  ],
);

/** Notes about one mission. meetingId = the meeting it was written at, if any. */
export const missionNote = pgTable(
  "mission_note",
  {
    id: text("id").primaryKey(),
    missionId: integer("mission_id").notNull().references(() => mission.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").references(() => meeting.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    authorId: text("author_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("mission_note_mission_idx").on(table.missionId),
    index("mission_note_meeting_idx").on(table.meetingId),
  ],
);

/** Every status change, so the journal can show "robot updates" per meeting. */
export const missionStatusEvent = pgTable(
  "mission_status_event",
  {
    id: text("id").primaryKey(),
    missionId: integer("mission_id").notNull().references(() => mission.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").references(() => meeting.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("mission_status_event_mission_idx").on(table.missionId),
    index("mission_status_event_meeting_idx").on(table.meetingId),
  ],
);

/** Coach-entered season dates (kickoff, scrimmage, qualifier) for the journal's season strip. */
export const seasonEvent = pgTable("season_event", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  dayKey: text("day_key").notNull(), // YYYY-MM-DD, team time zone
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

Changes to existing tables:
- `meeting`: add `dayKey: text("day_key").unique()`. This is the YYYY-MM-DD for meetings started live; it makes "start today's meeting" race-safe.
- `journalEntry`: add `milestone: boolean("milestone").notNull().default(false)`.

Relations:
- `missionRelations` gains `assignments`, `notes` and `statusEvents`.
- Each new table gets `one(...)` relations to `mission`, `user`, and `meeting` where it has a `meetingId`.
- `meetingRelations` gains `missionNotes: many(missionNote)` and `missionStatusEvents: many(missionStatusEvent)`.

The `mission` table is defined above `meeting` in the file. Drizzle's `references(() => meeting.id)` is lazy, so `missionNote` and `missionStatusEvent` can sit anywhere, but placing them after `meeting` reads better.

### 3b. SQL

```sql
ALTER TABLE "mission" ADD COLUMN "status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "mission" ADD CONSTRAINT "mission_status_check" CHECK ("status" IN ('none','trying','some','every'));--> statement-breakpoint
ALTER TABLE "mission" ADD COLUMN "status_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mission" ADD COLUMN "status_updated_by_id" text;--> statement-breakpoint
ALTER TABLE "mission" ADD CONSTRAINT "mission_status_updated_by_id_user_id_fk" FOREIGN KEY ("status_updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE "mission_assignment" (
	"mission_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"assigned_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mission_assignment_mission_id_user_id_pk" PRIMARY KEY("mission_id","user_id")
);--> statement-breakpoint
ALTER TABLE "mission_assignment" ADD CONSTRAINT "mission_assignment_mission_id_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_assignment" ADD CONSTRAINT "mission_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_assignment" ADD CONSTRAINT "mission_assignment_assigned_by_id_user_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_assignment_user_idx" ON "mission_assignment" USING btree ("user_id");--> statement-breakpoint

CREATE TABLE "mission_note" (
	"id" text PRIMARY KEY NOT NULL,
	"mission_id" integer NOT NULL,
	"meeting_id" text,
	"body" text NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "mission_note" ADD CONSTRAINT "mission_note_mission_id_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_note" ADD CONSTRAINT "mission_note_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_note" ADD CONSTRAINT "mission_note_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_note_mission_idx" ON "mission_note" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "mission_note_meeting_idx" ON "mission_note" USING btree ("meeting_id");--> statement-breakpoint

CREATE TABLE "mission_status_event" (
	"id" text PRIMARY KEY NOT NULL,
	"mission_id" integer NOT NULL,
	"meeting_id" text,
	"status" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "mission_status_event" ADD CONSTRAINT "mission_status_event_mission_id_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_status_event" ADD CONSTRAINT "mission_status_event_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_status_event" ADD CONSTRAINT "mission_status_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_status_event_mission_idx" ON "mission_status_event" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "mission_status_event_meeting_idx" ON "mission_status_event" USING btree ("meeting_id");--> statement-breakpoint

CREATE TABLE "season_event" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"day_key" text NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "season_event" ADD CONSTRAINT "season_event_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "meeting" ADD COLUMN "day_key" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_day_key_unique" UNIQUE("day_key");--> statement-breakpoint
ALTER TABLE "journal_entry" ADD COLUMN "milestone" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Meetings are no longer pre-scheduled. Remove seeded future shells that have no content,
-- so live-started meetings get clean session numbers. Rows with any content are kept.
DELETE FROM "meeting" m
WHERE m."seed_key" IS NOT NULL
  AND m."starts_at" > now()
  AND m."summary" IS NULL
  AND m."attendance_recorded_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "meeting_attendee" a WHERE a."meeting_id" = m."id")
  AND NOT EXISTS (SELECT 1 FROM "meeting_note" n WHERE n."meeting_id" = m."id")
  AND NOT EXISTS (SELECT 1 FROM "meeting_media" x WHERE x."meeting_id" = m."id")
  AND NOT EXISTS (SELECT 1 FROM "journal_entry" j WHERE j."related_meeting_id" = m."id");
```

Because `mission.status` defaults to `'none'`, existing rows and `ensureMissions()` (which inserts `number` and `name` only) keep working.

---

## 4. Server logic

### 4a. New `src/lib/mission-status.ts` (shared, no DB)

```ts
export const MISSION_STATUSES = ["none", "trying", "some", "every"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];
export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  none: "Not yet", trying: "Trying", some: "Sometimes", every: "Every time",
};
export const MISSION_STATUS_HINTS: Record<MissionStatus, string> = {
  none: "Nobody has tried", trying: "Started, not working yet",
  some: "Works some runs", every: "Works on every run",
};
export function isMissionStatus(v: string): v is MissionStatus { ... }
/** "Working" = some + every. Used for "6 of 15 working". */
export function isWorking(s: MissionStatus) { return s === "some" || s === "every"; }
```

### 4b. Meetings (`src/lib/meetings.ts`)

- **Remove** `listSeedSlots`, `ensureRecurringMeetings`, the seed constants, `listMeetingsForMonth`, `listUpcomingMeetings`, `listMeetingsForCalendar` and `createOneOffMeeting`. Also remove `ensureMeetings` and its call in `src/lib/bootstrap.ts`. Keep the `seed_key` column (old rows use it).
- **Add `findMeetingForDay(dayKey)`.** It returns the meeting whose `startsAt` falls on that team-time-zone day (`zonedDateTime(y,m,d,0,0)` ≤ startsAt < next day), or the one whose `day_key = dayKey`. Prefer the earliest. A seeded shell for today counts.
- **Add `ensureTodayMeeting(userId)`.** It returns `{ id, created }`:
  1. Compute `dayKey = teamDateKey(new Date())`. If `findMeetingForDay` returns a meeting, return it.
  2. Otherwise insert `{ id, dayKey, startsAt: now, endsAt: now + 2h, title: "Team meeting", sessionNumber: nextSessionNumber(), createdById: userId }` with `.onConflictDoNothing({ target: meeting.dayKey })`.
  3. Re-select by `dayKey` and return it. This handles two kids tapping at the same moment.
- **`nextSessionNumber()`** stays `max(sessionNumber) + 1`. That's correct once the migration has removed the future shells.
- **Add `setAttendance({ meetingId, userId, present, recordedById })`.** It inserts or deletes one `meeting_attendee` row (students only; reject other roles) and updates `attendanceRecordedById/At`. Keep `saveAttendance` only if something still uses it; otherwise delete it.
- **`listNotebookSessions`** should also load `missionNotes` (with author and mission) and `missionStatusEvents` (with mission and user). It should also count those as content in `meetingHasNotebookContent`, so a meeting where kids only did robot updates still shows. Remove the limit or raise it to ~200, since a season is roughly 30 meetings.
- **`getMeeting(id)`** gets the same additions, for the day page.

### 4c. New `src/lib/missions-board.ts` (or extend `lib/programs.ts`; a separate file is cleaner)

- `listMissionBoard()` returns all 15 missions ordered by number: `{ id, number, name, status, statusUpdatedAt, statusUpdatedBy?, assignees: {id,name}[], noteCount }`.
- `getMissionDetail(number)` returns the mission plus its notes (newest first, with author name, `createdAt`, and the meeting's session number if any).
- `setMissionStatus({ missionId, status, userId, meetingId? })`:
  - Update `mission.status/statusUpdatedAt/statusUpdatedById`.
  - Insert a `mission_status_event`.
  - If no `meetingId` is passed but a meeting exists **today** (`findMeetingForDay(today)`), attach the event to it. A status change made on the Missions page during a meeting then shows up on that day's journal card.
  - No-op if the status is unchanged.
- `addMissionAssignment({ missionId, userId, assignedById })` and `removeMissionAssignment(...)`. The target user must be a student.
- `addMissionNote({ missionId, body, authorId, meetingId? })` trims the body and allows up to 4000 characters. It auto-attaches today's meeting the same way as status events.
- `missionLoadByStudent()` returns `Map<userId, count>`, used for the coach's "(n)" hint.

### 4d. Journal (`src/lib/journal.ts`)

- `createJournalEntry` accepts `milestone?: boolean`. A milestone requires a non-empty body; the headline is `title ?? first line of body`.
- `listJournalEntries` returns `milestone`.
- Add `listSeasonEvents()`, `addSeasonEvent({ title, dayKey, userId })` (coach only; title ≤ 60 characters; dayKey validated with `parseTeamDateKey`) and `deleteSeasonEvent(id)` (coach only).

### 4e. Server actions (`src/lib/actions.ts`)

All of these call `requireUser()` (or `requireCoach()`) and `revalidatePath("/journal")`. Also revalidate `/journal/[id]` and/or `/missions` as relevant. Auto-save actions return `{ ok: true }` or `{ error }`; they don't redirect.

| Action | Who | Behavior |
|---|---|---|
| `startTodayMeeting()` | anyone signed in | `ensureTodayMeeting` → `redirect('/journal/' + id)` |
| `ensureTodayMeetingId()` | anyone | Returns `{ id }`. The client uses it before a photo upload when today has no meeting yet. |
| `toggleAttendance({ meetingId \| null, userId, present })` | students and coaches (a shared tablet, so any kid may tap any name) | A `null` meetingId means today: call `ensureTodayMeeting` first. Returns `{ ok, meetingId, userName, present }`. |
| `postDayNote({ meetingId \| null, kind, body, milestone })` | students and coaches (parents may write "other" notes too) | `kind` ∈ `progress \| action \| lesson \| other`. With `milestone` true, or kind `other`, create a `journal_entry` (with `relatedMeetingId`, `milestone`); otherwise a `meeting_note`. With `meetingId === "home"`, create a `journal_entry` with no meeting. |
| `saveMeetingMedia` (exists) | anyone | Unchanged. Revalidate `/journal/[id]`. |
| `updateMediaCaption({ mediaId, caption })` | the uploader or a coach | New. Caption ≤ 300 characters. |
| `setMissionStatusAction({ missionId, status, meetingId? })` | students and coaches. **Parents get an error.** | Auto-save. |
| `joinMission({ missionId })` / `leaveMission({ missionId })` | **students only**, for themselves | Auto-save. |
| `assignMission({ missionId, userId })` / `unassignMission(...)` | **coaches only** | Auto-save. |
| `postMissionNote({ missionId, body, meetingId? })` | students and coaches | Save button. |
| `addSeasonEventAction` / `deleteSeasonEventAction` | coaches only | Small form on the journal. |

**Remove:** `addOneOffMeeting`, `recordMeetingAttendance` (replaced by `toggleAttendance`) and `saveMeetingDetails`. One exception: if you keep an "edit title/summary" affordance on the day page for coaches, keep `saveMeetingDetails` behind `requireCoach()`. That's optional.

---

## 5. Routes and navigation

| Route | Status |
|---|---|
| `/journal` | **Rewritten.** The season timeline (§6). |
| `/journal/today` | **New.** Server: if a meeting exists today, `redirect('/journal/' + id + search)`. If not, render the Add screen in "no meeting yet" mode: tapping a name creates the meeting, and there's a "Start meeting" button. Pass `?tab=attend\|note\|media\|robot` through. |
| `/journal/[id]` | **New.** The day page: the full record of one meeting plus the Add tabs (§7). Replaces `/meetings/[id]`. |
| `/missions` | **New.** `?m=<number>` selects a mission (defaults to the first mission assigned to the viewer, else M01). `?show=all\|mine\|open\|notyet`. |
| `/meetings` | **Delete the page.** Add a `redirect('/journal')` (a tiny `page.tsx` or a `redirects()` entry in `next.config.ts`) so old links still work. |
| `/meetings/[id]` | **Delete.** Redirect to `/journal/[id]`. |
| `/api/meetings.ics` | **Delete** the route. Remove it from `publicPaths` in `src/proxy.ts`. Delete `src/lib/ics.ts` if nothing else uses it. |

Other files to update:
- **Header** (`src/components/header.tsx`): the order is **Home** (not parents), **Missions**, **Journal**, **Gallery**, **Conflicts** (coach), **People** (coach), then the user's name and Sign out. Highlight the active link (`aria-current="page"`, primary color, underline). That needs `usePathname`, so either make a small client `NavLink` or pass the path in.
- **Parent landing page** changes `/meetings` → `/journal` in `src/lib/session.ts` (`postAuthPath`, `requireCoach`), `src/lib/actions.ts` (`sendAdultEmail` callbackURL), `src/components/login-form.tsx` (×2), `src/components/set-name-form.tsx`, `src/app/(app)/home/page.tsx` and the comment in `src/proxy.ts`.
- **Gallery links** (`src/components/gallery-grid.tsx`): `/meetings/${meetingId}` → `/journal/${meetingId}`. Change the gallery page copy to "Upload from the journal."
- **`src/app/robots.ts`**: replace `/meetings` with `/missions` in `disallow`.
- **Public landing page** (`src/app/page.tsx`): its copy mentions "meeting notes". That's fine; leave it.
- **Delete** `meeting-calendar.tsx`, `calendar-subscribe.tsx`, `journal-form.tsx` (replaced) and the parts of `meeting-forms.tsx` no longer used. Probably all of it; reuse what you can.

---

## 6. Journal page (`/journal`), the season timeline

A server component. Load the following in parallel: notebook sessions (§4b), journal entries, mission board, students, season events, the 6 latest media, and today's meeting (if any).

**Layout** (desktop width ~1200px max). The sidebar stacks under the timeline on narrow screens: use a `flex-wrap` row, timeline `flex: 999 1 560px`, sidebar `flex: 1 1 320px`.

1. **Heading.** An eyebrow in mono, uppercase, primary color: "Team 55900 · 2026–27 season". The H1 is "Our season journal" (~44px bold). Subtitle: "Everything our team did this season, in order. Add today's work below, and scroll down to see how far we've come."

2. **"Season so far" card.**
   - **Strip:** a horizontal row of points in date order.
     - Past milestones (`journal_entry.milestone`) are filled primary dots.
     - Season events are filled if past, dashed outlines if future.
     - A **"We are here"** marker sits at today: a ring dot with primary text.
     - Each point has a mono date ("OCT 1") and a short label.
     - A thin track behind the dots is filled up to "We are here".
     - Keep at most about 6–8 points: all future events, plus the most recent past points. On phones, let the strip scroll horizontally inside its box.
   - **Coach-only:** a small "Add a season date" disclosure with a title, a date and Save. Each season event has a remove button.
   - **Stat row** (auto-fit grid): **N meetings** (meetings with content), **X of 15 missions working** (`some + every`), **N robot updates** (count of `mission_status_event`), **N photos and videos** (count of `meeting_media`).

3. **"Add to the journal"**: four large link-buttons (min-height ~96px, an icon, a title and a one-line hint) going to `/journal/today?tab=…`:
   - **Who's here today**: "Tap your name when you arrive". This is the primary button (filled primary, white text).
   - **Write a note**: "What we did, learned, or need to do next".
   - **Add photos or video**: "Parents and coaches too".
   - **Robot update**: "Which missions worked today".
   - For **parents**, show only "Add photos or video" and "Write a note".

4. **Today card** (at the top of the timeline):
   - **No meeting today:** a dashed, primary-tinted card reading "MEETING TODAY? · Start Session {next}". Hint: "It also starts by itself when the first person taps their name in 'Who's here today'." Button: **Start meeting** (form → `startTodayMeeting`). Hide it from parents.
   - **A meeting already today:** don't show this card. Today's meeting is simply the first timeline item, expanded.

5. **Timeline** (`<h2>Timeline</h2>`):
   - **Filter pills** (`aria-pressed`, min-height 44px): Everything · Meetings · Notes · Photos & video · Robot updates · Milestones. Implement them as links with `?show=` so the page stays a server component. "Meetings" shows meeting cards; "Notes" shows note-only entries; "Photos & video" shows meetings that have media plus home-photo entries; "Robot updates" shows meetings with status events or mission notes; "Milestones" shows milestone cards.
   - **"Jump to" select** listing months that have content. It's a small client component that sets `location.hash = '#m-YYYY-MM'`.
   - **Month headers** in mono, uppercase, muted ("OCTOBER 2026"), with `id="m-2026-10"`.
   - **Every item** is a row: a **date column** (64px wide; mono weekday "THU", big day number "8", mono month "OCT", and a 2px vertical rail running down to the next item) plus the card.
   - **Item types**, newest first:
     - **Meeting card, expanded** (the newest meeting, and today's):
       - A pill "Meeting · Session 11".
       - **Headline** = the meeting's `title` if a coach set one other than "Team meeting". Otherwise the first progress note (truncated to ~80 characters). Otherwise "Session 11".
       - The time line.
       - An "Add to this day" button → `/journal/[id]`.
       - **"Who was here · 7 of 8"**: student chips (green tint), with absent students as dashed "Name · away" chips.
       - **Three columns** (auto-fit): **Today's progress** (primary color heading), **Lessons learned** (blue heading) and **Next time** (action items as read-only checkbox-looking rows; checking items off is out of scope). Each note shows its author's name.
       - **Robot update strip:** for each mission with status events at this meeting, a pill "M07 · Every time" colored by its *latest* status at that meeting. Mission notes from the meeting appear below as "M07 Humongous Fungus: note… (Ava)".
       - **Media grid** (auto-fill, min 130px, 4:3, `object-cover`). Show the first 3, then a "+N more" tile linking to the day page. Videos get a play-icon overlay and open in place (`<video controls playsInline preload="metadata">`).
       - **Footer** (muted): "Photos by {uploaders} · {n} notes".
     - **Meeting card, compact** (all older meetings): the whole card is a link to `/journal/[id]`. It shows the pill, "{attended} of {students} here · {n} notes · {n} photos", the headline, a short summary (the first progress note, 1–2 lines) and "Read the whole day".
     - **Milestone card:** a dark primary background (`#7E3511`) with white text, a star icon, an eyebrow "MILESTONE · SESSION 9" (or just "MILESTONE"), the headline (title or first line) and the body. It's dated by `createdAt`.
     - **Note from home** (`journal_entry` with no meeting): a white card with a blue pill "Note" (or "Photos from home" if that's added later), the author and time, and the body.
   - **If there's nothing yet:** "Nothing here yet. Tap **Who's here today** when your meeting starts."

6. **Sidebar:**
   - **Mission progress:** "{n} of 15 working", a stacked bar (Every time / Sometimes / Trying / Not yet), then 15 rows: mono code "M07", name, and a status pill. The footer link reads "Open Missions to join one or add notes" → `/missions`.
   - **Attendance:** "Last 8 meetings". For each student: name, 8 squares (filled green = here, outlined = away; `title` = "Here · Session 9"), and "7/8". A legend sits underneath.
   - **Latest photos:** a 3-column square grid of the 6 newest media, plus "All {n}" → `/gallery`.

---

## 7. Day page (`/journal/[id]` and `/journal/today`): the Add screen

This replaces both the old meeting detail page and the old "New journal entry" form. **Kids use it live during meetings, so it should be big, simple and forgiving.** It's a client component for the tabs, fed by server data.

**Header:**
- An eyebrow "ADDING TO", then "Thursday, October 8 · Session 11".
- A **"Different day?" select** listing recent meetings (~20), plus **"Start a new meeting today"** (only if no meeting today) and **"Not at a meeting (from home)"** (notes only). Changing it navigates.
- An **icon-only close button** (`aria-label="Close and go back to the journal"`) → `/journal`.

**Tabs:**
- A `role="tablist"` of 4 equal buttons, min-height 56px: **Attendance · Note · Photos · Robot**.
- `?tab=` sets the initial tab. Default is Attendance if the meeting is today, otherwise Note.
- Parents see Photos and Note only, and default to Photos.

**Attendance tab** (auto-save):
- Title "Who's here today?" with a live count "7 of 8 here".
- Copy: "Tap your name when you arrive. It saves right away. Tap again if you made a mistake."
- A **2-column grid of big name buttons** (min-height 60px, 19px semibold) with `aria-pressed`. Present: green tint, a 2px green border and a check circle. Absent: white with a grey outline circle.
- **On tap:** update optimistically, then call `toggleAttendance`. On error, roll back and show an inline error.
- A **status line** (`role="status" aria-live="polite"`, green tint): "**Saved.** Ben is marked here."
- **No grown-ups section.**
- On `/journal/today` with no meeting yet, the first tap creates the meeting. After it succeeds, `router.replace('/journal/' + meetingId + '?tab=attend')`.
- **Footer:** a single "Back to the journal" button. No Save.

**Note tab** (Save button):
- "What kind of note?": 4 large toggle cards, each a title plus a hint:
  - Today's progress — "What we built or got working"
  - Lesson learned — "Something we figured out"
  - Next time — "A to-do for the next meeting"
  - Other — "Ideas, research, team stuff"
- A textarea labeled "Your note". Its placeholder depends on the kind: "Today we got the arm to…" / "We learned that…" / "Next time we need to…" / "Anything else the team should remember…".
- A checkbox: "This is a big moment. Make it a milestone on the timeline."
- A **draft line** with a check icon: "Draft kept as you type, so it won't get lost. Tap Save to add it to the journal. Written by {name}."
- **Footer:** **Save note** (primary, full width) and **Cancel**. On success, clear the textarea and the draft, show "Saved." and stay on the tab so they can write another.
- **Drafts:** a small `useDraft(key)` hook backed by `localStorage`, keyed `draft:note:{meetingId}:{kind}`.
  - Wrap every storage call in try/catch; private mode can throw.
  - Restore the draft on mount and clear it on save.
  - Reuse the same hook for mission notes and the robot "What did you change?" box.

**Photos tab** (auto-save on upload):
- A big dashed drop zone, which is a `<label>` wrapping a visually-hidden `<input type="file" multiple accept=…>`. Reuse `ACCEPT` and the type mapping from `meeting-media.tsx`. It reads "Choose photos or videos" / "or take one now with your phone or tablet camera".
- **Upload each file immediately, sequentially:** presign → PUT → `saveMeetingMedia`.
  - On `/journal/today` with no meeting yet, call `ensureTodayMeetingId()` first.
  - Use `XMLHttpRequest` for the PUT if you want a real progress bar (`fetch` can't report upload progress). Otherwise show an indeterminate "Uploading…".
- **Each file gets a row:** a thumbnail (`URL.createObjectURL` while uploading, then `/media/{id}`) and a status line, either "Uploading video… 70%" with a bar or "✓ Added to the journal".
- **Caption:** a "What's happening here?" input with a small **Save** button (`updateMediaCaption`). Captions are optional.
- Below the uploads, show the photos already on this day, with captions.
- Copy: "Photos and videos go into the journal as soon as they finish uploading. Captions are optional." and "Everyone on the team can see these."
- **Footer:** "Back to the journal".

**Robot tab** (status auto-saves; text uses Save):
- **"How did each mission go?":** a list of missions. The viewer's assigned missions come first and the rest sit under a "Show all missions" disclosure.
- **Each mission row:** "M07 Humongous Fungus" and a 4-button segmented control (`role="group"`, `aria-pressed`, min-height 48px): Not yet / Trying / Sometimes / Every time. Selected buttons use the status colors (§8).
- **On tap:** update optimistically and call `setMissionStatusAction` with this meetingId. The status line reads "**Saved.** Humongous Fungus: every time."
- **"What did you change?":** a mission select (defaulting to the last mission tapped), a textarea and a **Save** button. It saves via `postMissionNote` with the meetingId.
- **Footer:** "Back to the journal".
- **Programs are out of scope.** The design showed a program picker, but programs now live in the git-backed team-project zip workflow on `/home`, so drop it.

**Below the tabs** on `/journal/[id]`, render the full read-only record of that day: the expanded meeting card from §6, with all media.

---

## 8. Missions page (`/missions`)

**Header:**
- An eyebrow "Robot game · 15 missions", the H1 "Missions", and the subtitle "Pick a mission to work on, keep notes about what you tried, and update how it's going. Changes save by themselves."
- **On the right:** "{n} of 15 working · {n} need people", the stacked status bar, and a legend with counts.

**Coach banner** (coaches only): blue tint, a shield icon, "**Coach view.** You can add or remove kids on any mission. Kids still choose their own and set status."

**Filter pills** (links): **All 15** · **My missions** (students) or **Unassigned** (coaches) · **Need people** (no assignees) · **Not working yet** (`none` or `trying`). Parents see All / Need people / Not working yet.

**Two-column layout** that wraps on phones (list `flex: 1 1 360px`, detail `flex: 999 1 560px`):
- **List:** a link per mission, min-height 64px.
  - Each shows a mono code, name, the assignees ("Ava, Hana · you" when it includes the viewer, or "Needs people") and a status pill.
  - The selected mission has a primary border and tint, plus `aria-current="true"`.
  - **On phones,** selecting a mission should scroll to the detail panel (`#detail`), or render the detail above the list. Either is fine.
- **Detail panel:**
  - "MISSION 7" (mono, primary), then the H2 name.
  - **Who's working on it:** chips with an initial avatar and name ("Ava (you)"). If there's nobody: "Nobody yet. This one needs people!"
    - **Student:** one big toggle button (min-height 52px). Unassigned: "I want to work on this" (primary), with the hint "Tap to add yourself." Assigned: "I'm on this mission" (green), with the hint "Tap again to leave it." It updates optimistically → `joinMission`/`leaveMission`.
    - **Coach:** each chip gets an × button (`aria-label="Take {name} off this mission"`). Below, an "Add a kid to this mission" panel (blue tint) lists every unassigned student as "+ Ben (2)", where the number is how many missions they already have, plus the hint "The number shows how many missions each kid already has." Updates are optimistic.
    - **Parent:** chips only.
  - **How's it going?:** 4 big buttons (min-height 68px). Each shows the label plus a hint from `MISSION_STATUS_HINTS`. The selected one is filled with its status color.
    - A status line on the right: "✓ Saved automatically", or "Saved: every time" after a change. Also show "Last changed by {name}, {date}".
    - Parents see it read-only.
  - **Mission notes:** a list, newest first. Each note shows the body and "{author} · {Oct 8} · Session 11". The empty state is "No notes yet. Write down your first idea for this mission."
    - Then a labeled "Add a note" textarea (placeholder "We tried… / It works better when… / Next we should…") with a **Save note** button and the hint "Draft kept as you type. Saved notes also show in the journal."
    - Parents don't get the form.

**Optimistic UI:** use `useOptimistic` + `useTransition`, or local state + `router.refresh()` after the action resolves. Use `refresh()` from `next/cache` inside the action if you prefer. Every auto-save must:
- (a) update instantly;
- (b) show "Saved" when it resolves;
- (c) roll back with a friendly error ("That didn't save. Try again.") on failure.

---

## 9. Visual spec

Stay inside the existing look (`src/app/globals.css`): warm off-white background, white cards, burnt-orange primary, Geist and Geist Mono. Use Tailwind and the existing tokens where they fit; the hexes below are for the new status and semantic colors.

| Token | Value | Use |
|---|---|---|
| primary | `var(--primary)` ≈ `#A84A1C` | primary buttons, "every time", active nav |
| primary-dark | `#7E3511` | milestone cards, primary text on tints |
| primary-tint | `#F6E6DA` / `#FDF6F0` | session pills, selected rows |
| ink / muted | `#1F1D1A` / `#615D56` | text (muted passes 4.5:1 on white) |
| line | `#E6E2D8` | card borders, timeline rail |
| present | `#3E7A4B` on `#EEF3EC`, text `#24452A` | attendance |
| info (blue) | `#2F5D8A` on `#E3ECF5`, text `#1E3F60` | photos, coach banner, lessons heading |
| status `every` | bg `#A84A1C`, text white | |
| status `some` | bg `#DB8A52`, text `#2A1406` | |
| status `trying` | bg `#F3CDAE`, text `#5A2A0E` | |
| status `none` | bg `#F1EEE7`, text `#3F3B35` | |

- **Status colors** form a single orange ramp that differs in *lightness*, and every pill also carries its text label, so it works for color-blind users.
- **Mono** (`font-mono`) is for dates, mission codes and eyebrows; it's what gives the page its "logbook" feel.
- **Radii:** cards 18px (`rounded-2xl`+), buttons 12–14px, pills full.
- **Touch targets** are ≥ 44px everywhere, and ≥ 56–60px for the kid-facing name and status buttons. Base body text is 17px.
- **Icons:** use `lucide-react` (already a dependency): `CircleCheck`, `Pencil`, `Camera`, `Bot`, `Star`, `Play`, `X`, `Shield`, `Menu`. No emoji.
- **Accessibility:**
  - Use real `<button>`/`<a>`/`<label>`.
  - Toggles use `aria-pressed`, tabs use `role="tab"` + `aria-selected`, and save confirmations use `role="status" aria-live="polite"`.
  - Icon-only buttons get `aria-label`.
- **Phone (390px):**
  - The header nav collapses to a menu button. A simple `<details>` dropdown is fine.
  - Add buttons become a 2×2 grid ("I'm here", "Add photo", "Note", "Robot").
  - Filter pills scroll horizontally, and the date column narrows to ~40px.
  - The season card shows a progress bar plus 3 stats instead of the full strip.
  - No horizontal page scroll.

---

## 10. Permissions summary

| | Student | Coach | Parent |
|---|---|---|---|
| View journal, missions, gallery | ✓ | ✓ | ✓ |
| Start meeting / mark attendance | ✓ | ✓ | – |
| Notebook notes (progress/lesson/action), milestones | ✓ | ✓ | – |
| "Other" notes, notes from home | ✓ | ✓ | ✓ |
| Upload photos/videos, edit own captions | ✓ | ✓ (any caption) | ✓ |
| Set mission status, mission notes | ✓ | ✓ | – |
| Join/leave a mission (self) | ✓ | – | – |
| Assign/unassign anyone | – | ✓ | – |
| Season dates | – | ✓ | – |

Enforce all of these **in server actions** (hiding the UI isn't enough). Students may mark any student's attendance, because it's a shared tablet.

---

## 11. Build order (each phase is a reviewable PR)

1. **Schema + migration.** §3: schema, `0008_journal_missions.sql`, the `_journal.json` entry, removal of seeding from `bootstrap.ts`. Verify `npm run db:migrate` against a scratch Postgres (Postgres 16 tools are available locally; `createdb`, then point `DATABASE_URL` at it).
2. **Missions page.** §4a, §4c, the mission actions, `/missions`, the header nav change (Meetings → Missions). This is useful on its own right away.
3. **Live meetings + day page.** `ensureTodayMeeting`, `toggleAttendance`, `postDayNote`, the caption action, `/journal/today`, `/journal/[id]` with the four tabs and drafts.
4. **Journal timeline.** The §6 rewrite (season card, add buttons, today card, timeline, filters, sidebar). Season-date coach form.
5. **Remove meetings.** Delete the pages and components, add the redirects, remove the ics route and its proxy path, re-point parent landing and gallery links, update `robots.ts`.

After each phase run `npm run lint` and `npx tsc --noEmit`, then `npm run build` if you have a `DATABASE_URL` (the build runs migrations).

---

## 12. Acceptance checklist

- [ ] On a day with no meeting, the first kid to tap their name creates "Session N+1" and lands on its day page. A second kid tapping at the same moment doesn't create a duplicate (the `day_key` unique constraint).
- [ ] Attendance taps save instantly with "Saved. {Name} is marked here." Reloading shows the same state. There are no grown-ups in the list.
- [ ] Notes have a Save button. Typing, closing the tab and reopening restores the draft. Saving clears it.
- [ ] A note marked as a milestone shows as a dark milestone card on the timeline and as a point on the season strip.
- [ ] Photos and videos upload as soon as they're picked, with no Save button. Captions save with their small Save. Parents can upload from a phone.
- [ ] Status changes made in the Robot tab or on the Missions page during a meeting appear on that day's card as robot-update pills. "{n} of 15 working" updates.
- [ ] A kid can join and leave a mission. A coach can add and remove any kid, and sees each kid's mission count. A parent sees missions read-only. Server actions reject the wrong role.
- [ ] Mission notes save, show on the Missions page, and appear on that day's journal card when written during a meeting.
- [ ] `/meetings` and `/meetings/{id}` redirect to the journal. `/api/meetings.ics` is gone. Parents land on `/journal` after sign-in. Gallery links go to `/journal/{id}`.
- [ ] Old seeded future meetings with no content are gone. Past meetings and anything with content are untouched.
- [ ] Every page works at 390px with no horizontal scroll, and every control is ≥ 44px.
- [ ] Lint and typecheck pass.

---

## 13. Open questions for the coach (don't block on these; the defaults are in brackets)

- Can kids mark milestones themselves, or only coaches? [Anyone except parents]
- Should "Next time" action items be checkable from the timeline? [No, read-only for now]
- Should parents be able to post photos "from home" without a meeting? Media currently must belong to a meeting. [No: from home, parents choose a recent meeting day in the "Different day?" select]
