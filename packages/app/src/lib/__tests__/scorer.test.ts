import { describe, expect, it } from "vitest";
import { adjustScore, deriveScorer, undoWinningPoint, type ScorerMatch } from "../scorer";
import type { ScoringRules } from "../matchRules";

const rules: ScoringRules = { bestOf: 3, pointsToWin: 25, pointsToWinLastGame: 15 };
const game = (gameNumber: number, team1Score: number, team2Score: number) => ({ gameNumber, team1Score, team2Score });
const match = (overrides: Partial<ScorerMatch> = {}): ScorerMatch => ({
  status: "SCHEDULED",
  team1Id: "a",
  team2Id: "b",
  winnerId: null,
  games: [],
  ...overrides,
});

describe("deriveScorer", () => {
  it("waits until both teams are known", () => {
    expect(deriveScorer(match({ team2Id: null }), rules)).toMatchObject({ phase: "waiting", game: null });
    expect(deriveScorer(match({ team1Id: null, team2Id: null }), rules).phase).toBe("waiting");
  });

  it("does nothing for a cancelled match", () => {
    expect(deriveScorer(match({ status: "CANCELLED" }), rules)).toMatchObject({ phase: "cancelled", game: null });
  });

  it("starts a fresh match at game 1, 0-0, not yet saved", () => {
    expect(deriveScorer(match(), rules)).toMatchObject({
      phase: "scoring",
      game: { gameNumber: 1, team1Score: 0, team2Score: 0, target: 25, stored: false },
      previous: null,
      winner: null,
    });
  });

  it("continues a game that is in progress", () => {
    const state = deriveScorer(match({ status: "IN_PROGRESS", games: [game(1, 12, 10)] }), rules);
    expect(state.game).toMatchObject({ gameNumber: 1, team1Score: 12, team2Score: 10, stored: true });
  });

  it("moves to a fresh next game once one is finished, remembering the finished one for undo", () => {
    const state = deriveScorer(match({ status: "IN_PROGRESS", games: [game(1, 25, 20)] }), rules);
    expect(state.game).toMatchObject({ gameNumber: 2, team1Score: 0, team2Score: 0, target: 25, stored: false });
    expect(state.previous).toEqual({ gameNumber: 1, team1Score: 25, team2Score: 20, winner: 1 });
    expect(state.wins).toEqual({ 1: 1, 2: 0 });
  });

  it("does not offer an undo while the current game has points", () => {
    const state = deriveScorer(match({ status: "IN_PROGRESS", games: [game(1, 25, 20), game(2, 1, 0)] }), rules);
    expect(state.previous).toBeNull();
  });

  it("plays the deciding game to its shorter target", () => {
    const state = deriveScorer(match({ status: "IN_PROGRESS", games: [game(1, 25, 20), game(2, 18, 25)] }), rules);
    expect(state.game).toMatchObject({ gameNumber: 3, target: 15 });
    expect(state.wins).toEqual({ 1: 1, 2: 1 });
  });

  it("keeps the last game in view once the match is decided, with the winner", () => {
    const state = deriveScorer(
      match({ status: "COMPLETED", winnerId: "b", games: [game(1, 20, 25), game(2, 18, 25)] }),
      rules
    );
    expect(state).toMatchObject({ phase: "decided", winner: 2, wins: { 1: 0, 2: 2 }, game: { gameNumber: 2, team1Score: 18, team2Score: 25 } });
  });

  it("recognizes a forfeit and who won it", () => {
    expect(deriveScorer(match({ status: "COMPLETED", winnerId: "a" }), rules)).toMatchObject({ phase: "forfeit", winner: 1, game: null });
    expect(deriveScorer(match({ status: "COMPLETED", winnerId: "b", games: [game(1, 12, 10)] }), rules)).toMatchObject({ phase: "forfeit", winner: 2 });
  });

  it("treats a single-game match as decided by its one game", () => {
    const one: ScoringRules = { bestOf: 1, pointsToWin: 21, pointsToWinLastGame: null };
    expect(deriveScorer(match({ status: "COMPLETED", winnerId: "a", games: [game(1, 21, 15)] }), one)).toMatchObject({ phase: "decided", winner: 1 });
  });
});

describe("adjustScore", () => {
  it("adds and removes a point for the chosen side only", () => {
    expect(adjustScore({ team1Score: 5, team2Score: 7 }, 1, 1)).toEqual({ team1Score: 6, team2Score: 7 });
    expect(adjustScore({ team1Score: 5, team2Score: 7 }, 2, -1)).toEqual({ team1Score: 5, team2Score: 6 });
  });

  it("never goes below zero", () => {
    expect(adjustScore({ team1Score: 0, team2Score: 3 }, 1, -1)).toEqual({ team1Score: 0, team2Score: 3 });
  });
});

describe("undoWinningPoint", () => {
  it("takes the winning point off the winner, so the game is no longer finished", () => {
    expect(undoWinningPoint({ team1Score: 25, team2Score: 20, winner: 1 })).toEqual({ team1Score: 24, team2Score: 20 });
    expect(undoWinningPoint({ team1Score: 20, team2Score: 25, winner: 2 })).toEqual({ team1Score: 20, team2Score: 24 });
  });
});
