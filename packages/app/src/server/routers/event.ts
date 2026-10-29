import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { assertEventOwner, assertTournamentOwner } from "../ownership";
import { planBracket, type SlotSource } from "../bracketPlan";
import { EventStatus } from "../../generated/prisma/client";

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
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.event.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          stages: { orderBy: { order: "asc" }, include: { pools: true } },
          courts: { include: { court: true } },
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
        status: z.nativeEnum(EventStatus).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertEventOwner(ctx.prisma, ctx.userId, id);
      return ctx.prisma.event.update({ where: { id }, data });
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

    // Ids are chosen up front so matches can point at teams and at each other in one write.
    const teams = input.teams.map((name, i) => ({ id: randomUUID(), name, seed: i + 1 }));
    const plan = planBracket(teams, input.format);
    const matchIds = new Map(plan.map((m) => [m.key, randomUUID()]));
    const teamId = (source: SlotSource) => (source.kind === "team" ? source.teamId : null);
    const double = input.format === "double";

    return ctx.prisma.$transaction(async (tx) => {
      const tournamentId =
        input.tournamentId ?? (await tx.tournament.create({ data: { name: input.tournamentName!, ownerId: ctx.userId } })).id;
      const event = await tx.event.create({ data: { ...input.event, tournamentId } });
      await tx.team.createMany({ data: teams.map((t) => ({ ...t, eventId: event.id })) });
      const stage = await tx.stage.create({
        data: {
          eventId: event.id,
          order: 1,
          name: double ? "Double Elimination" : "Single Elimination",
          type: double ? "DOUBLE_ELIM" : "SINGLE_ELIM",
        },
      });
      await tx.match.createMany({
        data: plan.map((m) => ({
          id: matchIds.get(m.key)!,
          stageId: stage.id,
          bracketKey: m.key,
          bracketRound: m.bracketRound,
          bracketPosition: m.bracketPosition,
          team1Id: teamId(m.team1),
          team2Id: teamId(m.team2),
          nextWinnerMatchId: m.winnerTo ? matchIds.get(m.winnerTo.matchKey)! : null,
          nextWinnerSlot: m.winnerTo?.slot ?? null,
          nextLoserMatchId: m.loserTo ? matchIds.get(m.loserTo.matchKey)! : null,
          nextLoserSlot: m.loserTo?.slot ?? null,
        })),
      });
      if (input.nets > 0) {
        const nets = Array.from({ length: input.nets }, (_, i) => ({ id: randomUUID(), name: `Net ${i + 1}` }));
        await tx.court.createMany({ data: nets.map((n) => ({ ...n, eventId: event.id })) });
        await tx.eventCourt.createMany({ data: nets.map((n) => ({ eventId: event.id, courtId: n.id })) });
      }
      return { tournamentId, eventId: event.id, stageId: stage.id };
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
