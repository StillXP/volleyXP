import { describe, expect, it, vi } from "vitest";

// The real client opens a connection pool on import; the tests inject a fake instead.
vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { appRouter } from "../root";
import { createCallerFactory, type Context } from "../trpc";
import { ownedFindFirst } from "./helpers";

const OWNER = "user-owner";
const STRANGER = "user-stranger";

type Row = Record<string, unknown>;
type TeamRow = { id: string; name: string; seed: number | null };

const teamsOf = (...seeds: (number | null)[]): TeamRow[] => seeds.map((seed, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, seed }));

function setup(userId: string | null, teams: TeamRow[] = teamsOf(1, 2, 3, 4)) {
  // The transaction callback gets the same fake as its client.
  const tx: { client: unknown } = { client: null };
  const prisma = {
    event: { findFirst: ownedFindFirst({ e1: OWNER }), update: vi.fn(async (_args: unknown) => ({})) },
    stage: {
      findFirst: vi.fn(async (_args: unknown): Promise<Row | null> => null),
      aggregate: vi.fn(async (_args: unknown) => ({ _max: { order: null as number | null } })),
      create: vi.fn(async (_args: { data: Row }) => ({ id: "new-stage" })),
    },
    team: {
      findMany: vi.fn(async (_args: unknown) => teams),
      update: vi.fn(async (_args: { where: { id: string }; data: { seed: number } }) => ({})),
    },
    match: { createMany: vi.fn(async (_args: { data: Row[] }) => ({})) },
    $transaction: vi.fn(async (run: (client: unknown) => Promise<unknown>) => run(tx.client)),
  };
  tx.client = prisma;
  const caller = createCallerFactory(appRouter)({ prisma, userId } as unknown as Context);
  return { prisma, caller };
}

const input = { eventId: "e1", format: "single" as const };

describe("event.generateBracket access", () => {
  it("rejects signed-out callers", async () => {
    const { caller, prisma } = setup(null);
    await expect(caller.event.generateBracket(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects callers who don't own the event", async () => {
    const { caller, prisma } = setup(STRANGER);
    await expect(caller.event.generateBracket(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("lets the owner through", async () => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.event.generateBracket(input)).resolves.toEqual({ stageId: "new-stage" });
    expect(prisma.match.createMany).toHaveBeenCalledOnce();
  });
});

describe("event.generateBracket rules", () => {
  it("refuses when the event already has a bracket, looking only at elimination stages", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.stage.findFirst.mockResolvedValue({ id: "old" });
    await expect(caller.event.generateBracket(input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.stage.findFirst).toHaveBeenCalledWith({
      where: { eventId: "e1", type: { in: ["SINGLE_ELIM", "DOUBLE_ELIM"] } },
      select: { id: true },
    });
    expect(prisma.stage.create).not.toHaveBeenCalled();
  });

  it.each([0, 1, 65])("rejects %i teams", async (count) => {
    const { caller, prisma } = setup(OWNER, teamsOf(...Array<number | null>(count).fill(null)));
    await expect(caller.event.generateBracket(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.stage.create).not.toHaveBeenCalled();
  });

  it("only seeds registered and checked-in teams, by seed with unseeded last, then oldest first", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.generateBracket(input);
    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: { eventId: "e1", status: { in: ["REGISTERED", "CHECKED_IN"] } },
      orderBy: [{ seed: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    });
  });

  it("renumbers seeds to 1..N, updating only the teams whose seed changes", async () => {
    // Already ordered as findMany returns them: seeds 2 and 5, then two unseeded.
    const { caller, prisma } = setup(OWNER, teamsOf(2, 5, null, null));
    await caller.event.generateBracket(input);
    expect(prisma.team.update.mock.calls.map(([a]) => [a.where.id, a.data.seed])).toEqual([
      ["t1", 1],
      ["t2", 2],
      ["t3", 3],
      ["t4", 4],
    ]);
  });

  it("leaves seeds alone when they are already 1..N", async () => {
    const { caller, prisma } = setup(OWNER, teamsOf(1, 2, 3, 4));
    await caller.event.generateBracket(input);
    expect(prisma.team.update).not.toHaveBeenCalled();
  });
});

describe("event.generateBracket writes", () => {
  it("makes the bracket the first stage of an event with none", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.generateBracket(input);
    expect(prisma.stage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventId: "e1", order: 1, type: "SINGLE_ELIM" }) });
  });

  it("puts the bracket after the event's existing stages", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.stage.aggregate.mockResolvedValue({ _max: { order: 1 } });
    await caller.event.generateBracket({ ...input, format: "double" });
    expect(prisma.stage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ order: 2, type: "DOUBLE_ELIM" }) });
  });

  it.each([
    ["single", 3],
    ["double", 6],
  ] as const)("stores a %s bracket of %i matches for 4 teams", async (format, count) => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.generateBracket({ eventId: "e1", format });
    expect(prisma.match.createMany.mock.calls[0]![0].data).toHaveLength(count);
  });

  it("starts the event, which closes registration for good", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.generateBracket(input);
    expect(prisma.event.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { status: "IN_PROGRESS" } });
  });

  it("doesn't touch the event if the bracket can't be made", async () => {
    const { caller, prisma } = setup(OWNER, teamsOf(1));
    await expect(caller.event.generateBracket(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it("puts the event's own teams into the first-round matches", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.generateBracket(input);
    const first = prisma.match.createMany.mock.calls[0]![0].data.filter((m) => (m.bracketKey as string).startsWith("r1-"));
    expect(first.map((m) => [m.team1Id, m.team2Id])).toEqual([["t1", "t4"], ["t2", "t3"]]);
  });
});
