import "server-only";

type PgDriverError = Error & { code?: unknown; constraint?: unknown };

/**
 * The unique constraint a statement broke, or null. Drizzle wraps the driver
 * error, so the Postgres one (with its code and constraint name) is found by
 * walking `cause`.
 */
export function violatedUniqueConstraint(err: unknown): string | null {
  for (let current: unknown = err; current instanceof Error; current = current.cause) {
    const { code, constraint } = current as PgDriverError;
    if (code === "23505" && typeof constraint === "string") return constraint;
  }
  return null;
}
