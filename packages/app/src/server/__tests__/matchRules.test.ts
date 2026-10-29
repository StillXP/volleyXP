import { describe, expect, it } from "vitest";
import { gameWinner, gamesToWin, matchOutcome, targetFor, type GameScore, type ScoringRules } from "../matchRules";

const rules = (overrides: Partial<ScoringRules> = {}): ScoringRules => ({ bestOf: 3, pointsToWin: 25, pointsToWinLastGame: 15, ...overrides });
const game = (gameNumber: number, team1Score: number, team2Score: number): GameScore => ({ gameNumber, team1Score, team2Score });

describe("gamesToWin", () => {
  it.each([[1, 1], [3, 2], [5, 3], [7, 4]])("needs %i-game matches won by %i games", (bestOf, needed) => {
    expect(gamesToWin(bestOf)).toBe(needed);
  });
});

describe("targetFor", () => {
  it("uses the full target for every game but the deciding one", () => {
    expect(targetFor(1, rules())).toBe(25);
    expect(targetFor(2, rules())).toBe(25);
    expect(targetFor(3, rules())).toBe(15);
    expect(targetFor(5, rules({ bestOf: 5 }))).toBe(15);
    expect(targetFor(3, rules({ bestOf: 5 }))).toBe(25);
  });

  it("uses the full target throughout when there is no shorter deciding game", () => {
    expect(targetFor(3, rules({ pointsToWinLastGame: null }))).toBe(25);
  });

  it("treats a single game as a full-length game, not a deciding one", () => {
    expect(targetFor(1, rules({ bestOf: 1 }))).toBe(25);
  });
});

describe("gameWinner", () => {
  it.each([
    // [team1, team2, target, winner]
    [25, 20, 25, 1],
    [20, 25, 25, 2],
    [25, 23, 25, 1],
    [25, 24, 25, null], // reached the target but only a one-point lead
    [26, 24, 25, 1], // win by two past the target
    [24, 26, 25, 2],
    [30, 28, 25, 1], // no cap
    [24, 22, 25, null], // ahead by two but short of the target
    [0, 0, 25, null],
    [12, 10, 25, null],
    [15, 13, 15, 1],
    [15, 14, 15, null],
  ])("%i-%i to %i is won by %s", (t1, t2, target, winner) => {
    expect(gameWinner(t1, t2, target)).toBe(winner);
  });
});

describe("matchOutcome", () => {
  it("is open with no games", () => {
    expect(matchOutcome([], rules())).toEqual({ wins: { 1: 0, 2: 0 }, winner: null });
  });

  it("counts only finished games", () => {
    const outcome = matchOutcome([game(1, 25, 20), game(2, 12, 10)], rules());
    expect(outcome).toEqual({ wins: { 1: 1, 2: 0 }, winner: null });
  });

  it("is won on a sweep, and ignores the unplayed deciding game", () => {
    expect(matchOutcome([game(1, 25, 20), game(2, 25, 18)], rules()).winner).toBe(1);
    expect(matchOutcome([game(1, 20, 25), game(2, 18, 25)], rules()).winner).toBe(2);
  });

  it("goes to a deciding game that is only played to the shorter target", () => {
    const games = [game(1, 25, 20), game(2, 18, 25), game(3, 15, 12)];
    expect(matchOutcome(games, rules())).toEqual({ wins: { 1: 2, 2: 1 }, winner: 1 });
    // 14-12 in the decider isn't finished yet, so the match is still open.
    expect(matchOutcome([game(1, 25, 20), game(2, 18, 25), game(3, 14, 12)], rules()).winner).toBeNull();
  });

  it("needs three games in a best of five", () => {
    const five = rules({ bestOf: 5 });
    const games = [game(1, 25, 20), game(2, 25, 21), game(3, 20, 25), game(4, 25, 22)];
    expect(matchOutcome(games.slice(0, 3), five).winner).toBeNull();
    expect(matchOutcome(games, five)).toEqual({ wins: { 1: 3, 2: 1 }, winner: 1 });
  });

  it("is decided by a single game when the match is one game long", () => {
    expect(matchOutcome([game(1, 21, 25)], rules({ bestOf: 1 })).winner).toBe(2);
    expect(matchOutcome([game(1, 24, 25)], rules({ bestOf: 1 })).winner).toBeNull();
  });
});
