import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { assertEventOwner, assertTournamentOwner } from "../ownership";
import { writeBracket } from "../bracketWrite";
import { conflict, lockEvent, promoteWaitlist } from "../registration";

// A best-of series needs an odd number of games so it can't end level.
const bestOf = z.number().int().min(1).max(7).refine((n) => n % 2 === 1, "bestOf must be odd");

const settings = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  // players per team: 2=doubles, 4=quads, 6=sixes
  teamSize: z.number().int().min(1),
  entryCap: z.number().int().min(1).optional(),
  bestOf: bestOf.optional(),
  pointsToWin: z.number().int().min(1).optional(),
  pointsToWinLastGame: z.number().int().min(1).optional(),
});

const createWithBracketInput = z
  .object({
    // Add the event to one of your tournaments, or name a new one to create it.
    tournamentId: z.string().optional(),
    tournamentName: z.string().trim().min(1).optional(),
    event: settings.extend({ teamSize: settings.shape.teamSize.default(2) }),
    // Team names in seed order: the first name is seed 1.
    teams: z.array(z.string().trim().min(1)).min(2).max(64),
    format: z.enum(["single", "double"]),
    // Temporary courts ("Net 1".."Net N") to set up for the event.
    nets: z.number().int().min(0).max(64).default(0),
  })
  .refine((v) => !!v.tournamentId !== !!v.tournamentName, "Give either tournamentId or tournamentName");

