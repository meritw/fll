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

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  programs: many(program),
  uploads: many(programVersion),
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
