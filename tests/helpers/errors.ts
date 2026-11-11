/**
 * The message Postgres refused with. Drizzle wraps driver errors (its own
 * message is the failed SQL), so the database's reason is on `cause`.
 */
export async function databaseRefusal(operation: Promise<unknown>): Promise<string> {
  try {
    await operation;
  } catch (err) {
    if (err instanceof Error) {
      const cause = err.cause instanceof Error ? err.cause.message : "";
      return `${err.message}\n${cause}`;
    }
    return String(err);
  }
  throw new Error("expected the database to refuse the operation");
}
