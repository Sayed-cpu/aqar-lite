import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../scripts/run-migrations";

declare module "vitest" {
  export interface ProvidedContext {
    /** Table owner (and superuser): fixtures, resets, and owner-level checks. */
    ownerDatabaseUrl: string;
    /** What the app uses: aqar_app, bound by grants and row-level security. */
    appDatabaseUrl: string;
  }
}

const APP_PASSWORD = "test-app-password";

let container: StartedPostgreSqlContainer | undefined;

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const ownerUrl = container.getConnectionUri();

  // Exactly the SQL that ships, applied the way the migrate service applies it.
  await runMigrations(ownerUrl);

  // The migration creates aqar_app NOLOGIN; in docker the init script gives
  // it a password, here this does.
  const client = new Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query(`alter role aqar_app login password ${client.escapeLiteral(APP_PASSWORD)}`);
  } finally {
    await client.end();
  }

  const appUrl = new URL(ownerUrl);
  appUrl.username = "aqar_app";
  appUrl.password = APP_PASSWORD;

  project.provide("ownerDatabaseUrl", ownerUrl);
  project.provide("appDatabaseUrl", appUrl.toString());
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
