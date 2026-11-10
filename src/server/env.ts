import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // The app connects as the least-privileged role (aqar_app), never the owner.
  DATABASE_URL: z.string().min(1),
  // Only behind a reverse proxy we control may X-Forwarded-For be believed.
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Parsed lazily, on first use, so `next build` can import server modules
 * without a database configured.
 */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      // Name the variables, never print their values.
      const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`Invalid server environment: ${keys}`);
    }
    cached = parsed.data;
  }
  return cached;
}
