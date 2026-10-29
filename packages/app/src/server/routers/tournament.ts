import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { assertLocationOwner, assertTournamentOwner } from "../ownership";
import { TournamentStatus } from "../../generated/prisma/client";

// Public responses never include the owner's email.
const publicOwner = { select: { id: true, name: true } } as const;

export const tournamentRouter = router({
  getAll: publicProcedure.query(({ ctx }) =>
    ctx.prisma.tournament.findMany({
      include: { owner: publicOwner, location: true, events: true },
      orderBy: { createdAt: "desc" },
    })
  ),

  getMine: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.tournament.findMany({
      where: { ownerId: ctx.userId },
      include: { owner: publicOwner, location: true, events: true },
      orderBy: { createdAt: "desc" },
    })
  ),

  // A narrow select, like event.getById: just what a tournament page shows, with team
  // counts rather than every team, and only the owner's id and name.
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.tournament.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          startDate: true,
          endDate: true,
          owner: publicOwner,
          location: { select: { id: true, name: true, address: true } },
          events: {
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, teamSize: true, bestOf: true, entryCap: true, status: true, _count: { select: { teams: true } } },
          },
        },
      })
    ),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.tournament.create({
        data: { name: input.name, description: input.description, ownerId: ctx.userId },
      });
    }),

  // Links the tournament to one of the caller's venues, or clears it with null.
  setLocation: protectedProcedure
    .input(z.object({ id: z.string(), locationId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await assertTournamentOwner(ctx.prisma, ctx.userId, input.id);
      if (input.locationId) await assertLocationOwner(ctx.prisma, ctx.userId, input.locationId);
      return ctx.prisma.tournament.update({
        where: { id: input.id },
        data: { locationId: input.locationId },
      });
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(TournamentStatus) }))
    .mutation(async ({ ctx, input }) => {
      await assertTournamentOwner(ctx.prisma, ctx.userId, input.id);
      return ctx.prisma.tournament.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertTournamentOwner(ctx.prisma, ctx.userId, input.id);
      return ctx.prisma.tournament.delete({ where: { id: input.id } });
    }),
});
