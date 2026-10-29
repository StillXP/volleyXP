# Live score updates

Viewers see scores change without refreshing. The event page polls for the bracket's
matches, and how often depends on what is happening.

## Why polling

The app is deployed on Vercel, which runs code as short-lived serverless functions.
That makes the usual push approaches a poor fit:

- **Server-Sent Events / WebSockets** need a connection that stays open. On serverless
  each open viewer holds a function until it reaches its maximum duration, and is billed
  for that time.
- **Telling viewers something changed** from the server needs shared state. An
  in-memory "publish" only reaches viewers connected to the same instance, and two
  requests can be served by different instances.

Polling avoids both: every poll is a short, independent request, so it behaves the same
on one instance or fifty.

## The policy

`matchPollInterval` (`packages/app/src/lib/pollInterval.ts`) decides the next delay from
the matches it just received.

| State of the bracket | Next request |
|---|---|
| A match is in progress | 3 seconds |
| Matches still to come, none in progress | 15 seconds |
| Everything completed or cancelled | none |
| No data yet | none (the first request is made normally) |

Scores change within seconds while a match is live and hardly at all otherwise, so the
quick interval is only used when it is useful. A finished bracket makes no requests.

React Query supplies the rest of the behaviour: polling pauses while the tab is hidden,
and a tab that comes back is refreshed immediately. The scorekeeper doesn't wait for a
poll, because saving a score refetches straight away.

## What it costs

Each poll is one query for a stage's matches with their games, which is small. With `n`
people watching a live match that is about `n / 3` requests per second, and nothing when
no match is live. That is fine for a club tournament and worth revisiting at larger scale.

## Possible next steps

- **Cache public reads at the edge.** Viewers could share a response with a short
  `s-maxage`, so many viewers cost about one database query per interval. It needs care:
  the scorekeeper must see their own writes immediately, and I haven't verified how
  Vercel's cache treats requests that carry cookies. Not done.
- **Move to push if hosting changes.** The page reads the bracket through a single query.
  A push channel (SSE on a long-running server, or a hosted real-time service) only
  needs to call `invalidate` on that query when it hears a change; polling would then be
  the fallback.
