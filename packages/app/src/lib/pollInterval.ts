/** How often to check a bracket for new scores while a match is being played. */
export const LIVE_POLL_MS = 3_000;
/** How often to check while matches are still to come but none is being played. */
export const WAITING_POLL_MS = 15_000;

/**
 * How long to wait before asking for a bracket's matches again, or false to stop.
 *
 * Scores change in seconds while a match is live and rarely otherwise, so polling
 * speeds up for live play, slows down while waiting for the next match to start, and
 * stops once everything is finished. Before the first response there's nothing to go
 * on, so it doesn't poll. Hidden tabs are paused by the query library, and a tab
 * that comes back is refreshed at once.
 */
export function matchPollInterval(matches: { status: string }[] | undefined): number | false {
  if (!matches || matches.length === 0) return false;
  if (matches.some((m) => m.status === "IN_PROGRESS")) return LIVE_POLL_MS;
  if (matches.every((m) => m.status === "COMPLETED" || m.status === "CANCELLED")) return false;
  return WAITING_POLL_MS;
}
