import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { assertEventOwner, assertTeamOwner } from "../ownership";
import { TeamStatus } from "../../generated/prisma/client";

// Public responses never include a member's email.
const members = { include: { user: { select: { id: true, name: true } } } } as const;

export const teamRouter = router({
  getByEvent: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.team.findMany({
        where: { eventId: input.eventId },
        include: { members },
        orderBy: [{ seed: "asc" }, { name: "asc" }],
      })
    ),

  create: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        name: z.string().min(1),
        seed: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertEventOwner(ctx.prisma, ctx.userId, input.eventId);
      return ctx.prisma.team.create({ data: input, include: { members } });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        seed: z.number().int().optional(),
        status: z.nativeEnum(TeamStatus).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertTeamOwner(ctx.prisma, ctx.userId, id);
      return ctx.prisma.team.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertTeamOwner(ctx.prisma, ctx.userId, input.id);
      return ctx.prisma.team.delete({ where: { id: input.id } });
    }),
});
