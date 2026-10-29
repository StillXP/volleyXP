import { describe, expect, it, vi } from "vitest";

// The real client opens a connection pool on import; the tests inject a fake instead.
vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { appRouter } from "../root";
import { createCallerFactory, type Context } from "../trpc";
import { ownedFindFirst } from "./helpers";

const OWNER = "user-owner";
const STRANGER = "user-stranger";

type Row = Record<string, unknown>;

function setup(userId: string | null) {
  // The transaction callback gets the same fake as its client.
  const tx: { client: unknown } = { client: null };
  const prisma = {
    tournament: {
      findFirst: ownedFindFirst({ t1: OWNER }),
      create: vi.fn(async (_args: unknown) => ({ id: "new-tournament" })),
      updateMany: vi.fn(async (_args: unknown) => ({ count: 1 })),
    },
    event: { create: vi.fn(async (_args: unknown) => ({ id: "new-event" })) },
    team: { createMany: vi.fn(async (_args: { data: Row[] }) => ({})) },
    stage: { create: vi.fn(async (_args: { data: Row }) => ({ id: "new-stage" })) },
    match: { createMany: vi.fn(async (_args: { data: Row[] }) => ({})) },
    court: { createMany: vi.fn(async (_args: { data: Row[] }) => ({})) },
    eventCourt: { createMany: vi.fn(async (_args: { data: Row[] }) => ({})) },
    $transaction: vi.fn(async (run: (client: unknown) => Promise<unknown>) => run(tx.client)),
  };
  tx.client = prisma;
  const caller = createCallerFactory(appRouter)({ prisma, userId } as unknown as Context);
  return { prisma, caller };
}

const names = (n: number) => Array.from({ length: n }, (_, i) => `Team ${i + 1}`);
const base = { event: { name: "Doubles" }, teams: names(8), format: "single" as const };
const inNewTournament = { ...base, tournamentName: "Summer Open" };

const written = (p: ReturnType<typeof setup>["prisma"]) => [
  p.tournament.create, p.event.create, p.team.createMany, p.stage.create, p.match.createMany, p.court.createMany, p.eventCourt.createMany,
];

describe("event.createWithBracket access", () => {
  it("rejects signed-out callers", async () => {
    const { caller, prisma } = setup(null);
    await expect(caller.event.createWithBracket(inNewTournament)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects adding to a tournament the caller doesn't own", async () => {
    const { caller, prisma } = setup(STRANGER);
    await expect(caller.event.createWithBracket({ ...base, tournamentId: "t1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("adds to the owner's existing tournament without creating one", async () => {
    const { caller, prisma } = setup(OWNER);
    const result = await caller.event.createWithBracket({ ...base, tournamentId: "t1" });
    expect(prisma.tournament.create).not.toHaveBeenCalled();
    expect(prisma.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tournamentId: "t1" }) });
    expect(result).toEqual({ tournamentId: "t1", eventId: "new-event", stageId: "new-stage" });
  });

  it("creates a new tournament owned by the caller when given a name", async () => {
    const { caller, prisma } = setup(OWNER);
    const result = await caller.event.createWithBracket(inNewTournament);
    expect(prisma.tournament.create).toHaveBeenCalledWith({ data: { name: "Summer Open", ownerId: OWNER } });
    expect(result.tournamentId).toBe("new-tournament");
  });
});

describe("event.createWithBracket validation", () => {
  it.each([
    ["neither a tournament id nor a name", base],
    ["both a tournament id and a name", { ...base, tournamentId: "t1", tournamentName: "Both" }],
    ["a blank tournament name", { ...base, tournamentName: "   " }],
    ["one team", { ...inNewTournament, teams: names(1) }],
    ["65 teams", { ...inNewTournament, teams: names(65) }],
    ["a blank team name", { ...inNewTournament, teams: ["A", "  "] }],
    ["an even best-of", { ...inNewTournament, event: { name: "Doubles", bestOf: 2 } }],
    ["an unknown format", { ...inNewTournament, format: "round-robin" }],
    ["65 nets", { ...inNewTournament, nets: 65 }],
  ])("rejects %s", async (_label, input) => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.event.createWithBracket(input as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects more teams than the entry cap", async () => {
    const { caller, prisma } = setup(OWNER);
    await expect(
      caller.event.createWithBracket({ ...inNewTournament, event: { name: "Doubles", entryCap: 4 } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("defaults the team size to doubles", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.createWithBracket(inNewTournament);
    expect(prisma.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ teamSize: 2 }) });
  });

  it("starts the event straight away, since its bracket is already made", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.createWithBracket(inNewTournament);
    expect(prisma.event.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "IN_PROGRESS" }) });
  });

  it("starts the tournament with its bracket, a new one or an existing one", async () => {
    const fresh = setup(OWNER);
    await fresh.caller.event.createWithBracket(inNewTournament);
    expect(fresh.prisma.tournament.updateMany).toHaveBeenCalledWith({
      where: { id: "new-tournament", status: { in: ["DRAFT", "REGISTRATION"] } },
      data: { status: "IN_PROGRESS" },
    });
    const existing = setup(OWNER);
    await existing.caller.event.createWithBracket({ ...base, tournamentId: "t1" });
    expect(existing.prisma.tournament.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "t1" }) })
    );
  });

  it("trims team names", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.createWithBracket({ ...inNewTournament, teams: ["  Spikers ", "Setters"] });
    expect(prisma.team.createMany.mock.calls[0]![0].data.map((t) => t.name)).toEqual(["Spikers", "Setters"]);
  });
});

