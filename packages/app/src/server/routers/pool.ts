import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { assertPoolOwner, assertStageOwner } from "../ownership";

const conflict = (message: string) => new TRPCError({ code: "CONFLICT", message });

export const poolRouter = router({
  getByStage: publicProcedure
    .input(z.object({ stageId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.pool.findMany({
        where: { stageId: input.stageId },
        include: { teams: { include: { team: true }, orderBy: { seed: "asc" } } },
        orderBy: { name: "asc" },
      })
    ),

  create: protectedProcedure
    .input(z.object({ stageId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const stage = await assertStageOwner(ctx.prisma, ctx.userId, input.stageId);
      if (stage.type !== "POOL_PLAY" && stage.type !== "ROUND_ROBIN") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only pool-play and round-robin stages have pools" });
      }
      return ctx.prisma.pool.create({ data: input });
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertPoolOwner(ctx.prisma, ctx.userId, input.id);
      return ctx.prisma.pool.update({ where: { id: input.id }, data: { name: input.name } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertPoolOwner(ctx.prisma, ctx.userId, input.id);
      // Deleting a pool would detach its matches rather than remove them.
      const matches = await ctx.prisma.match.count({ where: { poolId: input.id } });
      if (matches > 0) throw conflict("This pool has matches and can't be deleted");
      return ctx.prisma.pool.delete({ where: { id: input.id } });
    }),

  // Adds a team to a pool, or updates its seed if it's already there.
  assignTeam: protectedProcedure
    .input(z.object({ poolId: z.string(), teamId: z.string(), seed: z.number().int().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const pool = await assertPoolOwner(ctx.prisma, ctx.userId, input.poolId);

      const sameEvent = await ctx.prisma.team.count({
        where: { id: input.teamId, event: { stages: { some: { id: pool.stageId } } } },
      });
      if (!sameEvent) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Team must belong to this stage's event" });
      }

      // A team plays in one pool per stage.
      const elsewhere = await ctx.prisma.poolTeam.count({
        where: { teamId: input.teamId, poolId: { not: input.poolId }, pool: { stageId: pool.stageId } },
      });
      if (elsewhere > 0) throw conflict("Team is already in another pool in this stage");

      const { poolId, teamId, seed } = input;
      return ctx.prisma.poolTeam.upsert({
        where: { poolId_teamId: { poolId, teamId } },
        update: { seed },
        create: { poolId, teamId, seed },
      });
    }),

  removeTeam: protectedProcedure
    .input(z.object({ poolId: z.string(), teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertPoolOwner(ctx.prisma, ctx.userId, input.poolId);
      const played = await ctx.prisma.match.count({
        where: { poolId: input.poolId, OR: [{ team1Id: input.teamId }, { team2Id: input.teamId }] },
      });
      if (played > 0) throw conflict("Team has matches in this pool and can't be removed");
      return ctx.prisma.poolTeam.deleteMany({ where: { poolId: input.poolId, teamId: input.teamId } });
    }),
});
