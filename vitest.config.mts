import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // The real package throws outside a React Server Components build.
      "server-only": fromRoot("./tests/setup/server-only.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // A real Postgres (Testcontainers), the real migrations, and the
          // app connecting as aqar_app — the role row-level security binds.
          globalSetup: ["tests/setup/global-postgres.ts"],
          setupFiles: ["tests/setup/integration-env.ts"],
          // One shared database, reset between tests.
          fileParallelism: false,
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
