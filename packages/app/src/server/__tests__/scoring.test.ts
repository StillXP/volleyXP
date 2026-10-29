import { describe, expect, it, vi } from "vitest";

// The real client opens a connection pool on import; the tests inject a fake instead.
vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { appRouter } from "../root";
import { createCallerFactory, type Context } from "../trpc";
import { ownedFindFirst } from "./helpers";

const OWNER = "user-owner";
const STRANGER = "user-stranger";

type Status = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
interface Row {
  id: string;
  status: Status;
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
  actualStartTime: Date | null;
  nextWinnerMatchId: string | null;
  nextWinnerSlot: number | null;
  nextLoserMatchId: string | null;
  nextLoserSlot: number | null;
  games: { gameNumber: number; team1Score: number; team2Score: number; winnerId: string | null; completedAt: Date | null }[];
  stage: { event: { bestOf: number; pointsToWin: number; pointsToWinLastGame: number | null } };
}

// A match between tm1 and tm2 in a best of 3 (25 points, 15 in the decider). The winner goes
// to w1's first slot and the loser to l1's second.
const baseRow = (): Row => ({
  id: "m1",
  status: "SCHEDULED",
  team1Id: "tm1",
  team2Id: "tm2",
  winnerId: null,
  actualStartTime: null,
  nextWinnerMatchId: "w1",
  nextWinnerSlot: 1,
  nextLoserMatchId: "l1",
  nextLoserSlot: 2,
  games: [],
  stage: { event: { bestOf: 3, pointsToWin: 25, pointsToWinLastGame: 15 } },
});

/** A game as stored: finished games carry a winner. */
const played = (gameNumber: number, team1Score: number, team2Score: number) => {
  const target = gameNumber === 3 ? 15 : 25;
  const finished = Math.max(team1Score, team2Score) >= target && Math.abs(team1Score - team2Score) >= 2;
  return {
    gameNumber,
    team1Score,
    team2Score,
    winnerId: finished ? (team1Score > team2Score ? "tm1" : "tm2") : null,
    completedAt: finished ? new Date("2026-01-01") : null,
  };
};

function setup(userId: string | null, overrides: Partial<Row> = {}) {
  const row: Row = { ...baseRow(), ...overrides };
  // The transaction callback gets the same fake as its client.
  const tx: { client: unknown } = { client: null };
  const prisma = {
    match: {
      findFirst: ownedFindFirst({ m1: OWNER }, () => ({ team1Id: row.team1Id, team2Id: row.team2Id, status: row.status })),
      findUniqueOrThrow: vi.fn(async (_args: unknown) => row),
      update: vi.fn(async (_args: { where: { id: string }; data: Record<string, unknown> }) => ({})),
      count: vi.fn(async (_args: unknown) => 0),
    },
    game: { upsert: vi.fn(async (_args: { create: Record<string, unknown>; update: Record<string, unknown> }) => ({})) },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (run: (client: unknown) => Promise<unknown>) => run(tx.client)),
  };
  tx.client = prisma;
  const caller = createCallerFactory(appRouter)({ prisma, userId } as unknown as Context);
  return { prisma, caller };
}

type Prisma = ReturnType<typeof setup>["prisma"];
const game1 = { matchId: "m1", gameNumber: 1 };
/** The updates made to a match other than the one being scored. */
const updatesTo = (p: Prisma, id: string) => p.match.update.mock.calls.filter(([a]) => a.where.id === id).map(([a]) => a.data);

