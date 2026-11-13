import "server-only";
import { getDb } from "../db/client";
import { logger } from "../logger";
import { expireDueReservations } from "./expiry";

const SWEEP_EVERY_MS = 60_000;

const globalForSweeper = globalThis as typeof globalThis & { __aqarSweeper?: NodeJS.Timeout };

/**
 * Started once per server process (src/instrumentation.ts). Each sweep is one
 * statement that skips locked rows, so several processes sweeping at once
 * are harmless. In a larger deployment this belongs to a scheduler (pg_cron
 * or a worker); for one container, a timer is the fewest moving parts.
 */
export function startReservationSweeper(): void {
  if (globalForSweeper.__aqarSweeper) return;
  const timer = setInterval(() => {
    expireDueReservations(getDb())
      .then((freed) => {
        if (freed > 0) logger.info({ freed }, "expired reservations released their units");
      })
      .catch((err: unknown) => logger.error({ err }, "reservation sweep failed"));
  }, SWEEP_EVERY_MS);
  // Never the reason the process stays alive.
  timer.unref();
  globalForSweeper.__aqarSweeper = timer;
}
