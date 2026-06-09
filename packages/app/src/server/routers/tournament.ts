import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TournamentStatus } from "../../generated/prisma/client";

export const tournamentRouter = router({
  getAll: publicProcedure.query(({ ctx }) =>
    ctx.prisma.tournament.findMany({
      include: { owner: true, location: true, events: true },
      orderBy: { createdAt: "desc" },
    })
  ),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.tournament.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          owner: true,
          location: { include: { courts: true } },
          events: {
            include: {
              teams: true,
              stages: { orderBy: { order: "asc" } },
              scheduleItems: { orderBy: { scheduledTime: "asc" } },
            },
          },
        },
      })
    ),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { clerkId: ctx.userId } });
      return ctx.prisma.tournament.create({
        data: { name: input.name, description: input.description, ownerId: user.id },
      });
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(TournamentStatus) }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.tournament.update({
        where: { id: input.id },
        data: { status: input.status },
      })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.tournament.delete({ where: { id: input.id } })
    ),
});