describe.each([
  ["match.recordGame", (c: ReturnType<typeof setup>["caller"]) => c.match.recordGame({ ...game1, team1Score: 25, team2Score: 20 }), (p: Prisma) => p.game.upsert, {}],
  ["match.complete", (c: ReturnType<typeof setup>["caller"]) => c.match.complete({ id: "m1", winnerId: "tm1" }), (p: Prisma) => p.match.update, {}],
  ["match.reopen", (c: ReturnType<typeof setup>["caller"]) => c.match.reopen({ id: "m1" }), (p: Prisma) => p.match.update, { status: "COMPLETED", winnerId: "tm1" }],
] as const)("%s access", (_name, call, write, overrides) => {
  it("rejects signed-out callers", async () => {
    const { caller, prisma } = setup(null, overrides as Partial<Row>);
    await expect(call(caller)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(write(prisma)).not.toHaveBeenCalled();
  });

  it("rejects callers who don't own the tournament", async () => {
    const { caller, prisma } = setup(STRANGER, overrides as Partial<Row>);
    await expect(call(caller)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(write(prisma)).not.toHaveBeenCalled();
  });

  it("lets the owner through", async () => {
    const { caller, prisma } = setup(OWNER, overrides as Partial<Row>);
    await call(caller);
    expect(write(prisma)).toHaveBeenCalled();
  });
});

describe("match.recordGame guards", () => {
  it("needs both teams", async () => {
    const { caller, prisma } = setup(OWNER, { team2Id: null });
    await expect(caller.match.recordGame({ ...game1, team1Score: 1, team2Score: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.game.upsert).not.toHaveBeenCalled();
  });

  it("won't score a cancelled match", async () => {
    const { caller } = setup(OWNER, { status: "CANCELLED" });
    await expect(caller.match.recordGame({ ...game1, team1Score: 1, team2Score: 0 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("won't record a game past the match length", async () => {
    const { caller } = setup(OWNER, { games: [played(1, 25, 20), played(2, 20, 25)] });
    await expect(caller.match.recordGame({ matchId: "m1", gameNumber: 4, team1Score: 1, team2Score: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("holds the row lock while it works", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.recordGame({ ...game1, team1Score: 1, team2Score: 0 });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it("makes games be recorded in order", async () => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.match.recordGame({ matchId: "m1", gameNumber: 2, team1Score: 1, team2Score: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.game.upsert).not.toHaveBeenCalled();
  });

  it("won't start the next game before the current one is finished", async () => {
    const { caller } = setup(OWNER, { status: "IN_PROGRESS", games: [played(1, 24, 22)] });
    await expect(caller.match.recordGame({ matchId: "m1", gameNumber: 2, team1Score: 1, team2Score: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("won't add a game once the match is decided", async () => {
    const { caller } = setup(OWNER, { status: "COMPLETED", winnerId: "tm1", games: [played(1, 25, 20), played(2, 25, 18)] });
    await expect(caller.match.recordGame({ matchId: "m1", gameNumber: 3, team1Score: 1, team2Score: 0 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("won't score a match that was completed by forfeit", async () => {
    const { caller, prisma } = setup(OWNER, { status: "COMPLETED", winnerId: "tm1" });
    await expect(caller.match.recordGame({ ...game1, team1Score: 25, team2Score: 20 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.game.upsert).not.toHaveBeenCalled();
  });

  it("won't change an earlier game's winner once later games are recorded", async () => {
    const { caller, prisma } = setup(OWNER, { status: "IN_PROGRESS", games: [played(1, 25, 20), played(2, 12, 10)] });
    await expect(caller.match.recordGame({ ...game1, team1Score: 20, team2Score: 25 })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller.match.recordGame({ ...game1, team1Score: 24, team2Score: 22 })).rejects.toMatchObject({ code: "CONFLICT" }); // no longer finished
    expect(prisma.game.upsert).not.toHaveBeenCalled();
  });

  it("lets an earlier game be corrected when its winner stays the same", async () => {
    const { caller, prisma } = setup(OWNER, { status: "IN_PROGRESS", games: [played(1, 25, 20), played(2, 12, 10)] });
    await caller.match.recordGame({ ...game1, team1Score: 25, team2Score: 21 });
    expect(prisma.game.upsert).toHaveBeenCalledOnce();
  });
});

describe("match.recordGame scoring", () => {
  it("treats a tie as a game still being played, with no winner yet", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.recordGame({ ...game1, team1Score: 10, team2Score: 10 });
    expect(prisma.game.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ winnerId: null, completedAt: null }) })
    );
    expect(updatesTo(prisma, "m1")).toEqual([expect.objectContaining({ status: "IN_PROGRESS", winnerId: null })]);
    expect(updatesTo(prisma, "w1")).toEqual([]);
  });

  it("starts the match with the first point", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.recordGame({ ...game1, team1Score: 0, team2Score: 0 });
    expect(updatesTo(prisma, "m1")[0]).toMatchObject({ status: "IN_PROGRESS", actualStartTime: expect.any(Date) });
  });

  it("keeps the original start time", async () => {
    const started = new Date("2026-01-01T10:00:00Z");
    const { caller, prisma } = setup(OWNER, { status: "IN_PROGRESS", actualStartTime: started, games: [played(1, 5, 3)] });
    await caller.match.recordGame({ ...game1, team1Score: 6, team2Score: 3 });
    expect(updatesTo(prisma, "m1")[0]).toMatchObject({ actualStartTime: started });
  });

  it.each([
    [25, 20, "tm1"],
    [18, 25, "tm2"],
    [26, 24, "tm1"],
  ])("finishes a game at %i-%i for %s without ending a best-of-3 match", async (a, b, winner) => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.recordGame({ ...game1, team1Score: a, team2Score: b });
    expect(prisma.game.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ winnerId: winner, completedAt: expect.any(Date) }) })
    );
    expect(updatesTo(prisma, "m1")).toEqual([expect.objectContaining({ status: "IN_PROGRESS", winnerId: null })]);
    expect(updatesTo(prisma, "w1")).toEqual([]);
  });

  it("doesn't finish a game on a one-point lead at the target", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.recordGame({ ...game1, team1Score: 25, team2Score: 24 });
    expect(prisma.game.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ winnerId: null }) }));
  });

  it("completes the match on the winning game, and sends the winner and loser to their slots", async () => {
    const { caller, prisma } = setup(OWNER, { status: "IN_PROGRESS", games: [played(1, 25, 20)] });
    await caller.match.recordGame({ matchId: "m1", gameNumber: 2, team1Score: 25, team2Score: 18 });
    expect(updatesTo(prisma, "m1")).toEqual([expect.objectContaining({ status: "COMPLETED", winnerId: "tm1" })]);
    expect(updatesTo(prisma, "w1")).toEqual([{ team1Id: "tm1" }]);
    expect(updatesTo(prisma, "l1")).toEqual([{ team2Id: "tm2" }]);
  });

  it("sends team 2 on when it wins, to the planned sides", async () => {
    const { caller, prisma } = setup(OWNER, { status: "IN_PROGRESS", games: [played(1, 20, 25)], nextWinnerSlot: 2, nextLoserSlot: 1 });
    await caller.match.recordGame({ matchId: "m1", gameNumber: 2, team1Score: 18, team2Score: 25 });
    expect(updatesTo(prisma, "w1")).toEqual([{ team2Id: "tm2" }]);
    expect(updatesTo(prisma, "l1")).toEqual([{ team1Id: "tm1" }]);
  });

  it("plays the deciding game to the shorter target", async () => {
    const games = [played(1, 25, 20), played(2, 18, 25)];
    const { caller, prisma } = setup(OWNER, { status: "IN_PROGRESS", games });
    await caller.match.recordGame({ matchId: "m1", gameNumber: 3, team1Score: 15, team2Score: 12 });
    expect(updatesTo(prisma, "m1")).toEqual([expect.objectContaining({ status: "COMPLETED", winnerId: "tm1" })]);
  });

  it("moves no one when a bracket match has nowhere to send them (a single-elimination final)", async () => {
    const { caller, prisma } = setup(OWNER, { nextWinnerMatchId: null, nextWinnerSlot: null, nextLoserMatchId: null, nextLoserSlot: null, stage: { event: { bestOf: 1, pointsToWin: 25, pointsToWinLastGame: null } } });
    await caller.match.recordGame({ ...game1, team1Score: 25, team2Score: 20 });
    expect(prisma.match.update.mock.calls.map(([a]) => a.where.id)).toEqual(["m1"]);
  });
});

describe("match.recordGame corrections", () => {
  const decided = { status: "COMPLETED" as const, winnerId: "tm1", games: [played(1, 25, 20), played(2, 25, 18)] };

  it("takes the result back when the deciding game is edited so it isn't finished (an undo)", async () => {
    const { caller, prisma } = setup(OWNER, decided);
    await caller.match.recordGame({ matchId: "m1", gameNumber: 2, team1Score: 24, team2Score: 18 });
    expect(updatesTo(prisma, "w1")).toEqual([{ team1Id: null }]);
    expect(updatesTo(prisma, "l1")).toEqual([{ team2Id: null }]);
    expect(updatesTo(prisma, "m1")).toEqual([expect.objectContaining({ status: "IN_PROGRESS", winnerId: null })]);
  });

  it("moves the other team on when the correction flips the winner", async () => {
    const { caller, prisma } = setup(OWNER, decided);
    await caller.match.recordGame({ matchId: "m1", gameNumber: 2, team1Score: 18, team2Score: 25 });
    // 1-1 now, so the match is open again rather than flipped.
    expect(updatesTo(prisma, "m1")).toEqual([expect.objectContaining({ status: "IN_PROGRESS", winnerId: null })]);
  });

  it("flips the winner when the corrected game changes who took the match", async () => {
    const { caller, prisma } = setup(OWNER, { status: "COMPLETED", winnerId: "tm1", games: [played(1, 25, 20), played(2, 18, 25), played(3, 15, 12)] });
    await caller.match.recordGame({ matchId: "m1", gameNumber: 3, team1Score: 12, team2Score: 15 });
    expect(updatesTo(prisma, "m1")).toEqual([expect.objectContaining({ status: "COMPLETED", winnerId: "tm2" })]);
    expect(updatesTo(prisma, "w1")).toEqual([{ team1Id: null }, { team1Id: "tm2" }]);
    expect(updatesTo(prisma, "l1")).toEqual([{ team2Id: null }, { team2Id: "tm1" }]);
  });

  it("refuses to change a result once a match it fed has started", async () => {
    const { caller, prisma } = setup(OWNER, decided);
    prisma.match.count.mockResolvedValue(1);
    await expect(caller.match.recordGame({ matchId: "m1", gameNumber: 2, team1Score: 24, team2Score: 18 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.match.count).toHaveBeenCalledWith({
      where: { id: { in: ["w1", "l1"] }, OR: [{ status: { not: "SCHEDULED" } }, { games: { some: {} } }] },
    });
    expect(prisma.game.upsert).not.toHaveBeenCalled();
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("only edits the score when the winner doesn't change, leaving downstream alone", async () => {
    const { caller, prisma } = setup(OWNER, decided);
    prisma.match.count.mockResolvedValue(1); // downstream has started, but nothing here touches it
    await caller.match.recordGame({ matchId: "m1", gameNumber: 2, team1Score: 25, team2Score: 21 });
    expect(prisma.game.upsert).toHaveBeenCalledOnce();
    expect(updatesTo(prisma, "w1")).toEqual([]);
    expect(updatesTo(prisma, "l1")).toEqual([]);
  });
});

describe("match.complete (forfeit)", () => {
  it("needs a winner who is in the match", async () => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.match.complete({ id: "m1", winnerId: "tm-elsewhere" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("completes the match and moves the winner and loser on", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.complete({ id: "m1", winnerId: "tm2" });
    expect(updatesTo(prisma, "m1")).toEqual([expect.objectContaining({ status: "COMPLETED", winnerId: "tm2" })]);
    expect(updatesTo(prisma, "w1")).toEqual([{ team1Id: "tm2" }]);
    expect(updatesTo(prisma, "l1")).toEqual([{ team2Id: "tm1" }]);
  });

  it("does nothing the second time for the same winner", async () => {
    const { caller, prisma } = setup(OWNER, { status: "COMPLETED", winnerId: "tm2" });
    await caller.match.complete({ id: "m1", winnerId: "tm2" });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("changes the winner only while downstream hasn't started", async () => {
    const { caller, prisma } = setup(OWNER, { status: "COMPLETED", winnerId: "tm1" });
    prisma.match.count.mockResolvedValue(1);
    await expect(caller.match.complete({ id: "m1", winnerId: "tm2" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("re-routes the players when the winner is changed", async () => {
    const { caller, prisma } = setup(OWNER, { status: "COMPLETED", winnerId: "tm1" });
    await caller.match.complete({ id: "m1", winnerId: "tm2" });
    expect(updatesTo(prisma, "w1")).toEqual([{ team1Id: null }, { team1Id: "tm2" }]);
  });
});

describe("match.reopen", () => {
  it("only reopens a completed match", async () => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.match.reopen({ id: "m1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("points to the last game for a match its games decided", async () => {
    const { caller } = setup(OWNER, { status: "COMPLETED", winnerId: "tm1", games: [played(1, 25, 20), played(2, 25, 18)] });
    await expect(caller.match.reopen({ id: "m1" })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("last game") });
  });

  it("undoes a forfeit that had no games, back to scheduled, and takes the players back out", async () => {
    const { caller, prisma } = setup(OWNER, { status: "COMPLETED", winnerId: "tm1" });
    await caller.match.reopen({ id: "m1" });
    expect(updatesTo(prisma, "w1")).toEqual([{ team1Id: null }]);
    expect(updatesTo(prisma, "l1")).toEqual([{ team2Id: null }]);
    expect(updatesTo(prisma, "m1")).toEqual([{ status: "SCHEDULED", winnerId: null }]);
  });

  it("goes back to in progress when games had been played before the forfeit", async () => {
    const { caller, prisma } = setup(OWNER, { status: "COMPLETED", winnerId: "tm1", games: [played(1, 12, 10)] });
    await caller.match.reopen({ id: "m1" });
    expect(updatesTo(prisma, "m1")).toEqual([{ status: "IN_PROGRESS", winnerId: null }]);
  });

  it("refuses once downstream has started", async () => {
    const { caller, prisma } = setup(OWNER, { status: "COMPLETED", winnerId: "tm1" });
    prisma.match.count.mockResolvedValue(1);
    await expect(caller.match.reopen({ id: "m1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });
});

describe("match.updateStatus", () => {
  it("won't mark a match completed without scoring it", async () => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.match.updateStatus({ id: "m1", status: "COMPLETED" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("won't change a completed match's status", async () => {
    const { caller, prisma } = setup(OWNER, { status: "COMPLETED", winnerId: "tm1" });
    await expect(caller.match.updateStatus({ id: "m1", status: "SCHEDULED" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("stamps the start time when a match is started", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.updateStatus({ id: "m1", status: "IN_PROGRESS" });
    expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { status: "IN_PROGRESS", actualStartTime: expect.any(Date) } });
  });

  it("can cancel a match", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.match.updateStatus({ id: "m1", status: "CANCELLED" });
    expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { status: "CANCELLED" } });
  });
});
