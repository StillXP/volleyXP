// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const h = vi.hoisted(() => ({
  state: {} as { data: unknown; isLoading: boolean; error: unknown },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("../lib/trpc", () => ({
  trpc: { tournament: { listPublic: { useQuery: () => h.state } } },
}));

import HomePage, { metadata } from "../app/page";
import { expectAccessible } from "./a11y";

const tournament = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `t${n}`,
  name: `Tournament ${n}`,
  status: "REGISTRATION",
  startDate: null,
  owner: { id: "o", name: "Alex Kim" },
  location: null,
  _count: { events: 2 },
  ...overrides,
});

beforeEach(() => {
  h.state = {
    data: [
      tournament(1),
      tournament(2, { status: "IN_PROGRESS", _count: { events: 1 }, location: { name: "Riverside Park" }, startDate: "2029-06-01T12:00:00.000Z" }),
    ],
    isLoading: false,
    error: null,
  };
});
afterEach(cleanup);

describe("home page", () => {
  it("says what Volley is and offers the bracket generator", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Volley" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Try the bracket generator" }).getAttribute("href")).toBe("/create");
  });

  it("has its own title and description", () => {
    expect(String(metadata.title)).toContain("Volley");
    expect(metadata.description).toBeTruthy();
  });

  it("lists the open tournaments as links, with their status and details", () => {
    render(<HomePage />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole("link", { name: "Tournament 1" }).getAttribute("href")).toBe("/tournament/t1");
    expect(within(items[0]!).getByText("Registration")).toBeTruthy();
    expect(within(items[0]!).getByText("2 events · Hosted by Alex Kim")).toBeTruthy();
    expect(within(items[1]!).getByText("In progress")).toBeTruthy();
    expect(within(items[1]!).getByText(/^1 event · Riverside Park · .*2029 · Hosted by Alex Kim$/)).toBeTruthy();
  });

  it("invites the first organizer when there are no tournaments", () => {
    h.state.data = [];
    render(<HomePage />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText(/No tournaments are open yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/sign-up");
  });

  it("says when it is loading, and when the list could not be loaded", () => {
    h.state = { data: undefined, isLoading: true, error: null };
    const first = render(<HomePage />);
    expect(screen.getByRole("status").textContent).toBe("Loading tournaments…");
    first.unmount();
    h.state = { data: undefined, isLoading: false, error: new Error("boom") };
    render(<HomePage />);
    expect(screen.getByRole("alert").textContent).toContain("couldn't be loaded");
  });
});

describe("home page accessibility", () => {
  it.each([
    ["with tournaments", {}],
    ["with none", { data: [] }],
    ["while loading", { data: undefined, isLoading: true }],
    ["after an error", { data: undefined, error: new Error("boom") }],
  ])("has no violations %s", async (_label, overrides) => {
    h.state = { ...h.state, ...overrides };
    const { container } = render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await expectAccessible(container);
  });
});
