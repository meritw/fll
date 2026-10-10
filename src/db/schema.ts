import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { account, session, user } from "./auth-schema";

export { account, session, user, verification } from "./auth-schema";
export { accountRelations, sessionRelations } from "./auth-schema";

export const mission = pgTable("mission", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  name: text("name").notNull(),
  // none | trying | some | every (see lib/mission-status.ts)
  status: text("status").notNull().default("none"),
  statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }),
  statusUpdatedById: text("status_updated_by_id").references(() => user.id, {
    onDelete: "set null",
  }),
});

/** Team members working on a mission. They add themselves; coaches can add or remove anyone. */
export const missionAssignment = pgTable(
  "mission_assignment",
  {
    missionId: integer("mission_id")
      .notNull()
      .references(() => mission.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedById: text("assigned_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.missionId, table.userId] }),
    index("mission_assignment_user_idx").on(table.userId),
  ],
);

/** Notes about one mission. meetingId is the meeting it was written at, if any. */
export const missionNote = pgTable(
  "mission_note",
  {
    id: text("id").primaryKey(),
    missionId: integer("mission_id")
      .notNull()
      .references(() => mission.id, { onDelete: "cascade" }),
    meetingId: text("meeting_id").references(() => meeting.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("mission_note_mission_idx").on(table.missionId),
    index("mission_note_meeting_idx").on(table.meetingId),
  ],
);

/** Each status change, so the journal can show robot updates per meeting. */
export const missionStatusEvent = pgTable(
  "mission_status_event",
  {
    id: text("id").primaryKey(),
    missionId: integer("mission_id")
      .notNull()
      .references(() => mission.id, { onDelete: "cascade" }),
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
  // YYYY-MM-DD in the team time zone
  dayKey: text("day_key").notNull(),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const program = pgTable("program", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const programVersion = pgTable(
  "program_version",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => program.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    // Neon object key. Names stay so existing rows need no migration.
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    fileName: text("file_name").notNull(),
    note: text("note").notNull(),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("program_version_program_number").on(table.programId, table.versionNumber),
    index("program_version_program_idx").on(table.programId),
  ],
);

export const versionMission = pgTable(
  "version_mission",
  {
    versionId: text("version_id")
      .notNull()
      .references(() => programVersion.id, { onDelete: "restrict" }),
    missionId: integer("mission_id")
      .notNull()
      .references(() => mission.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.versionId, table.missionId] })],
);

export const meeting = pgTable(
  "meeting",
  {
    id: text("id").primaryKey(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    title: text("title"),
    summary: text("summary"),
    // 1-based engineering notebook session number.
    sessionNumber: integer("session_number"),
    // Unique key for seeded Mon/Thu sessions so re-seed skips duplicates.
    // Current keys: mon-thu-et:YYYY-MM-DD (Eastern). Legacy Pacific: mon-thu:YYYY-MM-DD.
    seedKey: text("seed_key").unique(),
    // YYYY-MM-DD (team time zone) for meetings started live from the journal; one per day.
    dayKey: text("day_key").unique(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    attendanceRecordedById: text("attendance_recorded_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    attendanceRecordedAt: timestamp("attendance_recorded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("meeting_starts_at_idx").on(table.startsAt)],
);

export const meetingAttendee = pgTable(
  "meeting_attendee",
  {
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.meetingId, table.userId] })],
);

/** Notebook line kinds: progress | action | lesson (see lib/notebook.ts). */
export const meetingNote = pgTable(
  "meeting_note",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    // progress | action | lesson
    kind: text("kind").notNull().default("progress"),
    body: text("body").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("meeting_note_meeting_idx").on(table.meetingId),
    index("meeting_note_meeting_kind_idx").on(table.meetingId, table.kind),
  ],
);

export const journalEntry = pgTable(
  "journal_entry",
  {
    id: text("id").primaryKey(),
    title: text("title"),
    body: text("body").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    relatedMeetingId: text("related_meeting_id").references(() => meeting.id, {
      onDelete: "set null",
    }),
    milestone: boolean("milestone").notNull().default(false),
    // Set only when the writer said so ("I'm writing this from home").
    fromHome: boolean("from_home").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("journal_entry_created_at_idx").on(table.createdAt)],
);

/**
 * Team Pybricks block-coding license seats (class-year pack).
 * One row per code. Students get stable assignments; seat 10 is coach-reserved (Bob).
 */
export const pybricksLicense = pgTable(
  "pybricks_license",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    // student | coach_reserved
    seatKind: text("seat_kind").notNull(),
    // 1–9 student seats, 10 coach-reserved
    seatIndex: integer("seat_index").notNull().unique(),
    assignedUserId: text("assigned_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("pybricks_license_assigned_user_idx").on(table.assignedUserId),
    unique("pybricks_license_assigned_user_unique").on(table.assignedUserId),
  ],
);

/** Photos/videos for a meeting day or a "from home" journal note (Neon object storage). */
export const meetingMedia = pgTable(
  "meeting_media",
  {
    id: text("id").primaryKey(),
    // Null when fromHome — same idea as journal entries written without a meeting.
    meetingId: text("meeting_id").references(() => meeting.id, { onDelete: "cascade" }),
    journalEntryId: text("journal_entry_id").references(() => journalEntry.id, {
      onDelete: "set null",
    }),
    fromHome: boolean("from_home").notNull().default(false),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    caption: text("caption"),
    fileName: text("file_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("meeting_media_meeting_idx").on(table.meetingId),
    index("meeting_media_journal_entry_idx").on(table.journalEntryId),
    index("meeting_media_created_at_idx").on(table.createdAt),
  ],
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  programs: many(program),
  uploads: many(programVersion),
  meetingsCreated: many(meeting, { relationName: "meetingCreatedBy" }),
  attendanceRecorded: many(meeting, { relationName: "meetingAttendanceBy" }),
  meetingAttendances: many(meetingAttendee),
  meetingNotes: many(meetingNote),
  journalEntries: many(journalEntry),
  meetingMediaUploads: many(meetingMedia),
  pybricksLicense: one(pybricksLicense, {
    fields: [user.id],
    references: [pybricksLicense.assignedUserId],
  }),
}));

export const pybricksLicenseRelations = relations(pybricksLicense, ({ one }) => ({
  assignedUser: one(user, {
    fields: [pybricksLicense.assignedUserId],
    references: [user.id],
  }),
}));

export const missionRelations = relations(mission, ({ many }) => ({
  versionMissions: many(versionMission),
  assignments: many(missionAssignment),
  notes: many(missionNote),
  statusEvents: many(missionStatusEvent),
}));

export const missionAssignmentRelations = relations(missionAssignment, ({ one }) => ({
  mission: one(mission, {
    fields: [missionAssignment.missionId],
    references: [mission.id],
  }),
  user: one(user, {
    fields: [missionAssignment.userId],
    references: [user.id],
  }),
}));

export const missionNoteRelations = relations(missionNote, ({ one }) => ({
  mission: one(mission, {
    fields: [missionNote.missionId],
    references: [mission.id],
  }),
  meeting: one(meeting, {
    fields: [missionNote.meetingId],
    references: [meeting.id],
  }),
  author: one(user, {
    fields: [missionNote.authorId],
    references: [user.id],
  }),
}));

export const missionStatusEventRelations = relations(missionStatusEvent, ({ one }) => ({
  mission: one(mission, {
    fields: [missionStatusEvent.missionId],
    references: [mission.id],
  }),
  meeting: one(meeting, {
    fields: [missionStatusEvent.meetingId],
    references: [meeting.id],
  }),
  user: one(user, {
    fields: [missionStatusEvent.userId],
    references: [user.id],
  }),
}));

export const programRelations = relations(program, ({ one, many }) => ({
  createdBy: one(user, {
    fields: [program.createdById],
    references: [user.id],
  }),
  versions: many(programVersion),
}));

export const programVersionRelations = relations(programVersion, ({ one, many }) => ({
  program: one(program, {
    fields: [programVersion.programId],
    references: [program.id],
  }),
  uploadedBy: one(user, {
    fields: [programVersion.uploadedById],
    references: [user.id],
  }),
  versionMissions: many(versionMission),
}));

export const versionMissionRelations = relations(versionMission, ({ one }) => ({
  version: one(programVersion, {
    fields: [versionMission.versionId],
    references: [programVersion.id],
  }),
  mission: one(mission, {
    fields: [versionMission.missionId],
    references: [mission.id],
  }),
}));

export const meetingRelations = relations(meeting, ({ one, many }) => ({
  createdBy: one(user, {
    fields: [meeting.createdById],
    references: [user.id],
    relationName: "meetingCreatedBy",
  }),
  attendanceRecordedBy: one(user, {
    fields: [meeting.attendanceRecordedById],
    references: [user.id],
    relationName: "meetingAttendanceBy",
  }),
  attendees: many(meetingAttendee),
  notes: many(meetingNote),
  media: many(meetingMedia),
  journalEntries: many(journalEntry),
  missionNotes: many(missionNote),
  missionStatusEvents: many(missionStatusEvent),
}));

export const meetingAttendeeRelations = relations(meetingAttendee, ({ one }) => ({
  meeting: one(meeting, {
    fields: [meetingAttendee.meetingId],
    references: [meeting.id],
  }),
  user: one(user, {
    fields: [meetingAttendee.userId],
    references: [user.id],
  }),
}));

export const meetingNoteRelations = relations(meetingNote, ({ one }) => ({
  meeting: one(meeting, {
    fields: [meetingNote.meetingId],
    references: [meeting.id],
  }),
  author: one(user, {
    fields: [meetingNote.authorId],
    references: [user.id],
  }),
}));

export const journalEntryRelations = relations(journalEntry, ({ one, many }) => ({
  author: one(user, {
    fields: [journalEntry.authorId],
    references: [user.id],
  }),
  relatedMeeting: one(meeting, {
    fields: [journalEntry.relatedMeetingId],
    references: [meeting.id],
  }),
  media: many(meetingMedia),
}));

export const meetingMediaRelations = relations(meetingMedia, ({ one }) => ({
  meeting: one(meeting, {
    fields: [meetingMedia.meetingId],
    references: [meeting.id],
  }),
  journalEntry: one(journalEntry, {
    fields: [meetingMedia.journalEntryId],
    references: [journalEntry.id],
  }),
  uploader: one(user, {
    fields: [meetingMedia.uploaderId],
    references: [user.id],
  }),
}));

/** Singleton shared Pybricks zip project (git-backed tree in Neon object storage). */
export const teamProject = pgTable("team_project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  headSha: text("head_sha"),
  repoObjectKey: text("repo_object_key"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teamProjectCommit = pgTable(
  "team_project_commit",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => teamProject.id, { onDelete: "cascade" }),
    sha: text("sha").notNull(),
    parentSha: text("parent_sha"),
    baseSha: text("base_sha"),
    message: text("message").notNull(),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    uploadObjectKey: text("upload_object_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("team_project_commit_sha").on(table.projectId, table.sha),
    index("team_project_commit_project_idx").on(table.projectId),
    index("team_project_commit_created_idx").on(table.createdAt),
  ],
);

/** One team member/coach upload attempt (merged, conflicted, or seeded). */
export const teamProjectUpload = pgTable(
  "team_project_upload",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => teamProject.id, { onDelete: "cascade" }),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    objectKey: text("object_key").notNull(),
    fileName: text("file_name").notNull(),
    message: text("message").notNull().default(""),
    baseSha: text("base_sha"),
    // merged | conflict | seeded
    status: text("status").notNull(),
    resultCommitSha: text("result_commit_sha"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("team_project_upload_project_idx").on(table.projectId),
    index("team_project_upload_status_idx").on(table.status),
  ],
);

export const teamProjectConflict = pgTable(
  "team_project_conflict",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => teamProject.id, { onDelete: "cascade" }),
    uploadId: text("upload_id")
      .notNull()
      .references(() => teamProjectUpload.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    // text | binary
    kind: text("kind").notNull(),
    // open | resolved
    status: text("status").notNull().default("open"),
    baseContent: text("base_content"),
    oursContent: text("ours_content"),
    theirsContent: text("theirs_content"),
    // For binary sides (or large text) stored in object storage.
    baseObjectKey: text("base_object_key"),
    oursObjectKey: text("ours_object_key"),
    theirsObjectKey: text("theirs_object_key"),
    // ours | theirs | custom
    resolution: text("resolution"),
    resolvedContent: text("resolved_content"),
    resolvedObjectKey: text("resolved_object_key"),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    resolvedById: text("resolved_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("team_project_conflict_project_idx").on(table.projectId),
    index("team_project_conflict_upload_idx").on(table.uploadId),
    index("team_project_conflict_status_idx").on(table.status),
  ],
);

export const teamProjectRelations = relations(teamProject, ({ many }) => ({
  commits: many(teamProjectCommit),
  uploads: many(teamProjectUpload),
  conflicts: many(teamProjectConflict),
}));

export const teamProjectCommitRelations = relations(teamProjectCommit, ({ one }) => ({
  project: one(teamProject, {
    fields: [teamProjectCommit.projectId],
    references: [teamProject.id],
  }),
  uploadedBy: one(user, {
    fields: [teamProjectCommit.uploadedById],
    references: [user.id],
  }),
}));

export const teamProjectUploadRelations = relations(teamProjectUpload, ({ one, many }) => ({
  project: one(teamProject, {
    fields: [teamProjectUpload.projectId],
    references: [teamProject.id],
  }),
  uploadedBy: one(user, {
    fields: [teamProjectUpload.uploadedById],
    references: [user.id],
  }),
  conflicts: many(teamProjectConflict),
}));

export const teamProjectConflictRelations = relations(teamProjectConflict, ({ one }) => ({
  project: one(teamProject, {
    fields: [teamProjectConflict.projectId],
    references: [teamProject.id],
  }),
  upload: one(teamProjectUpload, {
    fields: [teamProjectConflict.uploadId],
    references: [teamProjectUpload.id],
  }),
  uploadedBy: one(user, {
    fields: [teamProjectConflict.uploadedById],
    references: [user.id],
  }),
  resolvedBy: one(user, {
    fields: [teamProjectConflict.resolvedById],
    references: [user.id],
  }),
}));
