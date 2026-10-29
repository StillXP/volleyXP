// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  state: {} as {
    userId: string | null;
    event: unknown;
    teams: unknown[];
    matches: unknown[];
  },
  generate: vi.fn(),
  deleteStage: vi.fn(),
  addTeam: vi.fn(),
  removeTeam: vi.fn(),
  recordGame: vi.fn(),
}));

const query = (data: unknown) => ({ data, isLoading: false, error: null });
const mutation = (mutate: unknown) => ({ mutate, isPending: false, error: null });

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "e1" }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("../lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: h.state.userId ? { user: { id: h.state.userId } } : null }) },
}));
vi.mock("../lib/trpc", () => {
  const invalidate = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ event: { getById: invalidate }, team: { getByEvent: invalidate }, match: { getByStage: invalidate } }),
      event: { getById: { useQuery: () => query(h.state.event) }, generateBracket: { useMutation: () => mutation(h.generate) } },
      team: {
        getByEvent: { useQuery: () => query(h.state.teams) },
        create: { useMutation: () => mutation(h.addTeam) },
        delete: { useMutation: () => mutation(h.removeTeam) },
      },
      match: {
        getByStage: { useQuery: () => query(h.state.matches) },
        recordGame: { useMutation: () => ({ mutateAsync: h.recordGame, isPending: false }) },
        complete: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
        reopen: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      },
      stage: { delete: { useMutation: () => mutation(h.deleteStage) } },
    },
  };
});

import { planBracket } from "../server/bracketPlan";
import EventPage from "../app/event/[id]/page";

const OWNER = "owner";
const team = (n: number) => ({ id: `t${n}`, name: `Team ${n}`, seed: n, status: "REGISTERED" });
const event = (stages: unknown[] = []) => ({
  id: "e1",
  name: "Mixed Doubles",
  bestOf: 3,
  pointsToWin: 25,
  pointsToWinLastGame: 15,
  teamSize: 2,
  tournament: { id: "t", name: "Summer Open", ownerId: OWNER },
  stages,
  courts: [],
});

/** Matches stored the way event.generateBracket stores them. */
const stored = (n: number, format: "single" | "double", overrides: Record<string, object> = {}) => {
  const teams = Array.from({ length: n }, (_, i) => team(i + 1));
  const side = (s: { kind: string; teamId?: string }) => (s.kind === "team" ? teams.find((t) => t.id === s.teamId)! : null);
  return planBracket(teams, format).map((p) => ({
    id: `stored-${p.key}`,
    bracketKey: p.key,
    status: "SCHEDULED",
    team1: side(p.team1),
    team2: side(p.team2),
    team1Id: side(p.team1)?.id ?? null,
    team2Id: side(p.team2)?.id ?? null,
    winnerId: null,
    scheduledTime: null,
    court: null,
    games: [],
    ...overrides[p.key],
  }));
};

