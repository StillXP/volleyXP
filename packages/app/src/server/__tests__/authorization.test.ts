import { describe, expect, it, vi } from "vitest";

// The real client opens a connection pool on import; the tests inject a fake instead.
vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { appRouter } from "../root";
import { createCallerFactory, type Context } from "../trpc";

const OWNER = "user-owner";
const STRANGER = "user-stranger";

// Row id -> owner of the tournament it belongs to.
const ownerOf: Record<string, string> = {
  t1: OWNER,
  e1: OWNER,
  s1: OWNER,
  tm1: OWNER,
  tm2: OWNER,
  m1: OWNER,
  m2: OWNER,
};

const matches: Record<string, { team1Id: string | null; team2Id: string | null }> = {
  m1: { team1Id: "tm1", team2Id: "tm2" },
  m2: { team1Id: "tm1", team2Id: null },
};

/** Finds the ownerId the ownership helpers filter on, wherever it is nested. */
function ownerInWhere(where: unknown): string | undefined {
  if (!where || typeof where !== "object") return undefined;
  for (const [key, value] of Object.entries(where)) {
    if (key === "ownerId") return value as string;
    const nested = ownerInWhere(value);
    if (nested) return nested;
  }
  return undefined;
}

function findFirst(extra: (id: string) => object = () => ({})) {
  return vi.fn(async ({ where }: { where: { id: string } }) =>
    ownerOf[where.id] && ownerOf[where.id] === ownerInWhere(where) ? { id: where.id, ...extra(where.id) } : null
  );
}

function setup(userId: string | null) {
  const prisma = {
    tournament: { findFirst: findFirst(), update: vi.fn(async () => ({})), delete: vi.fn(async () => ({})), findMany: vi.fn(async () => []) },
    event: { findFirst: findFirst() },
    stage: { findFirst: findFirst() },
    team: {
      findFirst: findFirst(),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
      count: vi.fn(async () => 2),
    },
    match: {
      findFirst: findFirst((id) => matches[id] ?? { team1Id: null, team2Id: null }),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    game: { upsert: vi.fn(async () => ({})) },
    pool: { count: vi.fn(async () => 1) },
    // By default every requested team is in the pool.
    poolTeam: { count: vi.fn(async ({ where }: { where: { teamId: { in: string[] } } }) => where.teamId.in.length) },
    eventCourt: { count: vi.fn(async () => 1) },
  };
  const caller = createCallerFactory(appRouter)({ prisma, userId } as unknown as Context);
  return { prisma, caller };
}

type Caller = ReturnType<typeof setup>["caller"];
type Prisma = ReturnType<typeof setup>["prisma"];

// Every mutation that touches an existing record, with the write it must guard.
const guarded: { name: string; call: (c: Caller) => Promise<unknown>; write: (p: Prisma) => unknown }[] = [
  { name: "tournament.updateStatus", call: (c) => c.tournament.updateStatus({ id: "t1", status: "COMPLETED" }), write: (p) => p.tournament.update },
  { name: "tournament.delete", call: (c) => c.tournament.delete({ id: "t1" }), write: (p) => p.tournament.delete },
  { name: "team.create", call: (c) => c.team.create({ eventId: "e1", name: "Spikers" }), write: (p) => p.team.create },
  { name: "team.update", call: (c) => c.team.update({ id: "tm1", name: "Setters" }), write: (p) => p.team.update },
  { name: "team.delete", call: (c) => c.team.delete({ id: "tm1" }), write: (p) => p.team.delete },
  { name: "match.create", call: (c) => c.match.create({ stageId: "s1", team1Id: "tm1", team2Id: "tm2" }), write: (p) => p.match.create },
  { name: "match.updateStatus", call: (c) => c.match.updateStatus({ id: "m1", status: "IN_PROGRESS" }), write: (p) => p.match.update },
  { name: "match.recordGame", call: (c) => c.match.recordGame({ matchId: "m1", gameNumber: 1, team1Score: 25, team2Score: 20 }), write: (p) => p.game.upsert },
  { name: "match.complete", call: (c) => c.match.complete({ id: "m1", winnerId: "tm1" }), write: (p) => p.match.update },
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
    expect(write(prisma)).toHaveBeenCalledOnce();
  });
});

