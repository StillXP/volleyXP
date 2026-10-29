import { describe, expect, it, vi } from "vitest";

// The real client opens a connection pool on import; the tests inject a fake instead.
vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { appRouter } from "../root";
import { createCallerFactory, type Context } from "../trpc";
import { ownedFindFirst } from "./helpers";

const OWNER = "user-owner";
const STRANGER = "user-stranger";

// Row id -> owner of the tournament it belongs to.
const ownerOf: Record<string, string> = { t1: OWNER, e1: OWNER, s1: OWNER, s2: OWNER, p1: OWNER };

function setup(userId: string | null) {
  const prisma = {
    tournament: { findFirst: ownedFindFirst(ownerOf) },
    event: {
      findFirst: ownedFindFirst(ownerOf),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    stage: {
      findFirst: ownedFindFirst(ownerOf, () => ({ type: "POOL_PLAY", eventId: "e1" })),
      findMany: vi.fn(async () => [{ id: "s1" }, { id: "s2" }]),
      aggregate: vi.fn(async () => ({ _max: { order: 2 as number | null } })),
      create: vi.fn(async () => ({})),
      update: vi.fn(async (_args: unknown) => ({})),
      delete: vi.fn(async () => ({})),
    },
    pool: {
      findFirst: ownedFindFirst(ownerOf, () => ({ stageId: "s1" })),
      count: vi.fn(async () => 0),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    poolTeam: {
      count: vi.fn(async (_args: unknown) => 0),
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({})),
    },
    team: { count: vi.fn(async (_args: unknown) => 1) },
    court: { count: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.length) },
    eventCourt: {
      createMany: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
    },
    match: { count: vi.fn(async () => 0) },
    game: { count: vi.fn(async () => 0) },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const caller = createCallerFactory(appRouter)({ prisma, userId } as unknown as Context);
  return { prisma, caller };
}

type Caller = ReturnType<typeof setup>["caller"];
type Prisma = ReturnType<typeof setup>["prisma"];

const event = { name: "Mixed Doubles", teamSize: 2 };

// Every mutation, with a write it must guard.
const guarded: { name: string; call: (c: Caller) => Promise<unknown>; write: (p: Prisma) => unknown }[] = [
  { name: "event.create", call: (c) => c.event.create({ tournamentId: "t1", ...event }), write: (p) => p.event.create },
  { name: "event.update", call: (c) => c.event.update({ id: "e1", name: "Renamed" }), write: (p) => p.event.update },
  { name: "event.delete", call: (c) => c.event.delete({ id: "e1" }), write: (p) => p.event.delete },
  { name: "event.setCourts", call: (c) => c.event.setCourts({ eventId: "e1", courtIds: ["c1"] }), write: (p) => p.eventCourt.createMany },
  { name: "stage.create", call: (c) => c.stage.create({ eventId: "e1", name: "Pools", type: "POOL_PLAY" }), write: (p) => p.stage.create },
  { name: "stage.update", call: (c) => c.stage.update({ id: "s1", name: "Renamed" }), write: (p) => p.stage.update },
  { name: "stage.delete", call: (c) => c.stage.delete({ id: "s1" }), write: (p) => p.stage.delete },
  { name: "stage.reorder", call: (c) => c.stage.reorder({ eventId: "e1", stageIds: ["s2", "s1"] }), write: (p) => p.stage.update },
  { name: "pool.create", call: (c) => c.pool.create({ stageId: "s1", name: "Pool A" }), write: (p) => p.pool.create },
  { name: "pool.rename", call: (c) => c.pool.rename({ id: "p1", name: "Pool B" }), write: (p) => p.pool.update },
  { name: "pool.delete", call: (c) => c.pool.delete({ id: "p1" }), write: (p) => p.pool.delete },
  { name: "pool.assignTeam", call: (c) => c.pool.assignTeam({ poolId: "p1", teamId: "tm1" }), write: (p) => p.poolTeam.upsert },
  { name: "pool.removeTeam", call: (c) => c.pool.removeTeam({ poolId: "p1", teamId: "tm1" }), write: (p) => p.poolTeam.deleteMany },
];

describe.each(guarded)("$name", ({ call, write }) => {
  it("rejects signed-out callers", async () => {
    const { caller, prisma } = setup(null);
    await expect(call(caller)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(write(prisma)).not.toHaveBeenCalled();
  });

  it("rejects callers who don't own the tournament", async () => {
    const { caller, prisma } = setup(STRANGER);
    await expect(call(caller)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(write(prisma)).not.toHaveBeenCalled();
  });

  it("lets the owner through", async () => {
    const { caller, prisma } = setup(OWNER);
    await call(caller);
    expect(write(prisma)).toHaveBeenCalled();
  });
});

describe("event", () => {
  it("rejects an even best-of", async () => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.event.create({ tournamentId: "t1", ...event, bestOf: 2 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it("accepts an odd best-of", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.create({ tournamentId: "t1", ...event, bestOf: 3 });
    expect(prisma.event.create).toHaveBeenCalledOnce();
  });

  it("lets update clear the entry cap with null", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.update({ id: "e1", entryCap: null });
    expect(prisma.event.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { entryCap: null } });
  });

  it("won't delete an event that has recorded games", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.game.count.mockResolvedValue(3);
    await expect(caller.event.delete({ id: "e1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.event.delete).not.toHaveBeenCalled();
  });
});

describe("event.setCourts", () => {
  it("only accepts fixed courts at a venue the caller owns, counting each once", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.setCourts({ eventId: "e1", courtIds: ["c1", "c1", "c2"] });
    expect(prisma.court.count).toHaveBeenCalledWith({ where: { id: { in: ["c1", "c2"] }, location: { ownerId: OWNER } } });
  });

  it("rejects courts from someone else's venue", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.court.count.mockResolvedValue(1);
    await expect(caller.event.setCourts({ eventId: "e1", courtIds: ["c1", "c-elsewhere"] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("won't drop a court that already has matches", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.match.count.mockResolvedValue(1);
    await expect(caller.event.setCourts({ eventId: "e1", courtIds: ["c1"] })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("leaves temporary courts alone when removing", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.event.setCourts({ eventId: "e1", courtIds: ["c1"] });
    expect(prisma.eventCourt.deleteMany).toHaveBeenCalledWith({
      where: { eventId: "e1", court: { locationId: { not: null } }, courtId: { notIn: ["c1"] } },
    });
  });
});

describe("stage", () => {
  it("appends a new stage after the last one", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.stage.create({ eventId: "e1", name: "Bracket", type: "SINGLE_ELIM" });
    expect(prisma.stage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ order: 3 }) });
  });

  it("starts the first stage at order 1", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.stage.aggregate.mockResolvedValue({ _max: { order: null } });
    await caller.stage.create({ eventId: "e1", name: "Pools", type: "POOL_PLAY" });
    expect(prisma.stage.create).toHaveBeenCalledWith({ data: expect.objectContaining({ order: 1 }) });
  });

  it("won't change the format of a stage that has matches", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.match.count.mockResolvedValue(1);
    await expect(caller.stage.update({ id: "s1", type: "SINGLE_ELIM" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.stage.update).not.toHaveBeenCalled();
  });

  it("won't switch to a bracket while the stage still has pools", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.pool.count.mockResolvedValue(2);
    await expect(caller.stage.update({ id: "s1", type: "DOUBLE_ELIM" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.stage.update).not.toHaveBeenCalled();
  });

  it("allows switching between pool-play formats", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.pool.count.mockResolvedValue(2);
    await caller.stage.update({ id: "s1", type: "ROUND_ROBIN" });
    expect(prisma.stage.update).toHaveBeenCalledOnce();
  });

  it("skips the format checks when the type isn't changing", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.stage.update({ id: "s1", name: "Renamed", type: "POOL_PLAY" });
    expect(prisma.match.count).not.toHaveBeenCalled();
  });

  it("won't delete a stage that has recorded games", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.game.count.mockResolvedValue(1);
    await expect(caller.stage.delete({ id: "s1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.stage.delete).not.toHaveBeenCalled();
  });
});

describe("stage.reorder", () => {
  it.each([
    ["omits a stage", ["s1"]],
    ["repeats a stage", ["s1", "s1"]],
    ["includes a stage from another event", ["s1", "s-elsewhere"]],
  ])("rejects a list that %s", async (_label, stageIds) => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.stage.reorder({ eventId: "e1", stageIds })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("parks stages on negative orders before assigning the final ones", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.stage.reorder({ eventId: "e1", stageIds: ["s2", "s1"] });
    const calls = prisma.stage.update.mock.calls.map(([arg]) => arg as { where: { id: string }; data: { order: number } });
    expect(calls.map((c) => [c.where.id, c.data.order])).toEqual([
      ["s2", -1],
      ["s1", -2],
      ["s2", 1],
      ["s1", 2],
    ]);
  });
});

describe("pool", () => {
  it("only creates pools on pool-play and round-robin stages", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.stage.findFirst.mockResolvedValue({ id: "s1", type: "SINGLE_ELIM", eventId: "e1" });
    await expect(caller.pool.create({ stageId: "s1", name: "Pool A" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.pool.create).not.toHaveBeenCalled();
  });

  it("won't delete a pool that has matches", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.match.count.mockResolvedValue(1);
    await expect(caller.pool.delete({ id: "p1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.pool.delete).not.toHaveBeenCalled();
  });
});

describe("pool.assignTeam", () => {
  it("only accepts a team from the stage's event", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.pool.assignTeam({ poolId: "p1", teamId: "tm1" });
    expect(prisma.team.count).toHaveBeenCalledWith({ where: { id: "tm1", event: { stages: { some: { id: "s1" } } } } });
  });

  it("rejects a team from another event", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.team.count.mockResolvedValue(0);
    await expect(caller.pool.assignTeam({ poolId: "p1", teamId: "tm-elsewhere" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.poolTeam.upsert).not.toHaveBeenCalled();
  });

  it("rejects a team that's already in another pool of the stage", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.poolTeam.count.mockResolvedValue(1);
    await expect(caller.pool.assignTeam({ poolId: "p1", teamId: "tm1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.poolTeam.count).toHaveBeenCalledWith({
      where: { teamId: "tm1", poolId: { not: "p1" }, pool: { stageId: "s1" } },
    });
    expect(prisma.poolTeam.upsert).not.toHaveBeenCalled();
  });

  it("updates the seed when the team is already in the pool", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.pool.assignTeam({ poolId: "p1", teamId: "tm1", seed: 2 });
    expect(prisma.poolTeam.upsert).toHaveBeenCalledWith({
      where: { poolId_teamId: { poolId: "p1", teamId: "tm1" } },
      update: { seed: 2 },
      create: { poolId: "p1", teamId: "tm1", seed: 2 },
    });
  });
});

describe("pool.removeTeam", () => {
  it("won't remove a team that has played in the pool", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.match.count.mockResolvedValue(1);
    await expect(caller.pool.removeTeam({ poolId: "p1", teamId: "tm1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.poolTeam.deleteMany).not.toHaveBeenCalled();
  });
});
