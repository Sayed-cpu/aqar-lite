import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";

const uuid = z.uuid();

/**
 * A malformed id is answered like a missing one — a 404 — instead of reaching
 * Postgres, which would reject it as an invalid uuid and turn it into a 500.
 */
export function uuidOrNotFound(value: string): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) notFound();
  return parsed.data;
}
