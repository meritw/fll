import "server-only";

import { createRealtime } from "@neon/realtime/server";
import { drizzleAdapter } from "@neon/realtime-drizzle";

let realtime: ReturnType<typeof create> | undefined;

// Created on first use: `next build` imports this module without the runtime secrets.
function create() {
  return createRealtime({
    secret: requiredEnv("NEON_REALTIME_SECRET"),
    db: new URL(requiredEnv("DATABASE_URL")).pathname.slice(1),
    adapter: drizzleAdapter(),
    debugMode: process.env.NODE_ENV === "development",
  });
}

export const getRealtime = () => (realtime ??= create());

export function realtimeUrl(): string {
  return requiredEnv("NEON_REALTIME_URL");
}

function requiredEnv(name: "NEON_REALTIME_SECRET" | "NEON_REALTIME_URL" | "DATABASE_URL"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}
