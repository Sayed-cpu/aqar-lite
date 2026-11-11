import { afterAll, inject } from "vitest";
import { closeDb } from "@/server/db/client";
import { closeOwnerDb } from "../helpers/db";

// Before any app module reads it: the app's pool connects as aqar_app.
process.env.DATABASE_URL = inject("appDatabaseUrl");

afterAll(async () => {
  await closeDb();
  await closeOwnerDb();
});
