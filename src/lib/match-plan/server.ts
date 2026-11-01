import "server-only";

import type { SealedLiveQuery } from "@neon/realtime/client";
import { and, eq, sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { connection } from "next/server";

import { getDb } from "@/db";
import { user } from "@/db/schema";
import { getRealtime, realtimeUrl } from "@/lib/realtime";
import { isCoach } from "@/lib/roles";
import { getSession, needsDisplayName, needsPasswordChange } from "@/lib/session";

import { applyOp, parsePlan, SEED_PLAN, type PlanBatch } from "./plan";

const PLAN_ID = "default";
const MAX_SAVE_ATTEMPTS = 5;
const RECENT_BATCHES = 64;

// Defined here and not in schema.ts, so this module is the only one that can write it.
const matchPlan = pgTable("match_plan", {
  id: text("id").primaryKey(),
  plan: jsonb("plan").notNull(),
  version: integer("version").notNull().default(0),
  generation: integer("generation").notNull().default(0),
  recentBatches: text("recent_batches").array().notNull().default(sql`'{}'::text[]`),
  updatedById: text("updated_by_id").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// The SSR read, the seal and every renewal build this same query, so their fingerprints match.
// Live rows are keyed by Postgres result names, hence the camelCase aliases.
function sharedPlanQuery() {
  return getDb()
    .select({
      plan: matchPlan.plan,
      version: matchPlan.version,
      generation: matchPlan.generation,
      recentBatches: sql<string[]>`${matchPlan.recentBatches}`.as("recentBatches"),
      updatedByName: sql<string | null>`${user.name}`.as("updatedByName"),
    })
    .from(matchPlan)
    .leftJoin(user, eq(user.id, matchPlan.updatedById))
    .where(eq(matchPlan.id, PLAN_ID));
}

export type SharedPlanRow = Awaited<ReturnType<typeof sharedPlanQuery>>[number];

export type LivePlan = Readonly<{
  userId: string;
  canReset: boolean;
  realtimeUrl: string;
  row: SharedPlanRow;
  sealedQuery: SealedLiveQuery<SharedPlanRow>;
}>;

/** A live row at version N or later reflects every batch saved at version N or lower, applied or fenced by a reset. */
export type SaveResult =
  | Readonly<{ kind: "saved"; version: number }>
  | Readonly<{ kind: "rejected"; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID" | "BUSY" }>;

export type Editor = Readonly<{ id: string; canReset: boolean }>;

export type PlanAccess =
  | Readonly<{ kind: "editor"; editor: Editor }>
  | Readonly<{ kind: "signedOut" }>
  | Readonly<{ kind: "mustFinishSetup" }>;

function canResetPlan(role: string | null | undefined): boolean {
  return isCoach(role);
}

/** A session for someone other than the page's user counts as signed out. */
export async function planAccess(pageUserId: unknown): Promise<PlanAccess> {
  const session = await getSession();
  if (!session || session.user.id !== pageUserId) return { kind: "signedOut" };
  if (needsPasswordChange(session.user) || needsDisplayName(session.user)) return { kind: "mustFinishSetup" };
  return { kind: "editor", editor: { id: session.user.id, canReset: canResetPlan(session.user.role) } };
}

export async function loadLivePlan(viewer: Readonly<{ id: string; role?: string | null }>): Promise<LivePlan> {
  await connection();
  const query = sharedPlanQuery();
  const [rows, sealedQuery] = await Promise.all([query, getRealtime().seal({ query })]);
  let row = rows[0];
  if (!row) {
    await insertSeedRow();
    [row] = await sharedPlanQuery();
  }
  return { userId: viewer.id, canReset: canResetPlan(viewer.role), realtimeUrl: realtimeUrl(), row, sealedQuery };
}

export function sealSharedPlan(): Promise<SealedLiveQuery<SharedPlanRow>> {
  return getRealtime().seal({ query: sharedPlanQuery() });
}

/**
 * Replays the batch on the newest plan and writes only if nobody else wrote since the read. A batch the
 * row already lists, or one made before the latest reset, answers saved without applying anything.
 * A batch that changes nothing still writes, so the row lists it before anyone can resend it.
 */
export async function saveSharedPlanBatch(batch: PlanBatch, editor: Editor): Promise<SaveResult> {
  const resets = batch.ops.filter((op) => op.type === "reset").length;
  if (!editor.canReset && resets > 0) return { kind: "rejected", reason: "FORBIDDEN" };
  const db = getDb();
  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
    const [row] = await db
      .select({
        plan: matchPlan.plan,
        version: matchPlan.version,
        generation: matchPlan.generation,
        recentBatches: matchPlan.recentBatches,
      })
      .from(matchPlan)
      .where(eq(matchPlan.id, PLAN_ID));
    if (!row) {
      await insertSeedRow();
      continue;
    }
    if (row.recentBatches.includes(batch.id) || batch.generation < row.generation) {
      return { kind: "saved", version: row.version };
    }
    const current = parsePlan(row.plan);
    if (!current) throw new Error("The shared match plan row is not a valid plan.");
    const [written] = await db
      .update(matchPlan)
      .set({
        plan: batch.ops.reduce(applyOp, current),
        version: sql`${matchPlan.version} + 1`,
        generation: row.generation + resets,
        recentBatches: [...row.recentBatches, batch.id].slice(-RECENT_BATCHES),
        updatedById: editor.id,
        updatedAt: new Date(),
      })
      .where(and(eq(matchPlan.id, PLAN_ID), eq(matchPlan.version, row.version)))
      .returning({ version: matchPlan.version });
    if (written) return { kind: "saved", version: written.version };
  }
  return { kind: "rejected", reason: "BUSY" };
}

async function insertSeedRow(): Promise<void> {
  await getDb().insert(matchPlan).values({ id: PLAN_ID, plan: SEED_PLAN }).onConflictDoNothing();
}
