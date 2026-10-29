// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  state: {} as { userId: string | null; tournament: unknown; createError: { message: string } | null },
  create: vi.fn(),
  push: vi.fn(),
}));

const mutation = (mutate: unknown, error: unknown = null) => ({ mutate, isPending: false, error });

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "t1" }), useRouter: () => ({ push: h.push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("../lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: h.state.userId ? { user: { id: h.state.userId } } : null }) },
}));
vi.mock("../lib/trpc", () => ({
  trpc: {
    tournament: { getById: { useQuery: () => ({ data: h.state.tournament, isLoading: false, error: null }) } },
    event: {
      create: {
        useMutation: (options: { onSuccess?: (event: { id: string }) => void }) =>
          mutation((input: unknown) => {
            h.create(input);
            options.onSuccess?.({ id: "new-event" });
          }, h.state.createError),
      },
    },
  },
}));

import TournamentPage from "../app/tournament/[id]/page";
import { expectAccessible } from "./a11y";

const OWNER = "owner";
const event = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `e${n}`,
  name: `Event ${n}`,
  teamSize: 2,
  bestOf: 3,
  entryCap: null,
  status: "DRAFT",
  _count: { teams: 0 },
  ...overrides,
});
const tournament = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  name: "Summer Open",
  description: "Two days of beach volleyball.",
  status: "REGISTRATION",
  startDate: null,
  endDate: null,
  owner: { id: OWNER, name: "Alex Kim" },
  location: { id: "l1", name: "Riverside Park", address: "1 River Rd" },
  events: [event(1), event(2)],
  ...overrides,
});