describe("match.recordGame", () => {
  const game = { matchId: "m1", gameNumber: 1 };

  it("rejects a tied score instead of crowning team 2", async () => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.match.recordGame({ ...game, team1Score: 21, team2Score: 21 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.game.upsert).not.toHaveBeenCalled();
  });

  it("records team 1 as the winner when it scores higher", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.recordGame({ ...game, team1Score: 25, team2Score: 20 });
    expect(prisma.game.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ winnerId: "tm1" }) }));
  });

  it("records team 2 as the winner when it scores higher", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.recordGame({ ...game, team1Score: 18, team2Score: 25 });
    expect(prisma.game.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ winnerId: "tm2" }) }));
  });

  it("requires both teams to be set", async () => {
    const { caller } = setup(OWNER);
    await expect(caller.match.recordGame({ matchId: "m2", gameNumber: 1, team1Score: 25, team2Score: 20 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("looks the match up once", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.recordGame({ ...game, team1Score: 25, team2Score: 20 });
    expect(prisma.match.findFirst).toHaveBeenCalledOnce();
  });
});

describe("match.complete", () => {
  it("rejects a winner who isn't playing in the match", async () => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.match.complete({ id: "m1", winnerId: "tm-elsewhere" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });
});

describe("match.create", () => {
  it("rejects teams from another event", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.team.count.mockResolvedValue(1);
    await expect(caller.match.create({ stageId: "s1", team1Id: "tm1", team2Id: "tm-elsewhere" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.match.create).not.toHaveBeenCalled();
  });
});

describe("match.create pool and court validation", () => {
  it("does no pool or court lookups when neither is given", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.create({ stageId: "s1", team1Id: "tm1", team2Id: "tm2" });
    expect(prisma.pool.count).not.toHaveBeenCalled();
    expect(prisma.eventCourt.count).not.toHaveBeenCalled();
  });

  it("only accepts a pool from the same pool-play or round-robin stage", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.create({ stageId: "s1", poolId: "p1" });
    expect(prisma.pool.count).toHaveBeenCalledWith({
      where: { id: "p1", stageId: "s1", stage: { type: { in: ["POOL_PLAY", "ROUND_ROBIN"] } } },
    });
  });

  it("rejects a pool that fails that check", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.pool.count.mockResolvedValue(0);
    await expect(caller.match.create({ stageId: "s1", poolId: "p-elsewhere" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.match.create).not.toHaveBeenCalled();
  });

  it("rejects teams that aren't assigned to the pool", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.poolTeam.count.mockResolvedValue(1);
    await expect(caller.match.create({ stageId: "s1", poolId: "p1", team1Id: "tm1", team2Id: "tm2" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.match.create).not.toHaveBeenCalled();
  });

  it("creates a pool match between pool teams", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.create({ stageId: "s1", poolId: "p1", team1Id: "tm1", team2Id: "tm2" });
    expect(prisma.match.create).toHaveBeenCalledOnce();
  });

  it("only accepts a court allocated to the stage's event", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.create({ stageId: "s1", courtId: "c1" });
    expect(prisma.eventCourt.count).toHaveBeenCalledWith({
      where: { courtId: "c1", event: { stages: { some: { id: "s1" } } } },
    });
    expect(prisma.match.create).toHaveBeenCalledOnce();
  });

  it("rejects a court that isn't allocated to the event", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.eventCourt.count.mockResolvedValue(0);
    await expect(caller.match.create({ stageId: "s1", courtId: "c-elsewhere" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.match.create).not.toHaveBeenCalled();
  });
});

describe("tournament listings", () => {
  it("getMine only asks for the caller's tournaments", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.tournament.getMine();
    expect(prisma.tournament.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: OWNER } }));
  });

  it("getMine rejects signed-out callers", async () => {
    const { caller } = setup(null);
    await expect(caller.tournament.getMine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("public listings select only the owner's id and name", async () => {
    const { caller, prisma } = setup(null);
    await caller.tournament.getAll();
    expect(prisma.tournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ owner: { select: { id: true, name: true } } }) })
    );
  });
});
