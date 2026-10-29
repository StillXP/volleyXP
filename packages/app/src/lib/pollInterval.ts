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

/** How often to check an event's registration while people sign up. */
export const REGISTRATION_POLL_MS = 15_000;
/** How often to check once registration has closed, in case the organizer reopens it. */
export const CLOSED_POLL_MS = 30_000;

/**
 * How long to wait before asking again about an event's registration (who has signed up,
 * whether it is still open), or false to stop. Captains want to see teammates arrive
 * and visitors want to see registration open, but a draft, or an event whose bracket
 * exists, has nothing to wait for.
 */
export function registrationPollInterval(eventStatus: string | undefined): number | false {
  if (eventStatus === "REGISTRATION") return REGISTRATION_POLL_MS;
  if (eventStatus === "SEEDING") return CLOSED_POLL_MS;
  return false;
}
