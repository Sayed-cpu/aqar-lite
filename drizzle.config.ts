import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` needs no database; migrations are applied by
// scripts/migrate.ts using MIGRATION_DATABASE_URL (the table owner).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
