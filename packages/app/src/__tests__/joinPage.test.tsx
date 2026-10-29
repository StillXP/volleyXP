// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  userId: null as string | null,
  invite: {} as { data?: unknown; isLoading: boolean },
  joinError: null as { message: string } | null,
  joinMutate: vi.fn(),
  push: vi.fn(),
  inviteOptions: undefined as undefined | { retry?: boolean },
  onSuccess: undefined as undefined | ((result: { eventId: string }) => void),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ code: "CODE-abc_123" }), useRouter: () => ({ push: h.push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("../lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: h.userId ? { user: { id: h.userId } } : null }) },
}));
vi.mock("../lib/trpc", () => ({
  trpc: {
    registration: {
      getInvite: {
        useQuery: (_input: unknown, options: typeof h.inviteOptions) => {
          h.inviteOptions = options;
          return h.invite;
        },
      },
      join: {
        useMutation: (options: { onSuccess?: (result: { eventId: string }) => void }) => {
          h.onSuccess = options.onSuccess;
          return { mutate: h.joinMutate, isPending: false, error: h.joinError };
        },
      },
    },
  },
}));

import JoinPage from "../app/join/[code]/page";
import { expectAccessible } from "./a11y";

const preview = (overrides: Record<string, unknown> = {}) => ({
  teamName: "Kim",
  captain: "Alex Kim",
  spotsLeft: 1,
  registrationOpen: true,
  event: { id: "e1", name: "Mixed Doubles", tournament: { id: "t1", name: "Summer Open" } },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.userId = null;
  h.invite = { data: preview(), isLoading: false };
  h.joinError = null;
});
afterEach(cleanup);

describe("join page", () => {
  it("says who is inviting you, to what, and how many spots are left", () => {
    render(<JoinPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Join Kim" })).toBeTruthy();
    expect(screen.getByText(/Alex Kim is putting a team together/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mixed Doubles" }).getAttribute("href")).toBe("/event/e1");
    expect(screen.getByText(/in Summer Open/)).toBeTruthy();
    expect(screen.getByText("1 spot left.")).toBeTruthy();
  });

  it("pluralizes the spots", () => {
    h.invite = { data: preview({ spotsLeft: 3 }), isLoading: false };
    render(<JoinPage />);
    expect(screen.getByText("3 spots left.")).toBeTruthy();
  });

  it("copes with a missing captain name", () => {
    h.invite = { data: preview({ captain: null }), isLoading: false };
    render(<JoinPage />);
    expect(screen.getByText(/A team is forming/)).toBeTruthy();
  });

  it("titles the tab after the team", () => {
    render(<JoinPage />);
    expect(document.title).toBe("Join Kim · Volley");
  });

  it("doesn't retry a link that is not valid", () => {
    render(<JoinPage />);
    expect(h.inviteOptions).toEqual({ retry: false });
  });

  describe("signed out", () => {
    it("sends the person to sign in or sign up and back here afterwards", () => {
      render(<JoinPage />);
      expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in?next=%2Fjoin%2FCODE-abc_123");
      expect(screen.getByRole("link", { name: "create an account" }).getAttribute("href")).toBe("/sign-up?next=%2Fjoin%2FCODE-abc_123");
      expect(screen.queryByRole("button", { name: /Join/ })).toBeNull();
    });
  });

  describe("signed in", () => {
    beforeEach(() => { h.userId = "u9"; });

    it("joins the team, then opens its event", async () => {
      render(<JoinPage />);
      await userEvent.click(screen.getByRole("button", { name: "Join Kim" }));
      expect(h.joinMutate).toHaveBeenCalledWith({ code: "CODE-abc_123" });
      h.onSuccess?.({ eventId: "e1" });
      expect(h.push).toHaveBeenCalledWith("/event/e1");
    });

    it("shows why joining failed", () => {
      h.joinError = { message: "You're already on a team in this event" };
      render(<JoinPage />);
      expect(screen.getByRole("alert").textContent).toBe("You're already on a team in this event");
    });
  });

  describe("when joining isn't possible", () => {
    it.each([
      ["registration is closed", { registrationOpen: false }, /Registration is closed/],
      ["the team is full", { spotsLeft: 0 }, /no room left/],
    ])("says so when %s, signed in or not", (_label, overrides, message) => {
      h.invite = { data: preview(overrides), isLoading: false };
      for (const userId of [null, "u9"]) {
        h.userId = userId;
        const { unmount } = render(<JoinPage />);
        expect(screen.getByText(message)).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Join/ })).toBeNull();
        expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
        unmount();
      }
    });

    it("says a full team is full", () => {
      h.invite = { data: preview({ spotsLeft: 0 }), isLoading: false };
      render(<JoinPage />);
      expect(screen.getByText("This team is full.")).toBeTruthy();
    });
  });

  it("explains an invite link that is not valid", () => {
    h.invite = { data: undefined, isLoading: false };
    render(<JoinPage />);
    expect(screen.getByRole("heading", { level: 1, name: "This invite link isn't valid" })).toBeTruthy();
    expect(screen.getByText(/withdrawn, or the captain made a new link/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Volley" }).getAttribute("href")).toBe("/");
    expect(document.title).toBe("Invite link not valid · Volley");
  });

  it("says when it is loading", () => {
    h.invite = { data: undefined, isLoading: true };
    render(<JoinPage />);
    expect(screen.getByRole("status").textContent).toBe("Loading invite…");
  });

  describe("accessibility", () => {
    it.each([
      ["signed out", { userId: null }],
      ["signed in", { userId: "u9" }],
      ["registration closed", { userId: null, invite: { data: preview({ registrationOpen: false }), isLoading: false } }],
      ["a full team", { userId: "u9", invite: { data: preview({ spotsLeft: 0 }), isLoading: false } }],
      ["an invalid link", { userId: null, invite: { data: undefined, isLoading: false } }],
      ["loading", { userId: null, invite: { data: undefined, isLoading: true } }],
    ])("has no violations: %s", async (_label, state) => {
      Object.assign(h, state);
      const { container } = render(<JoinPage />);
      expect(screen.queryAllByRole("heading", { level: 1 }).length).toBeLessThanOrEqual(1);
      await expectAccessible(container);
    });

    it("has no violations while showing an error", async () => {
      h.userId = "u9";
      h.joinError = { message: "This team is already full" };
      const { container } = render(<JoinPage />);
      await expectAccessible(container);
    });
  });
});
