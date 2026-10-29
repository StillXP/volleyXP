// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  recordGame: vi.fn(),
  complete: vi.fn(),
  reopen: vi.fn(),
}));

vi.mock("../lib/trpc", () => ({
  trpc: {
    match: {
      recordGame: { useMutation: () => ({ mutateAsync: h.recordGame, isPending: false }) },
      complete: { useMutation: () => ({ mutateAsync: h.complete, isPending: false }) },
      reopen: { useMutation: () => ({ mutateAsync: h.reopen, isPending: false }) },
    },
  },
}));

import { MatchScorer, type ScorerMatchData } from "../components/MatchScorer";
import type { ScoringRules } from "../lib/matchRules";

const rules: ScoringRules = { bestOf: 3, pointsToWin: 25, pointsToWinLastGame: 15 };
const game = (gameNumber: number, team1Score: number, team2Score: number) => ({ gameNumber, team1Score, team2Score });
const matchOf = (overrides: Partial<ScorerMatchData> = {}): ScorerMatchData => ({
  id: "m1",
  status: "SCHEDULED",
  team1: { id: "a", name: "Team A" },
  team2: { id: "b", name: "Team B" },
  team1Id: "a",
  team2Id: "b",
  winnerId: null,
  games: [],
  ...overrides,
});

const onChanged = vi.fn(async () => {});
const renderScorer = (overrides: Partial<ScorerMatchData> = {}, r: ScoringRules = rules) =>
  render(<MatchScorer match={matchOf(overrides)} rules={r} onChanged={onChanged} />);
const point = (name: string) => screen.getByRole("button", { name: `Point for ${name}` }) as HTMLButtonElement;
const takeOff = (name: string) => screen.getByRole("button", { name: `Take a point off ${name}` }) as HTMLButtonElement;
const scoreOf = (name: string) => within(screen.getByRole("group", { name })).getByText(/^\d+$/).textContent;

/** Makes recordGame stay in flight until the test lets it finish. */
function holdRecordGame() {
  const resolvers: (() => void)[] = [];
  h.recordGame.mockImplementation(() => new Promise<void>((resolve) => resolvers.push(resolve)));
  return { finishOne: () => act(async () => void resolvers.shift()!()) };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.recordGame.mockResolvedValue({});
  h.complete.mockResolvedValue({});
  h.reopen.mockResolvedValue({});
});
afterEach(cleanup);

