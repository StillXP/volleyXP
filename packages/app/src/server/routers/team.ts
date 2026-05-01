import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const teamRouter = router({
  create: protectedProcedure
    .input(z.object({ tournamentId: z.string(), name: z.string().min(1), seed: z.number().optional() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.team.create({ data: input })
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).optional(), seed: z.number().optional() }))
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
