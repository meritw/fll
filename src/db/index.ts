import { loadEnvConfig } from "@next/env";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

loadEnvConfig(process.cwd());

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: ReturnType<typeof createDb>;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({
    connectionString,
    max: 10,
  });

  try {
    attachDatabasePool(pool);
  } catch (error) {
    console.warn("Could not attach the database pool to the Vercel runtime.", error);
  }

  return pool;
}

function createDb() {
  const pool = globalForDb.pool ?? createPool();
  globalForDb.pool = pool;
  return drizzle(pool, { schema });
}

export function getDb() {
  if (!globalForDb.db) {
    globalForDb.db = createDb();
  }
  return globalForDb.db;
}

export type Database = ReturnType<typeof getDb>;
