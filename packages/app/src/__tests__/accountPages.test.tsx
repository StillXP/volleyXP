// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  tournaments: [] as unknown[],
  createMutate: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("../lib/auth-client", () => ({
  authClient: {
    signIn: { email: h.signIn },
    signUp: { email: h.signUp },
    signOut: h.signOut,
    useSession: () => ({ data: null, isPending: false }),
  },
}));
vi.mock("../lib/trpc", () => ({
  trpc: {
    tournament: {
      getMine: { useQuery: () => ({ data: h.tournaments, refetch: vi.fn() }) },
      create: { useMutation: () => ({ mutate: h.createMutate, isPending: false }) },
    },
  },
}));

import DashboardPage from "../app/dashboard/page";
import SignInPage from "../app/sign-in/[[...sign-in]]/page";
import SignUpPage from "../app/sign-up/[[...sign-up]]/page";
import { expectAccessible } from "./a11y";

const tournament = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `t${n}`,
  name: `Tournament ${n}`,
  status: "REGISTRATION",
  events: [{ id: `e${n}a`, name: "Mixed Doubles" }, { id: `e${n}b`, name: "Open" }],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.tournaments = [];
});
afterEach(cleanup);

describe("dashboard", () => {
  it("has no accessibility violations when empty", async () => {
    const { container } = render(<DashboardPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Tournaments" })).toBeTruthy();
    expect(screen.getByText("No tournaments yet.")).toBeTruthy();
    await expectAccessible(container);
  });

  it("has no accessibility violations with tournaments and their events", async () => {
    h.tournaments = [tournament(1), tournament(2, { status: "IN_PROGRESS", events: [] })];
    const { container } = render(<DashboardPage />);
    expect(screen.getByRole("link", { name: "Tournament 1" }).getAttribute("href")).toBe("/tournament/t1");
    expect(screen.getByRole("link", { name: "Mixed Doubles" }).getAttribute("href")).toBe("/event/e1a");
    await expectAccessible(container);
  });

  it("creates a tournament from the form", async () => {
    render(<DashboardPage />);
    await userEvent.type(screen.getByLabelText(/Tournament name/), "Summer Open");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(h.createMutate).toHaveBeenCalledWith({ name: "Summer Open" });
  });

  it("signs out and goes home", async () => {
    h.signOut.mockResolvedValue({});
    render(<DashboardPage />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/"));
  });
});

describe.each([
  ["sign-in", SignInPage, "Sign in", () => h.signIn],
  ["sign-up", SignUpPage, "Create an account", () => h.signUp],
] as const)("%s page", (_name, Page, heading, mock) => {
  it("has no accessibility violations", async () => {
    const { container } = render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
    await expectAccessible(container);
  });

  it("has no accessibility violations when the server rejects the form, and says why", async () => {
    mock().mockResolvedValue({ error: { message: "Invalid email or password" } });
    const { container } = render(<Page />);
    await userEvent.type(screen.getByLabelText(/Email/), "a@b.co");
    await userEvent.type(screen.getByLabelText(/Password/), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /Sign in$|Create account$/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Invalid email or password"));
    await expectAccessible(container);
  });
});

describe("page titles", () => {
  it.each([
    ["the dashboard", DashboardPage, "Tournaments · Volley"],
    ["sign-in", SignInPage, "Sign in · Volley"],
    ["sign-up", SignUpPage, "Create an account · Volley"],
  ])("titles %s", (_name, Page, title) => {
    render(<Page />);
    expect(document.title).toBe(title);
  });
});
