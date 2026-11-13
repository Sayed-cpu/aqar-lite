/** Runs once when the server starts. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startReservationSweeper } = await import("./server/reservations/sweeper");
  startReservationSweeper();
}
