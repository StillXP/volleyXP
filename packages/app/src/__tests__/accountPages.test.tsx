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
  search: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, refresh: vi.fn() }),
  useSearchParams: () => h.search,
}));
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
  h.search = new URLSearchParams();
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
    const first = screen.queryByLabelText(/First name/);
    if (first) {
      await userEvent.type(first, "Ada");
      await userEvent.type(screen.getByLabelText(/Last name/), "Lovelace");
    }
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

describe("sign-up names", () => {
  const fill = async (first: string, last: string) => {
    await userEvent.type(screen.getByLabelText(/First name/), first);
    await userEvent.type(screen.getByLabelText(/Last name/), last);
    await userEvent.type(screen.getByLabelText(/Email/), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "correct-horse-battery");
  };

  it("asks for a first and a last name, both required, and no longer a single name", () => {
    render(<SignUpPage />);
    expect((screen.getByLabelText(/First name/) as HTMLInputElement).required).toBe(true);
    expect((screen.getByLabelText(/Last name/) as HTMLInputElement).required).toBe(true);
    expect(screen.queryByLabelText(/^Name/)).toBeNull();
  });

  it("labels them for autofill", () => {
    render(<SignUpPage />);
    expect(screen.getByLabelText(/First name/).getAttribute("autocomplete")).toBe("given-name");
    expect(screen.getByLabelText(/Last name/).getAttribute("autocomplete")).toBe("family-name");
  });

  it("sends the trimmed names, and the display name Better Auth needs", async () => {
    h.signUp.mockResolvedValue({});
    render(<SignUpPage />);
    await fill("  Ada ", " Lovelace ");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(h.signUp).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "correct-horse-battery",
        name: "Ada Lovelace",
        firstName: "Ada",
        lastName: "Lovelace",
      })
    );
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/dashboard"));
  });

  it("won't submit without both names", async () => {
    render(<SignUpPage />);
    await userEvent.type(screen.getByLabelText(/First name/), "Ada");
    await userEvent.type(screen.getByLabelText(/Email/), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(h.signUp).not.toHaveBeenCalled();
  });
});

describe.each([
  ["sign-in", SignInPage, () => h.signIn, "/sign-up", "Sign up"],
  ["sign-up", SignUpPage, () => h.signUp, "/sign-in", "Sign in"],
] as const)("%s going back to where the person came from", (_name, Page, mock, otherPath, otherLabel) => {
  const submit = async () => {
    const first = screen.queryByLabelText(/First name/);
    if (first) {
      await userEvent.type(first, "Ada");
      await userEvent.type(screen.getByLabelText(/Last name/), "Lovelace");
    }
    await userEvent.type(screen.getByLabelText(/Email/), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: /Sign in$|Create account$/ }));
  };

  it("goes to the dashboard when nothing says otherwise", async () => {
    mock().mockResolvedValue({});
    render(<Page />);
    await submit();
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/dashboard"));
  });

  it.each(["/join/abc123", "/event/e1", "/tournament/t1?tab=events"])("goes to %s when asked to", async (next) => {
    h.search = new URLSearchParams({ next });
    mock().mockResolvedValue({});
    render(<Page />);
    await submit();
    await waitFor(() => expect(h.push).toHaveBeenCalledWith(next));
  });

  it.each([
    ["another site", "https://evil.example/phish"],
    ["a protocol-relative address", "//evil.example"],
    ["a script", "javascript:alert(1)"],
  ])("ignores a request to go to %s", async (_label, next) => {
    h.search = new URLSearchParams({ next });
    mock().mockResolvedValue({});
    render(<Page />);
    await submit();
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/dashboard"));
    expect(h.push).not.toHaveBeenCalledWith(next);
  });

  it("stays put when the server rejects the form", async () => {
    h.search = new URLSearchParams({ next: "/join/abc123" });
    mock().mockResolvedValue({ error: { message: "Nope" } });
    render(<Page />);
    await submit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Nope"));
    expect(h.push).not.toHaveBeenCalled();
  });

  it("keeps the destination when switching to the other page", () => {
    h.search = new URLSearchParams({ next: "/join/abc123" });
    render(<Page />);
    expect(screen.getByRole("link", { name: otherLabel }).getAttribute("href")).toBe(`${otherPath}?next=%2Fjoin%2Fabc123`);
  });

  it("doesn't add a destination to that link when there isn't one", () => {
    render(<Page />);
    expect(screen.getByRole("link", { name: otherLabel }).getAttribute("href")).toBe(otherPath);
  });

  it("doesn't carry a hostile destination across either", () => {
    h.search = new URLSearchParams({ next: "https://evil.example" });
    render(<Page />);
    expect(screen.getByRole("link", { name: otherLabel }).getAttribute("href")).toBe(`${otherPath}?next=%2Fdashboard`);
  });
});
