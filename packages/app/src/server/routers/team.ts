import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TeamStatus } from "../../generated/prisma/client";

export const teamRouter = router({
  getByEvent: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.team.findMany({
        where: { eventId: input.eventId },
        include: { members: { include: { user: true } } },
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
    .mutation(({ ctx, input }) =>
      ctx.prisma.team.create({
        data: input,
        include: { members: { include: { user: true } } },
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        seed: z.number().int().optional(),
        status: z.nativeEnum(TeamStatus).optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.team.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.team.delete({ where: { id: input.id } })
    ),
});