describe("MatchScorer in play", () => {
  it("starts a fresh match at game 1, 0-0", () => {
    renderScorer();
    expect(screen.getByText(/Game 1 · first to 25, win by 2 · Games won 0–0/)).toBeTruthy();
    expect(scoreOf("Team A")).toBe("0");
    expect(scoreOf("Team B")).toBe("0");
    expect(point("Team A").disabled).toBe(false);
    expect(takeOff("Team A").disabled).toBe(true); // nothing to take off yet
  });

  it("shows a tap at once and saves the new score", async () => {
    const { finishOne } = holdRecordGame();
    renderScorer();
    await userEvent.click(point("Team A"));
    expect(scoreOf("Team A")).toBe("1"); // before the server has answered
    expect(h.recordGame).toHaveBeenCalledWith({ matchId: "m1", gameNumber: 1, team1Score: 1, team2Score: 0 });
    await finishOne();
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("scores for either team", async () => {
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 5, 7)] });
    await userEvent.click(point("Team B"));
    expect(h.recordGame).toHaveBeenLastCalledWith({ matchId: "m1", gameNumber: 1, team1Score: 5, team2Score: 8 });
  });

  it("keeps up with a burst of taps without overlapping saves, sending the latest score", async () => {
    const { finishOne } = holdRecordGame();
    renderScorer();
    await userEvent.click(point("Team A"));
    await userEvent.click(point("Team A"));
    await userEvent.click(point("Team A"));
    expect(scoreOf("Team A")).toBe("3");
    expect(h.recordGame).toHaveBeenCalledTimes(1); // the first is still in flight
    await finishOne();
    await waitFor(() => expect(h.recordGame).toHaveBeenCalledTimes(2));
    expect(h.recordGame.mock.calls.map(([a]) => a.team1Score)).toEqual([1, 3]);
    await finishOne();
  });

  it("keeps a tap made while the last save is still being refreshed", async () => {
    let finishRefresh!: () => void;
    const refreshing = new Promise<void>((resolve) => (finishRefresh = resolve));
    const slowRefresh = vi.fn(() => refreshing);
    h.recordGame.mockResolvedValueOnce({}); // the first save finishes at once
    const { finishOne } = holdRecordGame(); // the next one stays in flight
    render(<MatchScorer match={matchOf()} rules={rules} onChanged={slowRefresh} />);

    await userEvent.click(point("Team A")); // saves straight away, then starts refreshing
    await waitFor(() => expect(slowRefresh).toHaveBeenCalledOnce());
    await userEvent.click(point("Team A")); // tapped during the refresh
    expect(scoreOf("Team A")).toBe("2");

    await act(async () => finishRefresh());
    // The refresh knew nothing of the second tap, so it mustn't wipe it out.
    await waitFor(() => expect(h.recordGame).toHaveBeenLastCalledWith({ matchId: "m1", gameNumber: 1, team1Score: 2, team2Score: 0 }));
    expect(scoreOf("Team A")).toBe("2");
    await finishOne();
  });

  it("takes a point off, and not below zero", async () => {
    holdRecordGame(); // keep the save in flight so the shown score is the one just tapped
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 1, 0)] });
    await userEvent.click(takeOff("Team A"));
    expect(h.recordGame).toHaveBeenCalledWith({ matchId: "m1", gameNumber: 1, team1Score: 0, team2Score: 0 });
    expect(scoreOf("Team A")).toBe("0");
    expect(takeOff("Team A").disabled).toBe(true);
  });

  it("stops adding points once the game is finished, until it is undone", async () => {
    holdRecordGame();
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 24, 20)] });
    await userEvent.click(point("Team A")); // 25-20 finishes game 1
    expect(screen.getByText("Game 1 finished.")).toBeTruthy();
    expect(point("Team A").disabled).toBe(true);
    expect(point("Team B").disabled).toBe(true);
    await userEvent.click(takeOff("Team A")); // oops: back to 24-20
    expect(point("Team A").disabled).toBe(false);
  });

  it("does not finish a game on a one-point lead at the target", async () => {
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 24, 24)] });
    await userEvent.click(point("Team A")); // 25-24
    expect(screen.queryByText("Game 1 finished.")).toBeNull();
    expect(point("Team A").disabled).toBe(false);
  });

  it("moves on to the next game, and lets the last point of the finished one be undone", async () => {
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 25, 20)] });
    expect(screen.getByText(/Game 2 · first to 25, win by 2 · Games won 1–0/)).toBeTruthy();
    expect(scoreOf("Team A")).toBe("0");
    await userEvent.click(screen.getByRole("button", { name: "Undo last point of game 1" }));
    expect(h.recordGame).toHaveBeenCalledWith({ matchId: "m1", gameNumber: 1, team1Score: 24, team2Score: 20 });
  });

  it("starts the next game with its first point", async () => {
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 25, 20)] });
    await userEvent.click(point("Team B"));
    expect(h.recordGame).toHaveBeenCalledWith({ matchId: "m1", gameNumber: 2, team1Score: 0, team2Score: 1 });
  });

  it("plays the deciding game to the shorter target", () => {
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 25, 20), game(2, 18, 25)] });
    expect(screen.getByText(/Game 3 · first to 15, win by 2 · Games won 1–1/)).toBeTruthy();
  });

  it("announces the score to screen readers", () => {
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 12, 10)] });
    const status = screen.getAllByRole("status").find((el) => el.textContent?.startsWith("Game 1:"))!;
    expect(status.textContent).toBe("Game 1: Team A 12, Team B 10");
  });
});

