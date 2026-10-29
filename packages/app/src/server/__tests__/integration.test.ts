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
    const user = await prisma.user.create({ data: { email: `owner-${run}@test.io`, name: "Olive Owner", firstName: "Olive", lastName: "Owner" } });
    const other = await prisma.user.create({ data: { email: `other-${run}@test.io`, name: "Otis Other", firstName: "Otis", lastName: "Other" } });
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
  describe("event.generateBracket", () => {
    const newEvent = async (name: string) => {
      const tournament = await me.tournament.create({ name: `Generate ${name} ${run}` });
      return (await me.event.create({ tournamentId: tournament.id, name, teamSize: 2 })).id;
    };

    it("seeds the event's teams in order, leaves out withdrawn ones, and links the matches", async () => {
      const id = await newEvent("Seeding");
      const late = await me.team.create({ eventId: id, name: "Late unseeded" });
      const second = await me.team.create({ eventId: id, name: "Seed five", seed: 5 });
      const first = await me.team.create({ eventId: id, name: "Seed two", seed: 2 });
      const early = await me.team.create({ eventId: id, name: "Early unseeded" });
      const out = await me.team.create({ eventId: id, name: "Withdrawn" });
      await me.team.update({ id: out.id, status: "WITHDRAWN" });

      const { stageId } = await me.event.generateBracket({ eventId: id, format: "single" });

      const teams = await prisma.team.findMany({ where: { eventId: id }, orderBy: { name: "asc" } });
      const seedOf = Object.fromEntries(teams.map((t) => [t.name, t.seed]));
      // Seeds 2 and 5 come first, then the unseeded teams oldest first. Withdrawn is untouched.
      expect(seedOf).toEqual({ "Seed two": 1, "Seed five": 2, "Late unseeded": 3, "Early unseeded": 4, Withdrawn: null });
      expect([first.id, second.id, late.id, early.id]).toHaveLength(4);

      const matches = await prisma.match.findMany({ where: { stageId } });
      expect(matches).toHaveLength(3); // 4 teams, single elimination
      const placed = matches.flatMap((m) => [m.team1Id, m.team2Id]).filter(Boolean);
      expect(placed).not.toContain(out.id);
      expect(new Set(placed)).toEqual(new Set([first.id, second.id, late.id, early.id]));
    });

    it("refuses a second bracket, and allows regenerating once the first is deleted", async () => {
      const id = await newEvent("Regenerate");
      await me.team.create({ eventId: id, name: "A" });
      await me.team.create({ eventId: id, name: "B" });
      const { stageId } = await me.event.generateBracket({ eventId: id, format: "single" });
      await expect(me.event.generateBracket({ eventId: id, format: "double" })).rejects.toMatchObject({ code: "CONFLICT" });

      await me.team.create({ eventId: id, name: "C" });
      await me.stage.delete({ id: stageId });
      expect(await prisma.match.count({ where: { stageId } })).toBe(0);

      const again = await me.event.generateBracket({ eventId: id, format: "double" });
      expect(await prisma.match.count({ where: { stageId: again.stageId } })).toBe(4); // 3 teams, double elimination
    });

    it("needs at least two teams and leaves nothing behind when it refuses", async () => {
      const id = await newEvent("Too few");
      await me.team.create({ eventId: id, name: "Only" });
      await expect(me.event.generateBracket({ eventId: id, format: "single" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await prisma.stage.count({ where: { eventId: id } })).toBe(0);
    });

    it("puts the bracket after existing pool-play stages", async () => {
      const id = await newEvent("After pools");
      await me.stage.create({ eventId: id, name: "Pools", type: "POOL_PLAY" });
      await me.team.create({ eventId: id, name: "A" });
      await me.team.create({ eventId: id, name: "B" });
      const { stageId } = await me.event.generateBracket({ eventId: id, format: "single" });
      expect((await prisma.stage.findUniqueOrThrow({ where: { id: stageId } })).order).toBe(2);
    });

    it("won't let another user generate it", async () => {
      const id = await newEvent("Not yours");
      await expect(as(otherUserId).event.generateBracket({ eventId: id, format: "single" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
  describe("tournament.listPublic", () => {
    it("lists opened-up tournaments, dated ones first, and hides drafts and cancelled ones", async () => {
      const tag = `public ${run}`;
      const make = async (name: string, status: "DRAFT" | "REGISTRATION" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED", startDate?: string) =>
        prisma.tournament.create({ data: { name: `${tag} ${name}`, status, ownerId: userId, ...(startDate && { startDate: new Date(startDate) }) } });
      await make("draft", "DRAFT", "2030-01-01");
      await make("cancelled", "CANCELLED", "2030-01-02");
      await make("undated", "REGISTRATION");
      await make("early", "COMPLETED", "2029-03-01");
      await make("late", "IN_PROGRESS", "2029-09-01");
      const venue = await me.location.create({ name: "Listing Venue" });
      const withVenue = await make("venue", "REGISTRATION", "2029-06-01");
      await me.tournament.setLocation({ id: withVenue.id, locationId: venue.id });

      const list = (await as(otherUserId).tournament.listPublic()).filter((t) => t.name.startsWith(tag));
      expect(list.map((t) => t.name.slice(tag.length + 1))).toEqual(["late", "venue", "early", "undated"]);
      expect(list.find((t) => t.name.endsWith("venue"))).toMatchObject({ location: { name: "Listing Venue" }, owner: { id: userId, name: "Olive Owner" }, _count: { events: 0 } });
      expect(JSON.stringify(list)).not.toContain("@test.io");
    });
  });

  describe("tournament.getById", () => {
    it("returns the tournament page's data: owner without email, venue, events in order with team counts", async () => {
      const venue = await me.location.create({ name: "Page Park", address: "1 Park Rd" });
      const tournament = await me.tournament.create({ name: `Page ${run}`, description: "Two days." });
      await me.tournament.setLocation({ id: tournament.id, locationId: venue.id });
      const first = await me.event.create({ tournamentId: tournament.id, name: "First", teamSize: 2, bestOf: 3 });
      const second = await me.event.create({ tournamentId: tournament.id, name: "Second", teamSize: 4, entryCap: 8 });
      await me.team.create({ eventId: second.id, name: "A" });
      await me.team.create({ eventId: second.id, name: "B" });

      // Public: read it as a caller who isn't the owner.
      const page = await as(otherUserId).tournament.getById({ id: tournament.id });

      expect(page).toMatchObject({
        name: `Page ${run}`,
        description: "Two days.",
        status: "DRAFT",
        owner: { id: userId, name: "Olive Owner" },
        location: { name: "Page Park", address: "1 Park Rd" },
      });
      expect(JSON.stringify(page)).not.toContain("@test.io");
      expect(page.events.map((e) => [e.id, e.name, e.teamSize, e.bestOf, e.entryCap, e._count.teams])).toEqual([
        [first.id, "First", 2, 3, null, 0],
        [second.id, "Second", 4, 1, 8, 2],
      ]);
    });
  });
  describe("scoring a whole bracket", () => {
    let counter = 0;
    type Side = 1 | 2;

    const startBracket = async (teams: number, format: "single" | "double", bestOf = 3) => {
      const result = await me.event.createWithBracket({
        tournamentName: `Scoring ${run} ${counter++}`,
        event: { name: "Scored", bestOf },
        teams: Array.from({ length: teams }, (_, i) => `Team ${i + 1}`),
        format,
      });
      return result.stageId;
    };
    const load = (stageId: string) => prisma.match.findMany({ where: { stageId }, include: { games: true } });
    const byKey = async (stageId: string) => new Map((await load(stageId)).map((m) => [m.bracketKey!, m]));
    const teamsOf = (stageId: string) => prisma.team.findMany({ where: { event: { stages: { some: { id: stageId } } } } });

    /** Wins a best-of-3 match in straight games for the given side. */
    const win = async (matchId: string, side: Side) => {
      for (const gameNumber of [1, 2]) {
        const [w, l] = gameNumber === 1 ? [25, 20] : [25, 18];
        await me.match.recordGame({ matchId, gameNumber, team1Score: side === 1 ? w : l, team2Score: side === 1 ? l : w });
      }
    };

    // A small seeded generator so a failing run can be repeated.
    const rng = (seed: number) => () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    /** Plays every match that has both teams until none are left, choosing winners with pick. */
    const playOut = async (stageId: string, pick: (m: { team1Id: string | null; team2Id: string | null }) => Side) => {
      for (;;) {
        const matches = await load(stageId);
        const ready = matches.filter((m) => m.status === "SCHEDULED" && m.team1Id && m.team2Id);
        if (ready.length === 0) {
          expect(matches.filter((m) => m.status !== "COMPLETED")).toEqual([]); // nothing stuck waiting
          return matches;
        }
        for (const m of ready) await win(m.id, pick(m));
      }
    };

    const lossesAfter = async (stageId: string) => {
      const losses = new Map<string, number>();
      for (const m of await load(stageId)) {
        const loser = m.winnerId === m.team1Id ? m.team2Id : m.team1Id;
        if (loser) losses.set(loser, (losses.get(loser) ?? 0) + 1);
      }
      return losses;
    };

    it("advances winners through a single-elimination bracket to a champion", async () => {
      const stageId = await startBracket(8, "single");
      const seed = new Map((await teamsOf(stageId)).map((t) => [t.id, t.seed!]));
      // The better seed always wins.
      const matches = await playOut(stageId, (m) => (seed.get(m.team1Id!)! < seed.get(m.team2Id!)! ? 1 : 2));
      expect(matches).toHaveLength(7);
      const final = matches.find((m) => m.bracketKey === "r3-m1")!;
      expect(seed.get(final.winnerId!)).toBe(1);
      // Semifinals feed the right sides of the final.
      const semis = ["r2-m1", "r2-m2"].map((k) => matches.find((m) => m.bracketKey === k)!);
      expect([final.team1Id, final.team2Id]).toEqual(semis.map((m) => m.winnerId));
      // Everyone but the champion lost exactly once.
      expect([...(await lossesAfter(stageId)).values()]).toEqual(Array(7).fill(1));
    });

    it.each([3, 4, 5, 6, 7, 8, 9, 12, 16])("plays a %i-team double-elimination bracket to a champion whoever wins", async (n) => {
      for (const seed of [1, 2, 3]) {
        const flip = rng(seed * 1000 + n);
        const stageId = await startBracket(n, "double");
        const matches = await playOut(stageId, () => (flip() < 0.5 ? 1 : 2));
        expect(matches).toHaveLength(2 * n - 2);
        const final = matches.find((m) => m.bracketKey === "gf-m1")!;
        const losses = await lossesAfter(stageId);
        // Nobody plays on after a second loss, and only the grand-final winner and runner-up have fewer than two.
        expect(Math.max(...losses.values())).toBeLessThanOrEqual(2);
        const fewer = (await teamsOf(stageId)).filter((t) => (losses.get(t.id) ?? 0) < 2).map((t) => t.id);
        expect(fewer).toContain(final.winnerId);
        expect(fewer.length).toBeLessThanOrEqual(2);
      }
    });

    it("takes a result back when the deciding game is undone, and replays it", async () => {
      const stageId = await startBracket(4, "single");
      const m = (await byKey(stageId)).get("r1-m1")!;
      await win(m.id, 1);
      expect((await byKey(stageId)).get("r2-m1")!.team1Id).toBe(m.team1Id);

      // Undo the last point of the deciding game: 25-18 becomes 24-18, no longer finished.
      await me.match.recordGame({ matchId: m.id, gameNumber: 2, team1Score: 24, team2Score: 18 });
      const after = await byKey(stageId);
      expect(after.get("r2-m1")!.team1Id).toBeNull();
      expect(after.get("r1-m1")).toMatchObject({ status: "IN_PROGRESS", winnerId: null });

      await me.match.recordGame({ matchId: m.id, gameNumber: 2, team1Score: 25, team2Score: 18 });
      expect((await byKey(stageId)).get("r2-m1")!.team1Id).toBe(m.team1Id);
    });

    it("won't change a result after the next match has started", async () => {
      const stageId = await startBracket(4, "single");
      const first = await byKey(stageId);
      await win(first.get("r1-m1")!.id, 1);
      await win(first.get("r1-m2")!.id, 1);
      const final = (await byKey(stageId)).get("r2-m1")!;
      await me.match.recordGame({ matchId: final.id, gameNumber: 1, team1Score: 3, team2Score: 2 });

      await expect(
        me.match.recordGame({ matchId: first.get("r1-m1")!.id, gameNumber: 2, team1Score: 24, team2Score: 18 })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const after = await byKey(stageId);
      expect(after.get("r1-m1")).toMatchObject({ status: "COMPLETED" });
      expect(after.get("r1-m1")!.games.find((g) => g.gameNumber === 2)).toMatchObject({ team1Score: 25 });
      expect(after.get("r2-m1")!.team1Id).toBe(after.get("r1-m1")!.winnerId);
    });

    it("moves a forfeit winner on, and takes them back when it is reopened", async () => {
      const stageId = await startBracket(4, "single");
      const m = (await byKey(stageId)).get("r1-m1")!;
      await me.match.complete({ id: m.id, winnerId: m.team2Id! });
      expect((await byKey(stageId)).get("r2-m1")!.team1Id).toBe(m.team2Id);

      await me.match.reopen({ id: m.id });
      const after = await byKey(stageId);
      expect(after.get("r2-m1")!.team1Id).toBeNull();
      expect(after.get("r1-m1")).toMatchObject({ status: "SCHEDULED", winnerId: null });
    });

    it("fills both slots of a match when its two feeders finish at the same time", async () => {
      const stageId = await startBracket(4, "single");
      const first = await byKey(stageId);
      await Promise.all([win(first.get("r1-m1")!.id, 1), win(first.get("r1-m2")!.id, 2)]);
      const final = (await byKey(stageId)).get("r2-m1")!;
      expect(final.team1Id).toBe(first.get("r1-m1")!.team1Id);
      expect(final.team2Id).toBe(first.get("r1-m2")!.team2Id);
    });

    it("stays consistent when two scorekeepers finish the same game with different scores", async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const stageId = await startBracket(4, "single");
        const m = (await byKey(stageId)).get("r1-m1")!;
        await me.match.recordGame({ matchId: m.id, gameNumber: 1, team1Score: 25, team2Score: 20 });
        await Promise.all([
          me.match.recordGame({ matchId: m.id, gameNumber: 2, team1Score: 25, team2Score: 18 }),
          me.match.recordGame({ matchId: m.id, gameNumber: 2, team1Score: 18, team2Score: 25 }),
        ]);
        const after = await byKey(stageId);
        const done = after.get("r1-m1")!;
        const game2 = done.games.find((g) => g.gameNumber === 2)!;
        // Whichever landed last, the match, the game and the next match all tell the same story.
        if (game2.team1Score > game2.team2Score) {
          expect(done).toMatchObject({ status: "COMPLETED", winnerId: m.team1Id });
        } else {
          expect(done.status).toBe("IN_PROGRESS"); // 1-1 after the corrected game
          expect(done.winnerId).toBeNull();
        }
        expect(after.get("r2-m1")!.team1Id).toBe(done.winnerId);
      }
    });
  });
});
