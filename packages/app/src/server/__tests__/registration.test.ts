// Team registration against a real Postgres: the event lock, the unique indexes and the
// waitlist are what's being checked, and mocks couldn't show them. Opt-in like
// integration.test.ts: set TEST_DATABASE_URL to a migrated database ending in _test.
import { afterAll, describe, expect, it, vi } from "vitest";
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

describe.skipIf(!url)("team registration against a real database", () => {
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const run = Date.now();
  let counter = 0;
  const userIds: string[] = [];

  const as = (userId: string | null) => createCallerFactory(appRouter)({ prisma, userId } as unknown as Context);
  const person = async (firstName: string, lastName: string) => {
    const user = await prisma.user.create({
      data: { email: `reg-${run}-${counter++}@test.io`, name: `${firstName} ${lastName}`, firstName, lastName },
    });
    userIds.push(user.id);
    return { id: user.id, api: as(user.id) };
  };

  type Person = Awaited<ReturnType<typeof person>>;
  let organizer: Person;
  const ready = (async () => {
    organizer = await person("Olive", "Organizer");
  })();

  /** A fresh event with registration open, unless told otherwise. */
  const newEvent = async (options: { teamSize?: number; entryCap?: number; open?: boolean } = {}) => {
    await ready;
    const tournament = await organizer.api.tournament.create({ name: `Registration ${run} ${counter++}` });
    const event = await organizer.api.event.create({
      tournamentId: tournament.id,
      name: "Doubles",
      teamSize: options.teamSize ?? 2,
      ...(options.entryCap && { entryCap: options.entryCap }),
    });
    if (options.open !== false) await organizer.api.event.setRegistration({ id: event.id, open: true });
    return event.id;
  };
  const teamOf = (teamId: string) => prisma.team.findUniqueOrThrow({ where: { id: teamId } });
  const statusOf = async (eventId: string) => (await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).status;

  afterAll(async () => {
    // Tournaments cascade to events, teams and memberships; users can go once those have.
    await prisma.tournament.deleteMany({ where: { ownerId: organizer?.id } });
    await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
    await prisma.$disconnect();
  });

  describe("the organizer controls registration", () => {
    it("keeps registration closed until it is opened", async () => {
      const eventId = await newEvent({ open: false });
      const captain = await person("Alex", "Kim");
      await expect(captain.api.registration.register({ eventId })).rejects.toMatchObject({ code: "CONFLICT" });
      await organizer.api.event.setRegistration({ id: eventId, open: true });
      expect(await statusOf(eventId)).toBe("REGISTRATION");
      await expect(captain.api.registration.register({ eventId })).resolves.toMatchObject({ status: "REGISTERED" });
    });

    it("only lets the event's organizer open or close it", async () => {
      const eventId = await newEvent({ open: false });
      const stranger = await person("Sam", "Stranger");
      await expect(stranger.api.event.setRegistration({ id: eventId, open: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(as(null).event.setRegistration({ id: eventId, open: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("stops new teams and joins when closed, and takes them again when reopened", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const { inviteCode } = await captain.api.registration.register({ eventId });
      await organizer.api.event.setRegistration({ id: eventId, open: false });
      expect(await statusOf(eventId)).toBe("SEEDING");

      const late = await person("Late", "Comer");
      await expect(late.api.registration.register({ eventId })).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(late.api.registration.join({ code: inviteCode! })).rejects.toMatchObject({ code: "CONFLICT" });

      await organizer.api.event.setRegistration({ id: eventId, open: true });
      await expect(late.api.registration.join({ code: inviteCode! })).resolves.toBeTruthy();
    });

    it("refuses to close registration that isn't open", async () => {
      const eventId = await newEvent({ open: false });
      await expect(organizer.api.event.setRegistration({ id: eventId, open: false })).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("can't be changed, or used, once the bracket is made, which starts the event", async () => {
      const eventId = await newEvent();
      const [a, b, c] = [await person("Ann", "Aa"), await person("Bo", "Bb"), await person("Cy", "Cc")];
      const teamA = await a.api.registration.register({ eventId });
      const teamB = await b.api.registration.register({ eventId });
      const { inviteCode } = teamA;

      await organizer.api.event.generateBracket({ eventId, format: "single" });
      expect(await statusOf(eventId)).toBe("IN_PROGRESS");

      await expect(organizer.api.event.setRegistration({ id: eventId, open: true })).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(organizer.api.event.setRegistration({ id: eventId, open: false })).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(c.api.registration.register({ eventId })).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(c.api.registration.join({ code: inviteCode! })).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(b.api.registration.withdraw({ teamId: teamB.id })).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(b.api.registration.rename({ teamId: teamB.id, name: "Renamed" })).rejects.toMatchObject({ code: "CONFLICT" });
    });
  });

  describe("registering a team", () => {
    it("makes the caller its captain, with a custom name if they give one", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const team = await captain.api.registration.register({ eventId, name: "  The Spikers " });
      expect(team).toMatchObject({ name: "The Spikers", status: "REGISTERED" });
      expect(team.inviteCode).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(await teamOf(team.id)).toMatchObject({ usesDefaultName: false });
      expect(await prisma.teamMember.findMany({ where: { teamId: team.id } })).toMatchObject([{ userId: captain.id, role: "CAPTAIN", eventId }]);
    });

    it("names it after the captain's last name when no name is given", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const team = await captain.api.registration.register({ eventId });
      expect(team.name).toBe("Kim");
      expect(await teamOf(team.id)).toMatchObject({ usesDefaultName: true });
    });

    it.each([["blank", "   "], ["too long", "x".repeat(61)]])("refuses a name that is %s", async (_label, name) => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      await expect(captain.api.registration.register({ eventId, name })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("needs a signed-in user", async () => {
      const eventId = await newEvent();
      await expect(as(null).registration.register({ eventId })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("says an unknown event isn't there", async () => {
      const captain = await person("Alex", "Kim");
      await expect(captain.api.registration.register({ eventId: "no-such-event" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("allows one team per person per event", async () => {
      const eventId = await newEvent();
      const alex = await person("Alex", "Kim");
      const sam = await person("Sam", "Lopez");
      await alex.api.registration.register({ eventId });
      await expect(alex.api.registration.register({ eventId })).rejects.toMatchObject({ code: "CONFLICT" });

      const other = await sam.api.registration.register({ eventId });
      // Alex captains a team already, so Sam's invite can't also take Alex.
      await expect(alex.api.registration.join({ code: other.inviteCode! })).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("backs that rule with the database, not just the checks", async () => {
      const eventId = await newEvent();
      const alex = await person("Alex", "Kim");
      const sam = await person("Sam", "Lopez");
      const mine = await alex.api.registration.register({ eventId });
      const theirs = await sam.api.registration.register({ eventId });
      await expect(
        prisma.teamMember.create({ data: { teamId: theirs.id, eventId, userId: alex.id, role: "PLAYER" } })
      ).rejects.toThrow();
      expect(mine.id).not.toBe(theirs.id);
    });

    it("lets the same person be on a team in each of two events", async () => {
      const alex = await person("Alex", "Kim");
      await alex.api.registration.register({ eventId: await newEvent() });
      await expect(alex.api.registration.register({ eventId: await newEvent() })).resolves.toBeTruthy();
    });
  });

  describe("joining by invite link", () => {
    it("shows what the link is for without signing in, and nothing private", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const { inviteCode } = await captain.api.registration.register({ eventId, name: "The Spikers" });
      const preview = await as(null).registration.getInvite({ code: inviteCode! });
      expect(preview).toMatchObject({
        teamName: "The Spikers",
        captain: "Alex Kim",
        spotsLeft: 1,
        registrationOpen: true,
        event: { id: eventId, name: "Doubles" },
      });
      expect(JSON.stringify(preview)).not.toContain("@test.io");
      expect(JSON.stringify(preview)).not.toContain(inviteCode!);
    });

    it("adds the joiner as a player and updates a generated team name", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const mate = await person("Sam", "Lopez");
      const team = await captain.api.registration.register({ eventId });
      const joined = await mate.api.registration.join({ code: team.inviteCode! });
      expect(joined).toEqual({ teamId: team.id, eventId });
      expect(await teamOf(team.id)).toMatchObject({ name: "Kim/Lopez", usesDefaultName: true });
      expect((await prisma.teamMember.findMany({ where: { teamId: team.id }, orderBy: { id: "asc" } })).map((m) => m.role)).toEqual(["CAPTAIN", "PLAYER"]);
    });

    it("leaves a custom team name alone", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const mate = await person("Sam", "Lopez");
      const team = await captain.api.registration.register({ eventId, name: "The Spikers" });
      await mate.api.registration.join({ code: team.inviteCode! });
      expect((await teamOf(team.id)).name).toBe("The Spikers");
    });

    it("needs a signed-in user, a valid link, and open registration", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const mate = await person("Sam", "Lopez");
      const team = await captain.api.registration.register({ eventId });
      await expect(as(null).registration.join({ code: team.inviteCode! })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(mate.api.registration.join({ code: "not-a-real-code" })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(as(null).registration.getInvite({ code: "not-a-real-code" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("stops when the team is full", async () => {
      const eventId = await newEvent({ teamSize: 2 });
      const [a, b, c] = [await person("Ann", "Aa"), await person("Bo", "Bb"), await person("Cy", "Cc")];
      const team = await a.api.registration.register({ eventId });
      await b.api.registration.join({ code: team.inviteCode! });
      await expect(c.api.registration.join({ code: team.inviteCode! })).rejects.toMatchObject({ code: "CONFLICT", message: "This team is already full" });
      expect((await as(null).registration.getInvite({ code: team.inviteCode! })).spotsLeft).toBe(0);
    });

    it("fills a bigger team up to its size, and shortens the generated name", async () => {
      const eventId = await newEvent({ teamSize: 4 });
      const people = await Promise.all([person("A", "Aa"), person("B", "Bb"), person("C", "Cc"), person("D", "Dd"), person("E", "Ee")]);
      const team = await people[0]!.api.registration.register({ eventId });
      for (const p of people.slice(1, 4)) await p.api.registration.join({ code: team.inviteCode! });
      await expect(people[4]!.api.registration.join({ code: team.inviteCode! })).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await teamOf(team.id)).name).toBe("Aa/Bb +2");
    });

    it("gives the last spot to only one of two people racing for it", async () => {
      for (let round = 0; round < 4; round++) {
        const eventId = await newEvent({ teamSize: 2 });
        const captain = await person("Cap", "Tain");
        const [x, y] = [await person("Xa", "Xx"), await person("Yb", "Yy")];
        const team = await captain.api.registration.register({ eventId });
        const results = await Promise.allSettled([x.api.registration.join({ code: team.inviteCode! }), y.api.registration.join({ code: team.inviteCode! })]);
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(await prisma.teamMember.count({ where: { teamId: team.id } })).toBe(2);
      }
    });

    it("stops working when the team withdraws, and rotating the link kills the old one", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const mate = await person("Sam", "Lopez");
      const team = await captain.api.registration.register({ eventId });
      const { inviteCode: fresh } = await captain.api.registration.rotateInvite({ teamId: team.id });
      expect(fresh).not.toBe(team.inviteCode);
      await expect(mate.api.registration.join({ code: team.inviteCode! })).rejects.toMatchObject({ code: "NOT_FOUND" });

      await captain.api.registration.withdraw({ teamId: team.id });
      await expect(mate.api.registration.join({ code: fresh })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("lets only the captain rotate the link", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const mate = await person("Sam", "Lopez");
      const team = await captain.api.registration.register({ eventId });
      await mate.api.registration.join({ code: team.inviteCode! });
      await expect(mate.api.registration.rotateInvite({ teamId: team.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("names, leaving and withdrawing", () => {
    it("lets the captain rename the team, and go back to the generated name", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const mate = await person("Sam", "Lopez");
      const team = await captain.api.registration.register({ eventId });
      await mate.api.registration.join({ code: team.inviteCode! });

      expect(await captain.api.registration.rename({ teamId: team.id, name: " Net Gains " })).toMatchObject({ name: "Net Gains", usesDefaultName: false });
      expect(await captain.api.registration.rename({ teamId: team.id })).toMatchObject({ name: "Kim/Lopez", usesDefaultName: true });
    });

    it("keeps renaming to the captain, and refuses everyone else", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const mate = await person("Sam", "Lopez");
      const stranger = await person("Rae", "Stranger");
      const team = await captain.api.registration.register({ eventId });
      await mate.api.registration.join({ code: team.inviteCode! });
      await expect(mate.api.registration.rename({ teamId: team.id, name: "Mine" })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(stranger.api.registration.rename({ teamId: team.id, name: "Mine" })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await teamOf(team.id)).name).toBe("Kim/Lopez");
    });

    it("lets a teammate leave, which updates a generated name, but not the captain", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const mate = await person("Sam", "Lopez");
      const team = await captain.api.registration.register({ eventId });
      await mate.api.registration.join({ code: team.inviteCode! });

      await expect(captain.api.registration.leave({ teamId: team.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await mate.api.registration.leave({ teamId: team.id });
      expect((await teamOf(team.id)).name).toBe("Kim");
      // A free person can join again, and a stranger has nothing to leave.
      await expect(mate.api.registration.leave({ teamId: team.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(mate.api.registration.join({ code: team.inviteCode! })).resolves.toBeTruthy();
    });

    it("withdraws the whole team: members are freed, the team is marked, and it can't happen twice", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const mate = await person("Sam", "Lopez");
      const team = await captain.api.registration.register({ eventId });
      await mate.api.registration.join({ code: team.inviteCode! });

      await expect(mate.api.registration.withdraw({ teamId: team.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await captain.api.registration.withdraw({ teamId: team.id });
      expect(await teamOf(team.id)).toMatchObject({ status: "WITHDRAWN", inviteCode: null });
      expect(await prisma.teamMember.count({ where: { teamId: team.id } })).toBe(0);
      await expect(captain.api.registration.withdraw({ teamId: team.id })).rejects.toMatchObject({ code: "NOT_FOUND" }); // no longer a member

      // Both are free to register again.
      await expect(captain.api.registration.register({ eventId })).resolves.toBeTruthy();
      await expect(mate.api.registration.register({ eventId })).resolves.toBeTruthy();
    });
  });

  describe("entry cap and waitlist", () => {
    it("waitlists a team once the event is full, and promotes it when a place opens", async () => {
      const eventId = await newEvent({ entryCap: 2 });
      const [a, b, c] = [await person("Ann", "Aa"), await person("Bo", "Bb"), await person("Cy", "Cc")];
      const teamA = await a.api.registration.register({ eventId });
      const teamB = await b.api.registration.register({ eventId });
      const teamC = await c.api.registration.register({ eventId });
      expect([teamA.status, teamB.status, teamC.status]).toEqual(["REGISTERED", "REGISTERED", "WAITLISTED"]);

      expect(await a.api.registration.withdraw({ teamId: teamA.id })).toEqual({ promoted: [teamC.id] });
      expect((await teamOf(teamC.id)).status).toBe("REGISTERED");
    });

    it("promotes the longest-waiting team first", async () => {
      const eventId = await newEvent({ entryCap: 1 });
      const [a, b, c] = [await person("Ann", "Aa"), await person("Bo", "Bb"), await person("Cy", "Cc")];
      const teamA = await a.api.registration.register({ eventId });
      const teamB = await b.api.registration.register({ eventId });
      const teamC = await c.api.registration.register({ eventId });
      await a.api.registration.withdraw({ teamId: teamA.id });
      expect((await teamOf(teamB.id)).status).toBe("REGISTERED");
      expect((await teamOf(teamC.id)).status).toBe("WAITLISTED");
    });

    it("promotes nobody when a waitlisted team withdraws", async () => {
      const eventId = await newEvent({ entryCap: 1 });
      const [a, b, c] = [await person("Ann", "Aa"), await person("Bo", "Bb"), await person("Cy", "Cc")];
      await a.api.registration.register({ eventId });
      const teamB = await b.api.registration.register({ eventId });
      const teamC = await c.api.registration.register({ eventId });
      expect(await b.api.registration.withdraw({ teamId: teamB.id })).toEqual({ promoted: [] });
      expect((await teamOf(teamC.id)).status).toBe("WAITLISTED");
    });

    it("promotes waitlisted teams when the organizer raises or removes the cap", async () => {
      const eventId = await newEvent({ entryCap: 1 });
      const people = await Promise.all([person("A", "Aa"), person("B", "Bb"), person("C", "Cc"), person("D", "Dd")]);
      const teams = [];
      for (const p of people) teams.push(await p.api.registration.register({ eventId }));
      expect(teams.map((t) => t.status)).toEqual(["REGISTERED", "WAITLISTED", "WAITLISTED", "WAITLISTED"]);

      await organizer.api.event.update({ id: eventId, entryCap: 2 });
      expect((await prisma.team.findMany({ where: { eventId }, orderBy: { createdAt: "asc" } })).map((t) => t.status)).toEqual(["REGISTERED", "REGISTERED", "WAITLISTED", "WAITLISTED"]);

      await organizer.api.event.update({ id: eventId, entryCap: null });
      expect((await prisma.team.findMany({ where: { eventId } })).every((t) => t.status === "REGISTERED")).toBe(true);
    });

    it("lets only one of two teams racing for the last place have it", async () => {
      for (let round = 0; round < 4; round++) {
        const eventId = await newEvent({ entryCap: 1 });
        const [x, y] = [await person("Xa", "Xx"), await person("Yb", "Yy")];
        await Promise.all([x.api.registration.register({ eventId }), y.api.registration.register({ eventId })]);
        const statuses = (await prisma.team.findMany({ where: { eventId } })).map((t) => t.status).sort();
        expect(statuses).toEqual(["REGISTERED", "WAITLISTED"]);
      }
    });

    it("seeds only the teams that hold a place", async () => {
      const eventId = await newEvent({ entryCap: 2 });
      const people = await Promise.all([person("A", "Aa"), person("B", "Bb"), person("C", "Cc")]);
      for (const p of people) await p.api.registration.register({ eventId });
      const { stageId } = await organizer.api.event.generateBracket({ eventId, format: "single" });
      expect(await prisma.match.count({ where: { stageId } })).toBe(1); // two teams, one match
    });
  });

  describe("what each person can see", () => {
    it("shows a captain their invite link and their team, and a teammate the team without it", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const mate = await person("Sam", "Lopez");
      const team = await captain.api.registration.register({ eventId });
      await mate.api.registration.join({ code: team.inviteCode! });

      const asCaptain = await captain.api.registration.mine({ eventId });
      expect(asCaptain).toMatchObject({ role: "CAPTAIN", inviteCode: team.inviteCode, team: { id: team.id, name: "Kim/Lopez" } });
      expect(asCaptain!.team.members.map((m) => [m.role, m.user.name])).toEqual([["CAPTAIN", "Alex Kim"], ["PLAYER", "Sam Lopez"]]);

      const asMate = await mate.api.registration.mine({ eventId });
      expect(asMate).toMatchObject({ role: "PLAYER", inviteCode: null, team: { id: team.id } });
      expect(JSON.stringify(asMate)).not.toContain(team.inviteCode!);
    });

    it("has nothing for someone who isn't on a team, and needs a signed-in user", async () => {
      const eventId = await newEvent();
      const nobody = await person("No", "Body");
      expect(await nobody.api.registration.mine({ eventId })).toBeNull();
      await expect(as(null).registration.mine({ eventId })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("never puts an invite code in a public response or an organizer's", async () => {
      const eventId = await newEvent();
      const captain = await person("Alex", "Kim");
      const team = await captain.api.registration.register({ eventId });
      const code = team.inviteCode!;

      const listing = await as(null).team.getByEvent({ eventId });
      expect(listing.map((t) => t.id)).toContain(team.id);
      expect(JSON.stringify(listing)).not.toContain(code);
      expect(JSON.stringify(await as(null).event.getById({ id: eventId }))).not.toContain(code);
      expect(JSON.stringify(await organizer.api.team.update({ id: team.id, name: "Renamed by organizer" }))).not.toContain(code);
      expect(JSON.stringify(await organizer.api.team.getByEvent({ eventId }))).not.toContain(code);
    });

    it("still lets an organizer add teams by hand, with no invite link", async () => {
      const eventId = await newEvent();
      const made = await organizer.api.team.create({ eventId, name: "Walk-ups" });
      expect(await teamOf(made.id)).toMatchObject({ name: "Walk-ups", inviteCode: null, usesDefaultName: false });
    });
  });
});
