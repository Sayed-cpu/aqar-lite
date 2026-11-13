import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { serverEnv } from "../env";
import { logger } from "../logger";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type DbHandle = { pool: Pool; db: Db };

// Kept on globalThis so dev-mode hot reloads reuse one pool instead of
// opening a new one per reload.
const globalForDb = globalThis as typeof globalThis & { __aqarDb?: DbHandle };

export function getDb(): Db {
  if (!globalForDb.__aqarDb) {
    const pool = new Pool({ connectionString: serverEnv().DATABASE_URL, max: 10 });
    pool.on("error", (err) => logger.error({ err }, "idle postgres client error"));
    globalForDb.__aqarDb = { pool, db: drizzle({ client: pool, schema }) };
  }
  return globalForDb.__aqarDb.db;
}

/** For tests and scripts that must exit cleanly. */
export async function closeDb(): Promise<void> {
  const handle = globalForDb.__aqarDb;
  globalForDb.__aqarDb = undefined;
  await handle?.pool.end();
}
