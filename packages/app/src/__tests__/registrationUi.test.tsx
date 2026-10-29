// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => {
  const state = {
    mine: null as unknown,
    mineLoading: false,
    mineOptions: undefined as undefined | { enabled?: boolean; refetchInterval?: number | false },
    calls: {} as Record<string, unknown[]>,
    errors: {} as Record<string, { message: string } | undefined>,
  };
  /** A mutation that records its input and succeeds at once, running onSuccess like the real one. */
  const mutationFor = (name: string) => (options?: { onSuccess?: () => unknown }) => ({
    mutate: vi.fn((input: unknown, callOptions?: { onSuccess?: () => unknown }) => {
      (state.calls[name] ??= []).push(input);
      void options?.onSuccess?.();
      void callOptions?.onSuccess?.();
    }),
    isPending: false,
    error: state.errors[name] ?? null,
  });
  return Object.assign(state, { mutationFor });
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("../lib/trpc", () => ({
  trpc: {
    registration: {
      mine: {
        useQuery: (_input: unknown, options: typeof h.mineOptions) => {
          h.mineOptions = options;
          return { data: h.mine, isLoading: h.mineLoading };
        },
      },
      register: { useMutation: h.mutationFor("register") },
      rename: { useMutation: h.mutationFor("rename") },
      withdraw: { useMutation: h.mutationFor("withdraw") },
      leave: { useMutation: h.mutationFor("leave") },
      rotateInvite: { useMutation: h.mutationFor("rotateInvite") },
    },
    event: { setRegistration: { useMutation: h.mutationFor("setRegistration") } },
  },
}));

import { RegisterTeamForm } from "../components/registration/RegisterTeamForm";
import { MyTeamPanel, type MyTeam } from "../components/registration/MyTeamPanel";
import { RegistrationPanel } from "../components/registration/RegistrationPanel";
import { OrganizerRegistrationControls } from "../components/registration/OrganizerRegistrationControls";
import { TeamsList, type TeamRow } from "../components/registration/TeamsList";
import { REGISTRATION_POLL_MS } from "../lib/pollInterval";
import { expectAccessible } from "./a11y";

const onChanged = vi.fn(async () => {});
const called = (name: string) => h.calls[name] ?? [];