beforeEach(() => {
  h.state = { userId: null, event: event(), teams: [], matches: [] };
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("event page before a bracket exists", () => {
  it("lets the owner add teams, and won't generate with fewer than two", () => {
    h.state.userId = OWNER;
    h.state.teams = [team(1)];
    render(<EventPage />);
    expect(screen.getByRole("heading", { name: "Mixed Doubles" })).toBeTruthy();
    expect(screen.getByLabelText("Team name")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Generate bracket" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Add at least two teams first.")).toBeTruthy();
  });

  it("generates in the chosen format", async () => {
    h.state.userId = OWNER;
    h.state.teams = [team(1), team(2), team(3)];
    render(<EventPage />);
    const generate = screen.getByRole("button", { name: "Generate bracket" });
    expect((generate as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(generate);
    expect(h.generate).toHaveBeenLastCalledWith({ eventId: "e1", format: "single" });

    await userEvent.click(screen.getByRole("radio", { name: /Double Elimination/ }));
    await userEvent.click(generate);
    expect(h.generate).toHaveBeenLastCalledWith({ eventId: "e1", format: "double" });
  });

  it("adds a trimmed team name", async () => {
    h.state.userId = OWNER;
    render(<EventPage />);
    await userEvent.type(screen.getByLabelText("Team name"), "  Spikers ");
    await userEvent.click(screen.getByRole("button", { name: "Add team" }));
    expect(h.addTeam).toHaveBeenCalledWith({ eventId: "e1", name: "Spikers" }, expect.anything());
  });

  it("shows visitors the teams but no controls", () => {
    h.state.userId = "someone-else";
    h.state.teams = [team(1), team(2)];
    render(<EventPage />);
    expect(screen.getByText("Team 1")).toBeTruthy();
    expect(screen.queryByLabelText("Team name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Generate bracket" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.getByText("The bracket hasn't been generated yet.")).toBeTruthy();
  });

  it("shows a signed-out visitor the same", () => {
    h.state.teams = [team(1)];
    render(<EventPage />);
    expect(screen.queryByRole("button", { name: "Generate bracket" })).toBeNull();
  });

  it("marks withdrawn teams and doesn't count them", () => {
    h.state.teams = [team(1), team(2), { ...team(3), status: "WITHDRAWN" }];
    render(<EventPage />);
    expect(screen.getByText("Withdrawn")).toBeTruthy();
    expect(screen.getByText("2 teams")).toBeTruthy();
  });
});

describe("event page with a bracket", () => {
  const withBracket = (type: "SINGLE_ELIM" | "DOUBLE_ELIM", matches: unknown[]) => {
    h.state.event = event([{ id: "s1", type }]);
    h.state.matches = matches;
  };

  it("draws the stored bracket, with a finished match's result carried into the next round", () => {
    withBracket(
      "SINGLE_ELIM",
      stored(4, "single", {
        "r1-m1": {
          status: "COMPLETED",
          winnerId: "t1",
          games: [
            { gameNumber: 1, team1Score: 25, team2Score: 18, winnerId: "t1" },
            { gameNumber: 2, team1Score: 25, team2Score: 20, winnerId: "t1" },
          ],
        },
      })
    );
    render(<EventPage />);
    expect(screen.getByRole("heading", { name: "Bracket" })).toBeTruthy();
    expect(screen.getByText("Single elimination")).toBeTruthy();
    expect(screen.getByText("COMPLETED")).toBeTruthy();
    // Seed 1 won, so it shows in its first match and in the final it advanced to.
    expect(screen.getAllByText("Team 1").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Generate bracket")).toBeNull();
  });

  it("draws a double-elimination bracket with its grand final", () => {
    withBracket("DOUBLE_ELIM", stored(4, "double"));
    render(<EventPage />);
    expect(screen.getByText("Double elimination")).toBeTruthy();
    expect(screen.getAllByText(/Grand Final/).length).toBeGreaterThan(0);
  });

  it("shows a live match's court", () => {
    withBracket("SINGLE_ELIM", stored(4, "single", { "r1-m1": { status: "IN_PROGRESS", court: { name: "Net 2" } } }));
    render(<EventPage />);
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.getByText("Net 2")).toBeTruthy();
  });

  it("only offers the owner a way to delete it, after confirming", async () => {
    withBracket("SINGLE_ELIM", stored(4, "single"));
    const { unmount } = render(<EventPage />);
    expect(screen.queryByRole("button", { name: "Delete bracket" })).toBeNull();
    unmount();

    h.state.userId = OWNER;
    render(<EventPage />);
    await userEvent.click(screen.getByRole("button", { name: "Delete bracket" }));
    expect(h.deleteStage).not.toHaveBeenCalled();

    const confirm = screen.getByRole("group", { name: "Confirm deleting the bracket" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(h.deleteStage).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete bracket" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Confirm deleting the bracket" })).getByRole("button", { name: "Delete" }));
    expect(h.deleteStage).toHaveBeenCalledWith({ id: "s1" });
  });

  it("ignores pool-play stages when looking for the bracket", () => {
    h.state.event = event([{ id: "p", type: "POOL_PLAY" }]);
    h.state.userId = OWNER;
    render(<EventPage />);
    expect(screen.getByRole("button", { name: "Generate bracket" })).toBeTruthy();
  });
});

describe("event page scoring", () => {
  const openMatch = async (container: HTMLElement, key: string) =>
    userEvent.click(container.querySelector(`[data-match-id="${key}"]`)!);

  beforeEach(() => {
    h.state.event = event([{ id: "s1", type: "SINGLE_ELIM" }]);
    h.state.matches = stored(4, "single");
    h.recordGame.mockResolvedValue({});
  });

  it("gives the owner scoring controls in the match view", async () => {
    h.state.userId = OWNER;
    const { container } = render(<EventPage />);
    await openMatch(container, "r1-m1");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Score this match" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Point for Team 1" })).toBeTruthy();
  });

  it("saves a point against the stored match that was opened", async () => {
    h.state.userId = OWNER;
    const { container } = render(<EventPage />);
    await openMatch(container, "r1-m2");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Point for Team 2" }));
    // r1-m2 is seed 2 against seed 3.
    expect(h.recordGame).toHaveBeenCalledWith({ matchId: "stored-r1-m2", gameNumber: 1, team1Score: 1, team2Score: 0 });
  });

  it("uses the event's own scoring rules", async () => {
    h.state.userId = OWNER;
    h.state.event = { ...event([{ id: "s1", type: "SINGLE_ELIM" }]), pointsToWin: 21 };
    const { container } = render(<EventPage />);
    await openMatch(container, "r1-m1");
    expect(within(screen.getByRole("dialog")).getByText(/first to 21, win by 2/)).toBeTruthy();
  });

  it("waits for both teams in a match that isn't set yet", async () => {
    h.state.userId = OWNER;
    const { container } = render(<EventPage />);
    await openMatch(container, "r2-m1"); // the final, still waiting on the semifinals
    expect(within(screen.getByRole("dialog")).getByText("Scoring opens once both teams are known.")).toBeTruthy();
  });

  it.each([
    ["a visitor", "someone-else"],
    ["a signed-out visitor", null],
  ])("shows %s the match without scoring controls", async (_label, userId) => {
    h.state.userId = userId;
    const { container } = render(<EventPage />);
    await openMatch(container, "r1-m1");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Score this match" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Point for/ })).toBeNull();
  });
});

describe("event page when the event can't be loaded", () => {
  it("says so", () => {
    h.state.event = undefined;
    render(<EventPage />);
    expect(screen.getByRole("heading", { name: "Event not found" })).toBeTruthy();
  });
});
