export interface ScoringRules {
  /** Games in the longest possible match. Odd, so a match can't end level. */
  bestOf: number;
  pointsToWin: number;
  /** Points for the deciding game of a multi-game match; null means the same as pointsToWin. */
  pointsToWinLastGame: number | null;
}

export interface GameScore {
  gameNumber: number;
  team1Score: number;
  team2Score: number;
}

export type Side = 1 | 2;

/** Games a team needs to win the match. */
export const gamesToWin = (bestOf: number) => Math.floor(bestOf / 2) + 1;

/** Points a game has to reach. The deciding game of a multi-game match may be shorter. */
export function targetFor(gameNumber: number, rules: ScoringRules) {
  const deciding = rules.bestOf > 1 && gameNumber === rules.bestOf;
  return deciding ? (rules.pointsToWinLastGame ?? rules.pointsToWin) : rules.pointsToWin;
}

/** Who has won a game: the target score reached with a lead of two, no cap. Null while it's still going. */
export function gameWinner(team1Score: number, team2Score: number, target: number): Side | null {
  if (Math.max(team1Score, team2Score) < target || Math.abs(team1Score - team2Score) < 2) return null;
  return team1Score > team2Score ? 1 : 2;
}

export interface MatchOutcome {
  /** Games each side has won. */
  wins: Record<Side, number>;
  /** The side that has won enough games, or null while the match is open. */
  winner: Side | null;
}

/** Tallies finished games only; a game still being played counts for nobody. */
export function matchOutcome(games: GameScore[], rules: ScoringRules): MatchOutcome {
  const wins: Record<Side, number> = { 1: 0, 2: 0 };
  for (const g of games) {
    const winner = gameWinner(g.team1Score, g.team2Score, targetFor(g.gameNumber, rules));
    if (winner) wins[winner] += 1;
  }
  const needed = gamesToWin(rules.bestOf);
  return { wins, winner: wins[1] >= needed ? 1 : wins[2] >= needed ? 2 : null };
}