const member = (id: string, name: string, role: "CAPTAIN" | "PLAYER" = "PLAYER") => ({ role, user: { id, name } });
const mineOf = (overrides: Partial<MyTeam> = {}, team: Partial<MyTeam["team"]> = {}): MyTeam => ({
  role: "CAPTAIN",
  inviteCode: "CODE-abc_123",
  team: {
    id: "tm1",
    name: "Kim",
    status: "REGISTERED",
    usesDefaultName: true,
    members: [member("u1", "Alex Kim", "CAPTAIN")],
    ...team,
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.mine = null;
  h.mineLoading = false;
  h.mineOptions = undefined;
  h.calls = {};
  h.errors = {};
});
afterEach(cleanup);

describe("RegisterTeamForm", () => {
  it("explains the optional name", () => {
    render(<RegisterTeamForm eventId="e1" onChanged={onChanged} />);
    expect(screen.getByLabelText(/Team name \(optional\)/)).toBeTruthy();
    expect(screen.getByText(/named after your last names, like Kim\/Lopez/)).toBeTruthy();
    expect((screen.getByLabelText(/Team name/) as HTMLInputElement).maxLength).toBe(60);
  });

  it("registers with no name when the box is blank, so the server generates one", async () => {
    render(<RegisterTeamForm eventId="e1" onChanged={onChanged} />);
    await userEvent.click(screen.getByRole("button", { name: "Register team" }));
    expect(called("register")).toEqual([{ eventId: "e1" }]);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("registers with the trimmed name, then clears the box", async () => {
    render(<RegisterTeamForm eventId="e1" onChanged={onChanged} />);
    const input = screen.getByLabelText(/Team name/) as HTMLInputElement;
    await userEvent.type(input, "  The Spikers ");
    await userEvent.click(screen.getByRole("button", { name: "Register team" }));
    expect(called("register")).toEqual([{ eventId: "e1", name: "The Spikers" }]);
    await waitFor(() => expect(input.value).toBe(""));
  });

  it("shows why registering failed", () => {
    h.errors.register = { message: "Registration isn't open for this event" };
    render(<RegisterTeamForm eventId="e1" onChanged={onChanged} />);
    expect(screen.getByRole("alert").textContent).toBe("Registration isn't open for this event");
  });

  it("has no accessibility violations, with or without an error", async () => {
    const first = render(<RegisterTeamForm eventId="e1" onChanged={onChanged} />);
    await expectAccessible(first.container);
    first.unmount();
    h.errors.register = { message: "Nope" };
    const second = render(<RegisterTeamForm eventId="e1" onChanged={onChanged} />);
    await expectAccessible(second.container);
  });
});

describe("MyTeamPanel", () => {
  const panel = (mine: MyTeam, props: { teamSize?: number; eventStatus?: string } = {}) =>
    render(<MyTeamPanel mine={mine} teamSize={props.teamSize ?? 2} eventStatus={props.eventStatus ?? "REGISTRATION"} onChanged={onChanged} />);

  describe("the roster", () => {
    it("shows the team, its status, who is on it, and who is captain", () => {
      panel(mineOf({}, { name: "Kim/Lopez", members: [member("u1", "Alex Kim", "CAPTAIN"), member("u2", "Sam Lopez")] }));
      expect(screen.getByText("Kim/Lopez")).toBeTruthy();
      expect(screen.getByText("Registered")).toBeTruthy();
      const players = within(screen.getByRole("list", { name: "Players" })).getAllByRole("listitem");
      expect(players.map((p) => p.textContent)).toEqual(["Alex KimCaptain", "Sam Lopez"]);
      expect(screen.getByText("Your team is full.")).toBeTruthy();
    });

    it.each([
      [2, 1, "Needs 1 more player."],
      [4, 1, "Needs 3 more players."],
      [4, 3, "Needs 1 more player."],
    ])("for a team of %i with %i player(s) says %s", (teamSize, players, message) => {
      const members = [member("u1", "Alex Kim", "CAPTAIN"), ...Array.from({ length: players - 1 }, (_, i) => member(`p${i}`, `Player ${i}`))];
      panel(mineOf({}, { members }), { teamSize });
      expect(screen.getByText(message)).toBeTruthy();
    });

    it("tells a waitlisted team it is waiting for a place", () => {
      panel(mineOf({}, { status: "WAITLISTED" }));
      expect(screen.getByText("Waitlisted")).toBeTruthy();
      expect(screen.getByText(/on the waitlist/)).toBeTruthy();
    });
  });

  describe("the invite link", () => {
    const writeText = vi.fn();
    beforeEach(() => {
      writeText.mockReset();
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    });

    it("shows the captain a link to share while there is room and registration is open", () => {
      panel(mineOf());
      const link = screen.getByLabelText(/Invite link/) as HTMLInputElement;
      expect(link.readOnly).toBe(true);
      expect(link.value).toMatch(/\/join\/CODE-abc_123$/);
      expect(link.value.startsWith("http")).toBe(true);
    });

    it.each([
      ["the team is full", mineOf({}, { members: [member("u1", "A", "CAPTAIN"), member("u2", "B")] }), "REGISTRATION"],
      ["registration is closed", mineOf(), "SEEDING"],
      ["the team has no code", mineOf({ inviteCode: null }), "REGISTRATION"],
    ])("is not shown when %s", (_label, mine, eventStatus) => {
      panel(mine, { eventStatus });
      expect(screen.queryByLabelText(/Invite link/)).toBeNull();
    });

    it("is not shown to a teammate, even if a code somehow reached them", () => {
      const first = panel(mineOf({ role: "PLAYER", inviteCode: null }));
      expect(screen.queryByLabelText(/Invite link/)).toBeNull();
      first.unmount();
      // The server never sends a teammate the code; the panel shouldn't rely on that.
      panel(mineOf({ role: "PLAYER", inviteCode: "LEAKED-code" }));
      expect(screen.queryByLabelText(/Invite link/)).toBeNull();
    });

    it("copies the link and says so", async () => {
      writeText.mockResolvedValue(undefined);
      panel(mineOf());
      await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
      expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/join\/CODE-abc_123$/));
      await waitFor(() => expect(screen.getByText("Link copied")).toBeTruthy());
    });

    it("selects the link for copying by hand when the clipboard is unavailable", async () => {
      writeText.mockRejectedValue(new Error("denied"));
      panel(mineOf());
      const link = screen.getByLabelText(/Invite link/) as HTMLInputElement;
      expect(link.selectionStart).toBe(link.selectionEnd); // nothing selected yet
      await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
      expect(screen.queryByText("Link copied")).toBeNull();
      // The whole link is selected, ready to copy by hand.
      expect(link.selectionStart).toBe(0);
      expect(link.selectionEnd).toBe(link.value.length);
    });

    it("gets a new link on request", async () => {
      panel(mineOf());
      await userEvent.click(screen.getByRole("button", { name: "Get a new link" }));
      expect(called("rotateInvite")).toEqual([{ teamId: "tm1" }]);
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });
  });

  describe("renaming", () => {
    it("shows a generated name as a placeholder, and only saves once something is typed", async () => {
      panel(mineOf());
      const input = screen.getByLabelText(/^Team name/) as HTMLInputElement;
      expect(input.value).toBe("");
      expect(input.placeholder).toBe("Kim");
      expect((screen.getByRole("button", { name: "Save name" }) as HTMLButtonElement).disabled).toBe(true);
      await userEvent.type(input, " Net Gains ");
      await userEvent.click(screen.getByRole("button", { name: "Save name" }));
      expect(called("rename")).toEqual([{ teamId: "tm1", name: "Net Gains" }]);
    });

    it("prefills a custom name, and can go back to the generated one", async () => {
      panel(mineOf({}, { name: "Net Gains", usesDefaultName: false }));
      expect((screen.getByLabelText(/^Team name/) as HTMLInputElement).value).toBe("Net Gains");
      await userEvent.click(screen.getByRole("button", { name: "Use the generated name" }));
      expect(called("rename")).toEqual([{ teamId: "tm1" }]);
    });

    it("is for the captain only", () => {
      panel(mineOf({ role: "PLAYER", inviteCode: null }));
      expect(screen.queryByLabelText(/^Team name/)).toBeNull();
    });

    it("is not offered once the bracket exists", () => {
      panel(mineOf(), { eventStatus: "IN_PROGRESS" });
      expect(screen.queryByLabelText(/^Team name/)).toBeNull();
    });
  });

  describe("withdrawing and leaving", () => {
    it("asks the captain before withdrawing, and Cancel backs out", async () => {
      panel(mineOf());
      await userEvent.click(screen.getByRole("button", { name: "Withdraw team" }));
      const confirm = screen.getByRole("group", { name: "Confirm: Withdraw team" });
      expect(within(confirm).getByText(/Everyone on it can register again/)).toBeTruthy();
      expect(called("withdraw")).toEqual([]);

      await userEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("group", { name: /Confirm/ })).toBeNull();
      expect(called("withdraw")).toEqual([]);

      await userEvent.click(screen.getByRole("button", { name: "Withdraw team" }));
      await userEvent.click(within(screen.getByRole("group", { name: /Confirm/ })).getByRole("button", { name: "Withdraw" }));
      expect(called("withdraw")).toEqual([{ teamId: "tm1" }]);
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it("lets a teammate leave, after asking, while registration is open", async () => {
      panel(mineOf({ role: "PLAYER", inviteCode: null }, { members: [member("u1", "Alex Kim", "CAPTAIN"), member("u2", "Sam Lopez")] }));
      expect(screen.queryByRole("button", { name: "Withdraw team" })).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Leave team" }));
      await userEvent.click(within(screen.getByRole("group", { name: /Confirm/ })).getByRole("button", { name: "Leave" }));
      expect(called("leave")).toEqual([{ teamId: "tm1" }]);
    });

    it("doesn't offer a teammate leaving once registration has closed", () => {
      panel(mineOf({ role: "PLAYER", inviteCode: null }), { eventStatus: "SEEDING" });
      expect(screen.queryByRole("button", { name: "Leave team" })).toBeNull();
    });

    it("keeps the captain's withdraw after registration closes, until the bracket", () => {
      const first = panel(mineOf(), { eventStatus: "SEEDING" });
      expect(screen.getByRole("button", { name: "Withdraw team" })).toBeTruthy();
      first.unmount();
      panel(mineOf(), { eventStatus: "IN_PROGRESS" });
      expect(screen.queryByRole("button", { name: "Withdraw team" })).toBeNull();
    });
  });

  it("shows the first error from any action", () => {
    h.errors.withdraw = { message: "The bracket has been made" };
    panel(mineOf());
    expect(screen.getByRole("alert").textContent).toBe("The bracket has been made");
  });

  it.each([
    ["a captain with room", mineOf()],
    ["a full team", mineOf({}, { members: [member("u1", "A", "CAPTAIN"), member("u2", "B")] })],
    ["a teammate", mineOf({ role: "PLAYER", inviteCode: null })],
    ["a waitlisted team", mineOf({}, { status: "WAITLISTED" })],
  ])("has no accessibility violations for %s", async (_label, mine) => {
    const { container } = panel(mine);
    await expectAccessible(container);
  });
});

describe("RegistrationPanel", () => {
  const panel = (props: { status?: string; signedIn?: boolean } = {}) =>
    render(<RegistrationPanel eventId="e1" event={{ status: props.status ?? "REGISTRATION", teamSize: 2 }} signedIn={props.signedIn ?? true} onChanged={onChanged} />);

  it("invites a signed-out visitor to sign in or sign up, and come back here", () => {
    panel({ signedIn: false });
    expect(screen.getByRole("heading", { name: "Register a team" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in?next=%2Fevent%2Fe1");
    expect(screen.getByRole("link", { name: "create an account" }).getAttribute("href")).toBe("/sign-up?next=%2Fevent%2Fe1");
  });

  it("offers the form to a signed-in person with no team", () => {
    panel();
    expect(screen.getByRole("button", { name: "Register team" })).toBeTruthy();
  });

  it("shows their team instead, once they have one", () => {
    h.mine = mineOf();
    panel();
    expect(screen.getByRole("heading", { name: "Your team" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register team" })).toBeNull();
  });

  it("waits while it checks whether they are on a team", () => {
    h.mineLoading = true;
    panel();
    expect(screen.getByRole("status").textContent).toBe("Checking your registration…");
    expect(screen.queryByRole("button", { name: "Register team" })).toBeNull();
  });

  it.each([
    ["DRAFT", "Registration hasn't opened yet."],
    ["SEEDING", "Registration is closed."],
  ])("says so when the event is %s", (status, message) => {
    panel({ status });
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register team" })).toBeNull();
  });

  it("says registration is closed to a signed-out visitor too, without asking them to sign in", () => {
    panel({ status: "SEEDING", signedIn: false });
    expect(screen.getByText("Registration is closed.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("still shows a team after registration closes", () => {
    h.mine = mineOf();
    panel({ status: "SEEDING" });
    expect(screen.getByRole("heading", { name: "Your team" })).toBeTruthy();
  });

  it("only asks who they are when signed in, and keeps the answer fresh while registration is open", () => {
    panel({ signedIn: false });
    expect(h.mineOptions?.enabled).toBe(false);
    cleanup();
    panel();
    expect(h.mineOptions).toMatchObject({ enabled: true, refetchInterval: REGISTRATION_POLL_MS });
    cleanup();
    panel({ status: "DRAFT" });
    expect(h.mineOptions?.refetchInterval).toBe(false);
  });

  it.each([
    ["signed out", { signedIn: false }],
    ["signed in with no team", {}],
    ["closed", { status: "SEEDING" }],
  ])("has no accessibility violations when %s", async (_label, props) => {
    const { container } = panel(props);
    await expectAccessible(container);
  });
});

describe("OrganizerRegistrationControls", () => {
  const controls = (status: string) => render(<OrganizerRegistrationControls eventId="e1" status={status} onChanged={onChanged} />);

  it.each([
    ["DRAFT", "Open registration", true],
    ["REGISTRATION", "Close registration", false],
    ["SEEDING", "Reopen registration", true],
  ])("for a %s event offers to %s", async (status, label, open) => {
    controls(status);
    await userEvent.click(screen.getByRole("button", { name: label }));
    expect(called("setRegistration")).toEqual([{ id: "e1", open }]);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("says where registration stands", () => {
    controls("REGISTRATION");
    expect(screen.getByText("Registration is open.")).toBeTruthy();
  });

  it.each(["IN_PROGRESS", "COMPLETED"])("has nothing to offer once the event is %s", (status) => {
    const { container } = controls(status);
    expect(container.textContent).toBe("");
  });

  it("shows why a change was refused", () => {
    h.errors.setRegistration = { message: "The bracket has been made" };
    controls("REGISTRATION");
    expect(screen.getByRole("alert").textContent).toBe("The bracket has been made");
  });

  it("has no accessibility violations", async () => {
    const { container } = controls("DRAFT");
    await expectAccessible(container);
  });
});

describe("TeamsList", () => {
  const team = (id: string, name: string, extra: Partial<TeamRow> = {}): TeamRow => ({ id, name, status: "REGISTERED", members: [], ...extra });
  const list = (teams: TeamRow[], props: { isOwner?: boolean; teamSize?: number } = {}) => {
    const onRemove = vi.fn();
    const view = render(<TeamsList teams={teams} teamSize={props.teamSize ?? 2} isOwner={props.isOwner ?? false} onRemove={onRemove} />);
    return { ...view, onRemove };
  };

  it("says when there are no teams, differently for the organizer", () => {
    const first = list([]);
    expect(screen.getByText("No teams have signed up yet.")).toBeTruthy();
    first.unmount();
    list([], { isOwner: true });
    expect(screen.getByText(/Teams can register themselves, or you can add them/)).toBeTruthy();
  });

  it("lists teams in order with who is on each", () => {
    list([team("a", "Kim/Lopez", { members: [member("u1", "Alex Kim", "CAPTAIN"), member("u2", "Sam Lopez")] }), team("b", "Walk-ups")]);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("Kim/Lopez")).toBeTruthy();
    expect(within(items[0]!).getByText("Alex Kim, Sam Lopez")).toBeTruthy();
    expect(within(items[1]!).getByText("Walk-ups")).toBeTruthy();
  });

  it("flags a team that still needs players", () => {
    list([team("a", "Kim", { members: [member("u1", "Alex Kim", "CAPTAIN")] })], { teamSize: 4 });
    expect(screen.getByText("Needs 3 more players")).toBeTruthy();
  });

  it("doesn't chase a full team, a withdrawn one, or one an organizer added by hand", () => {
    list([
      team("a", "Full", { members: [member("u1", "A", "CAPTAIN"), member("u2", "B")] }),
      team("b", "Gone", { status: "WITHDRAWN", members: [member("u3", "C", "CAPTAIN")] }),
      team("c", "By hand"),
    ]);
    expect(screen.queryByText(/Needs \d more/)).toBeNull();
  });

  it("marks waitlisted and withdrawn teams", () => {
    list([team("a", "Waiting", { status: "WAITLISTED" }), team("b", "Gone", { status: "WITHDRAWN" })]);
    expect(screen.getByText("Waitlisted")).toBeTruthy();
    expect(screen.getByText("Withdrawn")).toBeTruthy();
  });

  it("lets only the organizer remove a team", async () => {
    const visitor = list([team("a", "Spikers")]);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    visitor.unmount();
    const owner = list([team("a", "Spikers")], { isOwner: true });
    await userEvent.click(screen.getByRole("button", { name: "Remove Spikers" }));
    expect(owner.onRemove).toHaveBeenCalledWith("a");
  });

  it("has no accessibility violations", async () => {
    const { container } = list(
      [team("a", "Kim", { members: [member("u1", "Alex Kim", "CAPTAIN")] }), team("b", "Waiting", { status: "WAITLISTED" }), team("c", "Walk-ups")],
      { isOwner: true }
    );
    await expectAccessible(container);
  });
});