describe("event.createWithBracket writes", () => {
  it("does every write inside one transaction", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.createWithBracket({ ...inNewTournament, nets: 2 });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(written(prisma).every((w) => w.mock.calls.length > 0)).toBe(true);
  });

  it("seeds teams in the order given", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.createWithBracket(inNewTournament);
    const rows = prisma.team.createMany.mock.calls[0]![0].data;
    expect(rows.map((t) => [t.name, t.seed, t.eventId])).toEqual(names(8).map((n, i) => [n, i + 1, "new-event"]));
  });

  it.each([
    ["single", "SINGLE_ELIM", 7],
    ["double", "DOUBLE_ELIM", 14],
  ] as const)("builds a %s-elimination stage with %i matches for 8 teams", async (format, type, count) => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.createWithBracket({ ...inNewTournament, format });
    expect(prisma.stage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventId: "new-event", order: 1, type }) });
    const matches = prisma.match.createMany.mock.calls[0]![0].data;
    expect(matches).toHaveLength(count);
    expect(matches.every((m) => m.stageId === "new-stage")).toBe(true);
  });

  it("points matches at real teams and at each other, with the slot each result fills", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.createWithBracket({ ...inNewTournament, format: "double" });
    const teamIds = new Set(prisma.team.createMany.mock.calls[0]![0].data.map((t) => t.id));
    const matches = prisma.match.createMany.mock.calls[0]![0].data;
    const ids = new Set(matches.map((m) => m.id));
    for (const m of matches) {
      for (const team of [m.team1Id, m.team2Id]) if (team) expect(teamIds.has(team)).toBe(true);
      for (const kind of ["Winner", "Loser"] as const) {
        const next = m[`next${kind}MatchId`];
        const slot = m[`next${kind}Slot`];
        expect(next === null).toBe(slot === null);
        if (next) {
          expect(ids.has(next as string)).toBe(true);
          expect([1, 2]).toContain(slot);
        }
      }
    }
    // The grand final is the only match whose winner goes nowhere.
    expect(matches.filter((m) => m.nextWinnerMatchId === null).map((m) => m.bracketKey)).toEqual(["gf-m1"]);
  });

  it("stores the bracket key and round used by the Bracket component", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.createWithBracket(inNewTournament);
    const matches = prisma.match.createMany.mock.calls[0]![0].data;
    expect(matches.slice(0, 4).map((m) => [m.bracketKey, m.bracketRound, m.bracketPosition])).toEqual([
      ["r1-m1", "Quarterfinal", 0],
      ["r1-m2", "Quarterfinal", 1],
      ["r1-m3", "Quarterfinal", 2],
      ["r1-m4", "Quarterfinal", 3],
    ]);
  });

  it("creates temporary courts and allocates each to the event", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.createWithBracket({ ...inNewTournament, nets: 3 });
    const courts = prisma.court.createMany.mock.calls[0]![0].data;
    expect(courts.map((c) => [c.name, c.eventId])).toEqual([["Net 1", "new-event"], ["Net 2", "new-event"], ["Net 3", "new-event"]]);
    const allocated = prisma.eventCourt.createMany.mock.calls[0]![0].data;
    expect(allocated.map((a) => a.courtId)).toEqual(courts.map((c) => c.id));
  });

  it("creates no courts when none are asked for", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.createWithBracket(inNewTournament);
    expect(prisma.court.createMany).not.toHaveBeenCalled();
  });

  it("surfaces a failure partway through instead of returning a result", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.match.createMany.mockRejectedValue(new Error("boom"));
    await expect(caller.event.createWithBracket(inNewTournament)).rejects.toThrow("boom");
  });
});
