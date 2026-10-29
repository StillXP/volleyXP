import { gameWinner, matchOutcome, targetFor, type ScoringRules, type Side } from "./matchRules";

export interface ScorerMatch {
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
  games: { gameNumber: number; team1Score: number; team2Score: number }[];
}

export interface CurrentGame {
  gameNumber: number;
  team1Score: number;
  team2Score: number;
  /** Points the game has to reach. */
  target: number;
  /** False for a game nobody has scored in yet, which isn't saved until its first point. */
  stored: boolean;
}

export type ScorerPhase =
  | "waiting" // a team isn't known yet
  | "cancelled"
  | "scoring" // being played
  | "decided" // won on games
  | "forfeit"; // completed without being played out

export interface ScorerState {
  phase: ScorerPhase;
  /** The game the controls act on: the one in play, or the last one once the match is decided. */
  game: CurrentGame | null;
  /** The finished game just before a fresh one, so its last point can still be undone. */
  previous: { gameNumber: number; team1Score: number; team2Score: number; winner: Side } | null;
  wins: Record<Side, number>;
  /** The side that won, by games or by forfeit. */
  winner: Side | null;
}

/** Works out what a scorekeeper should be looking at for a match as it is stored. */
export function deriveScorer(match: ScorerMatch, rules: ScoringRules): ScorerState {
  const none = { game: null, previous: null, wins: { 1: 0, 2: 0 } as Record<Side, number>, winner: null };
  if (!match.team1Id || !match.team2Id) return { phase: "waiting", ...none };
  if (match.status === "CANCELLED") return { phase: "cancelled", ...none };

  const games = [...match.games].sort((a, b) => a.gameNumber - b.gameNumber);
  const outcome = matchOutcome(games, rules);
  const current = (g: { gameNumber: number; team1Score: number; team2Score: number }, stored: boolean): CurrentGame => ({
    ...g,
    target: targetFor(g.gameNumber, rules),
    stored,
  });

  if (match.status === "COMPLETED" && !outcome.winner) {
    const winner: Side | null = match.winnerId === match.team1Id ? 1 : match.winnerId === match.team2Id ? 2 : null;
    return { phase: "forfeit", game: null, previous: null, wins: outcome.wins, winner };
  }

  const last = games.at(-1);
  if (outcome.winner) {
    return { phase: "decided", game: current(last!, true), previous: null, wins: outcome.wins, winner: outcome.winner };
  }

  const lastFinished = last ? gameWinner(last.team1Score, last.team2Score, targetFor(last.gameNumber, rules)) : null;
  if (last && !lastFinished) {
    return { phase: "scoring", game: current(last, true), previous: null, wins: outcome.wins, winner: null };
  }
  const fresh = current({ gameNumber: (last?.gameNumber ?? 0) + 1, team1Score: 0, team2Score: 0 }, false);
  const previous = last && lastFinished ? { ...last, winner: lastFinished } : null;
  return { phase: "scoring", game: fresh, previous, wins: outcome.wins, winner: null };
}

/** The scores after a side gains or loses a point, never below zero. */
export function adjustScore(game: { team1Score: number; team2Score: number }, side: Side, delta: 1 | -1) {
  const key = side === 1 ? "team1Score" : "team2Score";
  const next = { team1Score: game.team1Score, team2Score: game.team2Score };
  next[key] = Math.max(0, next[key] + delta);
  return next;
}

/** The scores that take the winning point off a finished game, which reopens it. */
export function undoWinningPoint(previous: { team1Score: number; team2Score: number; winner: Side }) {
  return adjustScore(previous, previous.winner, -1);
}