describe("MatchScorer when the match is decided", () => {
  const decided = { status: "COMPLETED" as const, winnerId: "a", games: [game(1, 25, 20), game(2, 25, 18)] };

  it("shows the result and no way to add points", () => {
    renderScorer(decided);
    expect(screen.getByText(/Team A won 2–0/)).toBeTruthy();
    expect(point("Team A").disabled).toBe(true);
    expect(point("Team B").disabled).toBe(true);
    expect(screen.queryByText("Record a forfeit")).toBeNull();
  });

  it("undoes the winning point from the last game", async () => {
    holdRecordGame();
    renderScorer(decided);
    await userEvent.click(takeOff("Team A"));
    expect(h.recordGame).toHaveBeenCalledWith({ matchId: "m1", gameNumber: 2, team1Score: 24, team2Score: 18 });
    expect(point("Team A").disabled).toBe(false); // game 2 is playable again
  });
});

describe("MatchScorer typed scores", () => {
  it("sets the current game to the scores entered", async () => {
    holdRecordGame();
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 5, 3)] });
    await userEvent.type(screen.getByRole("spinbutton", { name: "Team A" }), "25");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Team B" }), "22");
    await userEvent.click(screen.getByRole("button", { name: "Save score" }));
    expect(h.recordGame).toHaveBeenCalledWith({ matchId: "m1", gameNumber: 1, team1Score: 25, team2Score: 22 });
    expect(scoreOf("Team A")).toBe("25");
  });

  it.each([
    ["nothing", "", ""],
    ["a half-filled form", "25", ""],
    ["a negative number", "-3", "20"],
    ["a decimal", "2.5", "20"],
  ])("explains %s instead of saving", async (_label, a, b) => {
    renderScorer();
    if (a) await userEvent.type(screen.getByRole("spinbutton", { name: "Team A" }), a);
    if (b) await userEvent.type(screen.getByRole("spinbutton", { name: "Team B" }), b);
    await userEvent.click(screen.getByRole("button", { name: "Save score" }));
    expect(screen.getByRole("alert").textContent).toBe("Enter whole numbers, 0 or more");
    expect(h.recordGame).not.toHaveBeenCalled();
  });
});

describe("MatchScorer forfeits", () => {
  it("won't record one until a winner is picked", async () => {
    renderScorer();
    const record = screen.getByRole("button", { name: "Record forfeit" }) as HTMLButtonElement;
    expect(record.disabled).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: "Team B" }));
    expect(record.disabled).toBe(false);
  });

  it("records the chosen winner and refreshes", async () => {
    renderScorer();
    await userEvent.click(screen.getByRole("radio", { name: "Team B" }));
    await userEvent.click(screen.getByRole("button", { name: "Record forfeit" }));
    expect(h.complete).toHaveBeenCalledWith({ id: "m1", winnerId: "b" });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("offers to reopen a forfeit, and nothing else", async () => {
    renderScorer({ status: "COMPLETED", winnerId: "b" });
    expect(screen.getByText(/Completed by forfeit\. Team B advanced\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Point for/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Reopen match" }));
    expect(h.reopen).toHaveBeenCalledWith({ id: "m1" });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});

describe("MatchScorer when scoring isn't possible", () => {
  it("waits for both teams", () => {
    renderScorer({ team2: null, team2Id: null });
    expect(screen.getByText("Scoring opens once both teams are known.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says a cancelled match was cancelled", () => {
    renderScorer({ status: "CANCELLED" });
    expect(screen.getByText("This match was cancelled.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Point for/ })).toBeNull();
  });
});

describe("MatchScorer errors", () => {
  it("shows the server's message and goes back to the saved score", async () => {
    h.recordGame.mockRejectedValue(new Error("A match that depends on this result has already started"));
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 5, 3)] });
    await userEvent.click(point("Team A"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("has already started"));
    expect(scoreOf("Team A")).toBe("5"); // not the 6 that was tapped
    expect(onChanged).toHaveBeenCalled();
  });

  it("clears the message on the next tap", async () => {
    h.recordGame.mockRejectedValueOnce(new Error("nope"));
    renderScorer({ status: "IN_PROGRESS", games: [game(1, 5, 3)] });
    await userEvent.click(point("Team A"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await userEvent.click(point("Team B"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