export const eventRouter = router({
  // A narrow select, not an include: Prisma's inferred type for the nested include is
  // deep enough to hit TypeScript's instantiation limit in the client.
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.event.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          description: true,
          teamSize: true,
          entryCap: true,
          status: true,
          bestOf: true,
          pointsToWin: true,
          pointsToWinLastGame: true,
          tournament: { select: { id: true, name: true, ownerId: true } },
          stages: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, order: true, type: true, advancementCount: true, pools: { select: { id: true, name: true } } },
          },
          courts: { select: { court: { select: { id: true, name: true, surface: true } } } },
          _count: { select: { teams: true } },
        },
      })
    ),

  create: protectedProcedure
    .input(settings.extend({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertTournamentOwner(ctx.prisma, ctx.userId, input.tournamentId);
      return ctx.prisma.event.create({ data: input });
    }),

  update: protectedProcedure
    .input(
      settings.partial().extend({
        id: z.string(),
        // Null clears an optional setting.
        entryCap: z.number().int().min(1).nullable().optional(),
        pointsToWinLastGame: z.number().int().min(1).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertEventOwner(ctx.prisma, ctx.userId, id);
      if (data.entryCap === undefined) return ctx.prisma.event.update({ where: { id }, data });

      // A new cap can free places, so move waitlisted teams up under the registration lock.
      return ctx.prisma.$transaction(async (tx) => {
        await lockEvent(tx, id);
        const event = await tx.event.update({ where: { id }, data });
        await promoteWaitlist(tx, id, event.entryCap);
        return event;
      });
    }),

  // Opens or closes registration. Once the bracket exists the event has moved on, and
  // registration can't be reopened.
  setRegistration: protectedProcedure
    .input(z.object({ id: z.string(), open: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertEventOwner(ctx.prisma, ctx.userId, input.id);
      return ctx.prisma.$transaction(async (tx) => {
        const event = await lockEvent(tx, input.id);
        if (event.status === "IN_PROGRESS" || event.status === "COMPLETED") {
          throw conflict("The bracket has been made, so registration can't change");
        }
        const status = input.open ? "REGISTRATION" : "SEEDING";
        if (event.status === status) return tx.event.findUniqueOrThrow({ where: { id: input.id }, select: { id: true, status: true } });
        if (!input.open && event.status !== "REGISTRATION") throw conflict("Registration isn't open");
        return tx.event.update({ where: { id: input.id }, data: { status }, select: { id: true, status: true } });
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertEventOwner(ctx.prisma, ctx.userId, input.id);
      const games = await ctx.prisma.game.count({ where: { match: { stage: { eventId: input.id } } } });
      if (games > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "This event has recorded games and can't be deleted" });
      }
      return ctx.prisma.event.delete({ where: { id: input.id } });
    }),

  // Creates an event with its teams, a single- or double-elimination stage and every
  // match in the bracket, wired so winners and losers advance. All or nothing.
  createWithBracket: protectedProcedure.input(createWithBracketInput).mutation(async ({ ctx, input }) => {
    if (input.tournamentId) await assertTournamentOwner(ctx.prisma, ctx.userId, input.tournamentId);
    if (input.event.entryCap && input.teams.length > input.event.entryCap) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "More teams than the event's entry cap" });
    }

    const teams = input.teams.map((name, i) => ({ id: randomUUID(), name, seed: i + 1 }));

    return ctx.prisma.$transaction(async (tx) => {
      const tournamentId =
        input.tournamentId ?? (await tx.tournament.create({ data: { name: input.tournamentName!, ownerId: ctx.userId } })).id;
      const event = await tx.event.create({ data: { ...input.event, tournamentId, status: "IN_PROGRESS" } });
      await tx.team.createMany({ data: teams.map((t) => ({ ...t, eventId: event.id })) });
      const { stageId } = await writeBracket(tx, { eventId: event.id, teams, format: input.format, order: 1 });
      if (input.nets > 0) {
        const nets = Array.from({ length: input.nets }, (_, i) => ({ id: randomUUID(), name: `Net ${i + 1}` }));
        await tx.court.createMany({ data: nets.map((n) => ({ ...n, eventId: event.id })) });
        await tx.eventCourt.createMany({ data: nets.map((n) => ({ eventId: event.id, courtId: n.id })) });
      }
      return { tournamentId, eventId: event.id, stageId };
    });
  }),

  // Builds the bracket from the event's current teams, seeded in their existing order
  // (unseeded teams last, oldest first). Withdrawn and waitlisted teams sit out. To
  // redo it, delete the bracket stage first, which is only allowed before games are played.
  generateBracket: protectedProcedure
    .input(z.object({ eventId: z.string(), format: z.enum(["single", "double"]) }))
    .mutation(async ({ ctx, input }) => {
      await assertEventOwner(ctx.prisma, ctx.userId, input.eventId);
      return ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.stage.findFirst({
          where: { eventId: input.eventId, type: { in: ["SINGLE_ELIM", "DOUBLE_ELIM"] } },
          select: { id: true },
        });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "This event already has a bracket. Delete it to generate a new one." });
        }

        const teams = await tx.team.findMany({
          where: { eventId: input.eventId, status: { in: ["REGISTERED", "CHECKED_IN"] } },
          orderBy: [{ seed: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        });
        if (teams.length < 2 || teams.length > 64) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A bracket needs between 2 and 64 teams" });
        }

        // Settle on seeds 1..N so the bracket and the teams agree.
        const seeded = teams.map((t, i) => ({ id: t.id, name: t.name, seed: i + 1 }));
        for (const team of seeded) {
          if (teams.find((t) => t.id === team.id)!.seed !== team.seed) {
            await tx.team.update({ where: { id: team.id }, data: { seed: team.seed } });
          }
        }

        const last = await tx.stage.aggregate({ where: { eventId: input.eventId }, _max: { order: true } });
        const bracket = await writeBracket(tx, { eventId: input.eventId, teams: seeded, format: input.format, order: (last._max.order ?? 0) + 1 });
        // The bracket closes registration for good.
        await tx.event.update({ where: { id: input.eventId }, data: { status: "IN_PROGRESS" } });
        return bracket;
      });
    }),

  // Sets which fixed (venue) courts the event uses. Temporary courts are managed
  // through the court router and are left alone here.
  setCourts: protectedProcedure
    .input(z.object({ eventId: z.string(), courtIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await assertEventOwner(ctx.prisma, ctx.userId, input.eventId);
      const courtIds = [...new Set(input.courtIds)];

      // Every court must be a fixed court at a venue the caller owns.
      const owned = await ctx.prisma.court.count({
        where: { id: { in: courtIds }, location: { ownerId: ctx.userId } },
      });
      if (owned !== courtIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Courts must belong to a venue you own" });
      }

      // A court that already has matches at this event can't be dropped.
      const inUse = await ctx.prisma.match.count({
        where: {
          stage: { eventId: input.eventId },
          court: { locationId: { not: null } },
          courtId: { notIn: courtIds },
        },
      });
      if (inUse > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Some courts being removed have matches assigned" });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.eventCourt.deleteMany({
          where: { eventId: input.eventId, court: { locationId: { not: null } }, courtId: { notIn: courtIds } },
        }),
        ctx.prisma.eventCourt.createMany({
          data: courtIds.map((courtId) => ({ eventId: input.eventId, courtId })),
          skipDuplicates: true,
        }),
      ]);
      return ctx.prisma.eventCourt.findMany({ where: { eventId: input.eventId }, include: { court: true } });
    }),
});
