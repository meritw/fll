import { relations } from "drizzle-orm";
import {
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("journal_entry_created_at_idx").on(table.createdAt)],
);

/** Photos/videos attached to a meeting session (Neon object storage). */
export const meetingMedia = pgTable(
  "meeting_media",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
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
    index("meeting_media_created_at_idx").on(table.createdAt),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
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
}));

export const missionRelations = relations(mission, ({ many }) => ({
  versionMissions: many(versionMission),
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

export const journalEntryRelations = relations(journalEntry, ({ one }) => ({
  author: one(user, {
    fields: [journalEntry.authorId],
    references: [user.id],
  }),
  relatedMeeting: one(meeting, {
    fields: [journalEntry.relatedMeetingId],
    references: [meeting.id],
  }),
}));

export const meetingMediaRelations = relations(meetingMedia, ({ one }) => ({
  meeting: one(meeting, {
    fields: [meetingMedia.meetingId],
    references: [meeting.id],
  }),
  uploader: one(user, {
    fields: [meetingMedia.uploaderId],
    references: [user.id],
  }),
}));
