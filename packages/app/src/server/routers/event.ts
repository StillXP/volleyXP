import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { assertEventOwner, assertTournamentOwner } from "../ownership";
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
