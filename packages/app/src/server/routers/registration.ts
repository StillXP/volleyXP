import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { defaultTeamName } from "../../lib/teamName";
import {
  assertCaptain,
  assertNotOnATeam,
  beforeBracket,
  conflict,
  countedTeams,
  lockEvent,
  newInviteCode,
  notFound,
  promoteWaitlist,
  refreshDefaultName,
  registrationOpen,
} from "../registration";

const teamName = z.string().trim().min(1).max(60);

/**
 * Teams signing themselves up. A captain registers a team and shares an invite link;
 * teammates open it, sign in, and join. Everything that changes a roster takes the
 * event's lock first (see lockEvent) and is refused once the bracket exists.
 */
export const registrationRouter = router({
  // What the join page shows before anyone signs in. The link is the secret, and this
  // reveals only what the person following it needs.
  getInvite: publicProcedure.input(z.object({ code: z.string().min(1) })).query(async ({ ctx, input }) => {
    const team = await ctx.prisma.team.findUnique({
      where: { inviteCode: input.code },
      select: {
        name: true,
        status: true,
        members: { orderBy: [{ role: "asc" }, { id: "asc" }], select: { role: true, user: { select: { name: true } } } },
        event: { select: { id: true, name: true, teamSize: true, status: true, tournament: { select: { id: true, name: true } } } },
      },
    });
    if (!team || team.status === "WITHDRAWN") throw notFound("This invite link isn't valid any more");
    return {
      teamName: team.name,
      captain: team.members.find((m) => m.role === "CAPTAIN")?.user.name ?? null,
      spotsLeft: Math.max(0, team.event.teamSize - team.members.length),
      registrationOpen: registrationOpen(team.event),
      event: { id: team.event.id, name: team.event.name, tournament: team.event.tournament },
    };
  }),

  // The caller's own team in an event, with the invite code if they captain it.
  mine: protectedProcedure.input(z.object({ eventId: z.string() })).query(async ({ ctx, input }) => {
    const member = await ctx.prisma.teamMember.findUnique({
      where: { eventId_userId: { eventId: input.eventId, userId: ctx.userId } },
      select: {
        role: true,
        team: {
          select: {
            id: true,
            name: true,
            status: true,
            usesDefaultName: true,
            inviteCode: true,
            members: { orderBy: [{ role: "asc" }, { id: "asc" }], select: { role: true, user: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!member) return null;
    const { inviteCode, ...team } = member.team;
    return { role: member.role, team, inviteCode: member.role === "CAPTAIN" ? inviteCode : null };
  }),

  register: protectedProcedure
    .input(z.object({ eventId: z.string(), name: teamName.optional() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const event = await lockEvent(tx, input.eventId);
        if (!registrationOpen(event)) throw conflict("Registration isn't open for this event");
        await assertNotOnATeam(tx, event.id, ctx.userId);

        const user = await tx.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { firstName: true, lastName: true } });
        const full = event.entryCap !== null && (await countedTeams(tx, event.id)) >= event.entryCap;
        const team = await tx.team.create({
          data: {
            eventId: event.id,
            name: input.name ?? defaultTeamName([user]),
            usesDefaultName: !input.name,
            status: full ? "WAITLISTED" : "REGISTERED",
            inviteCode: newInviteCode(),
            members: { create: { userId: ctx.userId, eventId: event.id, role: "CAPTAIN" } },
          },
          select: { id: true, name: true, status: true, inviteCode: true },
        });
        return team;
      })
    ),

  join: protectedProcedure.input(z.object({ code: z.string().min(1) })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const found = await tx.team.findUnique({ where: { inviteCode: input.code }, select: { id: true, eventId: true } });
      if (!found) throw notFound("This invite link isn't valid any more");

      const event = await lockEvent(tx, found.eventId);
      // Look again now that nobody else can change it.
      const team = await tx.team.findUnique({ where: { id: found.id }, select: { id: true, status: true, inviteCode: true } });
      if (!team || team.status === "WITHDRAWN" || team.inviteCode !== input.code) throw notFound("This invite link isn't valid any more");
      if (!registrationOpen(event)) throw conflict("Registration isn't open for this event");
      await assertNotOnATeam(tx, event.id, ctx.userId);
      if ((await tx.teamMember.count({ where: { teamId: team.id } })) >= event.teamSize) throw conflict("This team is already full");

      await tx.teamMember.create({ data: { teamId: team.id, eventId: event.id, userId: ctx.userId, role: "PLAYER" } });
      await refreshDefaultName(tx, team.id);
      return { teamId: team.id, eventId: event.id };
    })
  ),

  // A teammate stepping off. The captain withdraws the team instead.
  leave: protectedProcedure.input(z.object({ teamId: z.string() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({ where: { id: input.teamId }, select: { eventId: true } });
      if (!team) throw notFound("Team not found");
      const event = await lockEvent(tx, team.eventId);
      const member = await tx.teamMember.findFirst({ where: { teamId: input.teamId, userId: ctx.userId }, select: { id: true, role: true } });
      if (!member) throw notFound("Team not found");
      if (member.role === "CAPTAIN") throw new TRPCError({ code: "BAD_REQUEST", message: "The captain can't leave; withdraw the team instead" });
      if (!registrationOpen(event)) throw conflict("Registration is closed, so the roster can't change");

      await tx.teamMember.delete({ where: { id: member.id } });
      await refreshDefaultName(tx, input.teamId);
    })
  ),

  // Gives the team a name, or goes back to the generated one when the name is left out.
  rename: protectedProcedure
    .input(z.object({ teamId: z.string(), name: teamName.optional() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const owned = await assertCaptain(tx, input.teamId, ctx.userId);
        const event = await lockEvent(tx, owned.eventId);
        if (!beforeBracket(event) || owned.status === "WITHDRAWN") throw conflict("This team can't be renamed any more");

        if (input.name) {
          await tx.team.update({ where: { id: owned.id }, data: { name: input.name, usesDefaultName: false } });
        } else {
          await tx.team.update({ where: { id: owned.id }, data: { usesDefaultName: true } });
          await refreshDefaultName(tx, owned.id);
        }
        return tx.team.findUniqueOrThrow({ where: { id: owned.id }, select: { id: true, name: true, usesDefaultName: true } });
      })
    ),

  // Pulls the whole team out: its members are freed, the link stops working, and the
  // first waitlisted team takes the place if this one held one.
  withdraw: protectedProcedure.input(z.object({ teamId: z.string() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const owned = await assertCaptain(tx, input.teamId, ctx.userId);
      const event = await lockEvent(tx, owned.eventId);
      if (!beforeBracket(event)) throw conflict("The bracket has been made, so the team can't withdraw here");
      if (owned.status === "WITHDRAWN") throw conflict("This team has already withdrawn");

      const heldAPlace = owned.status === "REGISTERED" || owned.status === "CHECKED_IN";
      await tx.team.update({ where: { id: owned.id }, data: { status: "WITHDRAWN", inviteCode: null } });
      await tx.teamMember.deleteMany({ where: { teamId: owned.id } });
      const promoted = heldAPlace ? await promoteWaitlist(tx, event.id, event.entryCap) : [];
      return { promoted };
    })
  ),

  // A new link, for when the old one has gone further than it should.
  rotateInvite: protectedProcedure.input(z.object({ teamId: z.string() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const owned = await assertCaptain(tx, input.teamId, ctx.userId);
      const event = await lockEvent(tx, owned.eventId);
      if (!registrationOpen(event) || owned.status === "WITHDRAWN") throw conflict("Registration isn't open for this team");
      const team = await tx.team.update({ where: { id: owned.id }, data: { inviteCode: newInviteCode() }, select: { inviteCode: true } });
      return { inviteCode: team.inviteCode! };
    })
  ),
});
