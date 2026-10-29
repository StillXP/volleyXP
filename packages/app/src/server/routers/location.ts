import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { assertLocationOwner } from "../ownership";

const conflict = (message: string) => new TRPCError({ code: "CONFLICT", message });

export const locationRouter = router({
  // The caller's venues with their fixed courts; temporary event courts aren't part of a venue.
  listMine: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.location.findMany({
      where: { ownerId: ctx.userId },
      include: { courts: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    })
  ),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), address: z.string().optional(), notes: z.string().optional() }))
    .mutation(({ ctx, input }) => ctx.prisma.location.create({ data: { ...input, ownerId: ctx.userId } })),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        // Null clears it.
        address: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertLocationOwner(ctx.prisma, ctx.userId, id);
      return ctx.prisma.location.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertLocationOwner(ctx.prisma, ctx.userId, input.id);
      // Deleting would detach tournaments and drop courts that matches are scheduled on.
      const tournaments = await ctx.prisma.tournament.count({ where: { locationId: input.id } });
      if (tournaments > 0) throw conflict("This venue is used by a tournament and can't be deleted");
      const matches = await ctx.prisma.match.count({ where: { court: { locationId: input.id } } });
      if (matches > 0) throw conflict("Matches are scheduled on this venue's courts");
      return ctx.prisma.location.delete({ where: { id: input.id } });
    }),
});
