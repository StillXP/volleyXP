// Runs the real routers against a real Postgres, to check what the mocked tests
// can't: unique constraints, the Court CHECK, and the query shapes themselves.
//
// Opt-in. Create an empty database whose name ends in `_test`, migrate it, then:
//   createdb volley_test   (or CREATE DATABASE volley_test)
//   DATABASE_URL=postgresql://.../volley_test npx prisma migrate deploy
//   TEST_DATABASE_URL=postgresql://.../volley_test npm run test:run
// The test deletes the rows it creates, and refuses to run against any other name.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { PrismaClient } from "../../generated/prisma/client";
import { appRouter } from "../root";
import { createCallerFactory, type Context } from "../trpc";

const url = process.env.TEST_DATABASE_URL;
if (url && !/_test(\?|$)/.test(url)) {
  throw new Error("TEST_DATABASE_URL must point at a database whose name ends in _test");
}

describe.skipIf(!url)("against a real database", () => {
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const run = Date.now();
  const as = (userId: string) => createCallerFactory(appRouter)({ prisma, userId } as unknown as Context);

  let userId: string;
  let otherUserId: string;
  let me: ReturnType<typeof as>;
  let eventId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `owner-${run}@test.io`, name: "Owner" } });
    const other = await prisma.user.create({ data: { email: `other-${run}@test.io`, name: "Other" } });
    userId = user.id;
    otherUserId = other.id;
    me = as(userId);
    const tournament = await me.tournament.create({ name: "Integration Open" });
    const event = await me.event.create({ tournamentId: tournament.id, name: "Doubles", teamSize: 2, bestOf: 3 });
    eventId = event.id;
  });

  afterAll(async () => {
    // Tournaments cascade to events, stages, pools, teams and matches.
    await prisma.tournament.deleteMany({ where: { ownerId: { in: [userId, otherUserId] } } });
    await prisma.location.deleteMany({ where: { ownerId: { in: [userId, otherUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.$disconnect();
  });

  it("reorders stages despite the unique (eventId, order) constraint", async () => {
    const a = await me.stage.create({ eventId, name: "Pools", type: "POOL_PLAY" });
    const b = await me.stage.create({ eventId, name: "Bracket", type: "SINGLE_ELIM" });
    const c = await me.stage.create({ eventId, name: "Consolation", type: "SINGLE_ELIM" });
    expect([a.order, b.order, c.order]).toEqual([1, 2, 3]);

    const reordered = await me.stage.reorder({ eventId, stageIds: [c.id, a.id, b.id] });
    expect(reordered.map((s) => [s.name, s.order])).toEqual([
      ["Consolation", 1],
      ["Pools", 2],
      ["Bracket", 3],
    ]);
  });

  it("keeps temporary courts when fixed courts are replaced", async () => {
    const venue = await me.location.create({ name: "Riverside Park" });
    const fixed = await Promise.all([1, 2].map((n) => me.court.createForLocation({ locationId: venue.id, name: `Court ${n}` })));
    const nets = await me.court.bulkCreateForEvent({ eventId, count: 2 });
    expect(nets.map((n) => n.name)).toEqual(["Net 1", "Net 2"]);

    await me.event.setCourts({ eventId, courtIds: fixed.map((c) => c.id) });
    await me.event.setCourts({ eventId, courtIds: [fixed[0]!.id] });

    const allocated = await prisma.eventCourt.findMany({ where: { eventId }, include: { court: true } });
    expect(allocated.map((e) => e.court.name).sort()).toEqual(["Court 1", "Net 1", "Net 2"]);
  });

  it("rejects attaching another user's court", async () => {
    const theirs = await as(otherUserId).location.create({ name: "Their Gym" });
    const court = await as(otherUserId).court.createForLocation({ locationId: theirs.id, name: "Court 1" });
    await expect(me.event.setCourts({ eventId, courtIds: [court.id] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("enforces that a court belongs to a venue or an event, not both or neither", async () => {
    const venue = await me.location.create({ name: "Check Venue" });
    await expect(prisma.court.create({ data: { name: "Nowhere" } })).rejects.toThrow();
    await expect(prisma.court.create({ data: { name: "Both", locationId: venue.id, eventId } })).rejects.toThrow();
  });

  it("validates pool and court on match.create", async () => {
    const [pools, bracket] = (await prisma.stage.findMany({ where: { eventId }, orderBy: { order: "asc" } })).filter(
      (s) => s.name !== "Consolation"
    );
    const pool = await me.pool.create({ stageId: pools!.id, name: "Pool A" });
    const t1 = await me.team.create({ eventId, name: "Spikers" });
    const t2 = await me.team.create({ eventId, name: "Setters" });
    const t3 = await me.team.create({ eventId, name: "Diggers" });
    await me.pool.assignTeam({ poolId: pool.id, teamId: t1.id, seed: 1 });
    await me.pool.assignTeam({ poolId: pool.id, teamId: t2.id, seed: 2 });
    const net = (await prisma.court.findFirstOrThrow({ where: { eventId, name: "Net 1" } })).id;
    const unallocated = (await prisma.court.findFirstOrThrow({ where: { name: "Court 2" } })).id;

    // A bracket stage has no pools.
    await expect(me.match.create({ stageId: bracket!.id, poolId: pool.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // t3 isn't in the pool.
    await expect(me.match.create({ stageId: pools!.id, poolId: pool.id, team1Id: t1.id, team2Id: t3.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // Court 2 was detached from the event.
    await expect(me.match.create({ stageId: pools!.id, courtId: unallocated })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const match = await me.match.create({ stageId: pools!.id, poolId: pool.id, team1Id: t1.id, team2Id: t2.id, courtId: net });
    expect(match.court?.id).toBe(net);

    // A team plays one pool per stage.
    const second = await me.pool.create({ stageId: pools!.id, name: "Pool B" });
    await expect(me.pool.assignTeam({ poolId: second.id, teamId: t1.id })).rejects.toMatchObject({ code: "CONFLICT" });

    // Recorded games protect the event and stage from deletion.
    await me.match.recordGame({ matchId: match.id, gameNumber: 1, team1Score: 25, team2Score: 20 });
    await expect(me.event.delete({ id: eventId })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(me.stage.delete({ id: pools!.id })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("won't delete a venue that a tournament uses", async () => {
    const venue = await me.location.create({ name: "In Use" });
    const tournament = await me.tournament.create({ name: "Uses Venue" });
    await me.tournament.setLocation({ id: tournament.id, locationId: venue.id });
    await expect(me.location.delete({ id: venue.id })).rejects.toMatchObject({ code: "CONFLICT" });
    await me.tournament.setLocation({ id: tournament.id, locationId: null });
    await me.location.delete({ id: venue.id });
  });
  describe("event.createWithBracket", () => {
    const stored = (stageId: string) => prisma.match.findMany({ where: { stageId } });

    it.each([
      ["single", 8, 7],
      ["single", 7, 6],
      ["double", 8, 14],
      ["double", 5, 8],
    ] as const)("saves a connected %s bracket for %i teams (%i matches)", async (format, count, matches) => {
      const result = await me.event.createWithBracket({
        tournamentName: `Bracket ${format} ${count}`,
        event: { name: "Open" },
        teams: Array.from({ length: count }, (_, i) => `Team ${i + 1}`),
        format,
        nets: 2,
      });
      const rows = await stored(result.stageId);
      expect(rows).toHaveLength(matches);

      // Every link lands on a match in the same stage, on a side that was left empty.
      const byId = new Map(rows.map((m) => [m.id, m]));
      for (const m of rows) {
        for (const [next, slot] of [[m.nextWinnerMatchId, m.nextWinnerSlot], [m.nextLoserMatchId, m.nextLoserSlot]] as const) {
          if (!next) continue;
          const target = byId.get(next)!;
          expect(target).toBeDefined();
          expect(slot === 1 ? target.team1Id : target.team2Id).toBeNull();
        }
      }
      // Seed 1 plays in the bracket, and the nets exist and are allocated to the event.
      const seeded = await prisma.team.findMany({ where: { eventId: result.eventId }, orderBy: { seed: "asc" } });
      expect(seeded.map((t) => t.name)[0]).toBe("Team 1");
      expect(await prisma.eventCourt.count({ where: { eventId: result.eventId } })).toBe(2);
    });

    it("adds to an existing tournament", async () => {
      const tournament = await me.tournament.create({ name: "Existing" });
      const result = await me.event.createWithBracket({
        tournamentId: tournament.id,
        event: { name: "Second Event", bestOf: 5 },
        teams: ["A", "B", "C", "D"],
        format: "single",
      });
      expect(result.tournamentId).toBe(tournament.id);
      expect((await prisma.event.findUniqueOrThrow({ where: { id: result.eventId } })).bestOf).toBe(5);
    });

    it("saves nothing if a write fails partway through", async () => {
      const name = `Rolled back ${run}`;
      // Postgres rejects NUL in text, after the tournament and event rows have been written.
      await expect(
        me.event.createWithBracket({ tournamentName: name, event: { name: "Open" }, teams: ["A", "B "], format: "single" })
      ).rejects.toThrow();
      expect(await prisma.tournament.count({ where: { name } })).toBe(0);
      expect(await prisma.event.count({ where: { name: "Open", tournament: { name } } })).toBe(0);
    });

    it("rejects a bracket key reused within a stage, and a link without its slot", async () => {
      const result = await me.event.createWithBracket({ tournamentName: `Constraints ${run}`, event: { name: "Open" }, teams: ["A", "B", "C", "D"], format: "single" });
      await expect(prisma.match.create({ data: { stageId: result.stageId, bracketKey: "r1-m1" } })).rejects.toThrow();
      await expect(prisma.match.create({ data: { stageId: result.stageId, nextWinnerMatchId: "x" } })).rejects.toThrow();
      await expect(prisma.match.create({ data: { stageId: result.stageId, nextWinnerMatchId: "x", nextWinnerSlot: 3 } })).rejects.toThrow();
    });
  });
});
