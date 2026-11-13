import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { logger } from "@/server/logger";

// Must hit the database on every call, never be prerendered at build time.
export const dynamic = "force-dynamic";

/** Used by the container healthcheck. Says up or down, nothing more. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "health check failed");
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
