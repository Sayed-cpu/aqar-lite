import { existsSync } from "node:fs";
import { runMigrations } from "./run-migrations";

// Local runs read .env; in docker the variables come from compose.
if (existsSync(".env")) process.loadEnvFile(".env");

async function main(): Promise<void> {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("MIGRATION_DATABASE_URL is not set");
  await runMigrations(url);
  console.log("migrations applied");
}

main().catch((err: unknown) => {
  // The message only: a driver error object can carry the connection string.
  console.error("migration failed:", err instanceof Error ? err.message : "unknown error");
  process.exit(1);
});