beforeEach(() => {
  h.state = { userId: null, tournament: tournament(), createError: null };
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("tournament page for visitors", () => {
  it("shows the tournament, its venue and its events as links", () => {
    render(<TournamentPage />);
    expect(screen.getByRole("heading", { name: "Summer Open" })).toBeTruthy();
    expect(screen.getByText("Registration")).toBeTruthy();
    expect(screen.getByText("Two days of beach volleyball.")).toBeTruthy();
    expect(screen.getByText(/Riverside Park · 1 River Rd/)).toBeTruthy();
    expect(screen.getByText("Hosted by Alex Kim")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Event 2" }).getAttribute("href")).toBe("/event/e2");
  });

  it("describes each event's format and how full it is", () => {
    h.state.tournament = tournament({
      events: [
        event(1, { bestOf: 1, teamSize: 4 }),
        event(2, { _count: { teams: 1 } }),
        event(3, { _count: { teams: 5 }, entryCap: 16, bestOf: 5 }),
      ],
    });
    render(<TournamentPage />);
    expect(screen.getByText("Single game · 4 per team · 0 teams")).toBeTruthy();
    expect(screen.getByText("Best of 3 · 2 per team · 1 team")).toBeTruthy();
    expect(screen.getByText("Best of 5 · 2 per team · 5 of 16 teams")).toBeTruthy();
  });

  it("has no form, for signed-out and for other signed-in users", () => {
    const { unmount } = render(<TournamentPage />);
    expect(screen.queryByRole("heading", { name: "Add an event" })).toBeNull();
    unmount();
    h.state.userId = "someone-else";
    render(<TournamentPage />);
    expect(screen.queryByRole("heading", { name: "Add an event" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create event" })).toBeNull();
  });

  it("says when there are no events", () => {
    h.state.tournament = tournament({ events: [] });
    render(<TournamentPage />);
    expect(screen.getByText("No events have been added yet.")).toBeTruthy();
  });

  it("omits the venue and description when there are none", () => {
    h.state.tournament = tournament({ location: null, description: null });
    render(<TournamentPage />);
    expect(screen.queryByText(/Riverside Park/)).toBeNull();
  });
});

describe("tournament page for the owner", () => {
  beforeEach(() => {
    h.state.userId = OWNER;
  });

  it("links back to the dashboard and shows the form", () => {
    render(<TournamentPage />);
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("heading", { name: "Add an event" })).toBeTruthy();
    expect(screen.queryByText(/Hosted by/)).toBeNull();
  });

  it("invites the first event when there are none", () => {
    h.state.tournament = tournament({ events: [] });
    render(<TournamentPage />);
    expect(screen.getByText("No events yet. Add the first one below.")).toBeTruthy();
  });

  it("creates an event with the defaults, and opens it", async () => {
    render(<TournamentPage />);
    await userEvent.type(screen.getByLabelText(/Event name/), "  Mixed Doubles ");
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));
    // No team limit was given, so the field is left out rather than sent empty.
    expect(h.create).toHaveBeenCalledWith({ tournamentId: "t1", name: "Mixed Doubles", teamSize: 2, bestOf: 3 });
    expect(h.push).toHaveBeenCalledWith("/event/new-event");
  });

  it("sends the chosen team size, match format and team limit", async () => {
    render(<TournamentPage />);
    await userEvent.type(screen.getByLabelText(/Event name/), "Open");
    await userEvent.click(screen.getByRole("radio", { name: /Quads/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Best of 5/ }));
    await userEvent.type(screen.getByLabelText(/Team limit/), "16");
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(h.create).toHaveBeenCalledWith({ tournamentId: "t1", name: "Open", teamSize: 4, bestOf: 5, entryCap: 16 });
  });

  it("explains a missing name instead of submitting, and moves focus there", async () => {
    render(<TournamentPage />);
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(screen.getByText("Enter a name for the event")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/Event name/));
    expect(h.create).not.toHaveBeenCalled();
  });

  it.each(["0", "2.5", "-3"])("rejects a team limit of %s", async (limit) => {
    render(<TournamentPage />);
    await userEvent.type(screen.getByLabelText(/Event name/), "Open");
    await userEvent.type(screen.getByLabelText(/Team limit/), limit);
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(screen.getByText("Enter a whole number, 1 or more")).toBeTruthy();
    expect(h.create).not.toHaveBeenCalled();
  });

  it("shows an error from the server", () => {
    h.state.createError = { message: "Tournament not found" };
    render(<TournamentPage />);
    expect(screen.getByRole("alert").textContent).toBe("Tournament not found");
  });
});

describe("tournament page when it can't be loaded", () => {
  it("says so", () => {
    h.state.tournament = undefined;
    render(<TournamentPage />);
    expect(screen.getByRole("heading", { name: "Tournament not found" })).toBeTruthy();
  });
});

describe("tournament page accessibility", () => {
  it("has no violations for a visitor", async () => {
    const { container } = render(<TournamentPage />);
    expect(screen.queryAllByRole("main")).toHaveLength(0); // the root layout owns the landmark
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await expectAccessible(container);
  });

  it("has no violations for the owner, with the add-event form", async () => {
    h.state.userId = OWNER;
    const { container } = render(<TournamentPage />);
    await expectAccessible(container);
  });

  it("has no violations with validation errors showing", async () => {
    h.state.userId = OWNER;
    const { container } = render(<TournamentPage />);
    await userEvent.type(screen.getByLabelText(/Team limit/), "0");
    await userEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(screen.getByText("Enter a name for the event")).toBeTruthy();
    expect(screen.getByText("Enter a whole number, 1 or more")).toBeTruthy();
    await expectAccessible(container);
  });

  it("has no violations with a server error showing", async () => {
    h.state.userId = OWNER;
    h.state.createError = { message: "Tournament not found" };
    const { container } = render(<TournamentPage />);
    await expectAccessible(container);
  });

  it("has no violations with no events, or when it can't be found", async () => {
    h.state.tournament = tournament({ events: [] });
    const first = render(<TournamentPage />);
    await expectAccessible(first.container);
    first.unmount();
    h.state.tournament = undefined;
    const second = render(<TournamentPage />);
    await expectAccessible(second.container);
  });
});

describe("tournament page title", () => {
  it("is named after the tournament, and says when it can't be found", () => {
    const first = render(<TournamentPage />);
    expect(document.title).toBe("Summer Open · Volley");
    first.unmount();
    h.state.tournament = undefined;
    render(<TournamentPage />);
    expect(document.title).toBe("Tournament not found · Volley");
  });
});
