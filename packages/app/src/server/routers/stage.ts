import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { assertEventOwner, assertStageOwner } from "../ownership";
import { StageType } from "../../generated/prisma/client";

const POOL_TYPES: StageType[] = ["POOL_PLAY", "ROUND_ROBIN"];

const conflict = (message: string) => new TRPCError({ code: "CONFLICT", message });

export const stageRouter = router({
  getByEvent: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.stage.findMany({
        where: { eventId: input.eventId },
        include: { pools: { include: { teams: { include: { team: true } } } } },
        orderBy: { order: "asc" },
      })
    ),

  // New stages go at the end; use reorder to move them.
  create: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        name: z.string().min(1),
        type: z.nativeEnum(StageType),
        advancementCount: z.number().int().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertEventOwner(ctx.prisma, ctx.userId, input.eventId);
      const last = await ctx.prisma.stage.aggregate({ where: { eventId: input.eventId }, _max: { order: true } });
      return ctx.prisma.stage.create({ data: { ...input, order: (last._max.order ?? 0) + 1 } });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        type: z.nativeEnum(StageType).optional(),
        // Null clears it (the final stage advances no one).
        advancementCount: z.number().int().min(1).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const stage = await assertStageOwner(ctx.prisma, ctx.userId, id);

      if (data.type && data.type !== stage.type) {
        // Changing format under existing matches or pools would orphan them.
        const matches = await ctx.prisma.match.count({ where: { stageId: id } });
        if (matches > 0) throw conflict("This stage has matches, so its format can't change");
        if (!POOL_TYPES.includes(data.type)) {
          const pools = await ctx.prisma.pool.count({ where: { stageId: id } });
          if (pools > 0) throw conflict("Remove this stage's pools before switching to a bracket format");
        }
      }
      return ctx.prisma.stage.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertStageOwner(ctx.prisma, ctx.userId, input.id);
      const games = await ctx.prisma.game.count({ where: { match: { stageId: input.id } } });
      if (games > 0) throw conflict("This stage has recorded games and can't be deleted");
      return ctx.prisma.stage.delete({ where: { id: input.id } });
    }),

  // stageIds lists every stage of the event in its new order.
  reorder: protectedProcedure
    .input(z.object({ eventId: z.string(), stageIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await assertEventOwner(ctx.prisma, ctx.userId, input.eventId);
      const existing = await ctx.prisma.stage.findMany({ where: { eventId: input.eventId }, select: { id: true } });
      const wanted = new Set(input.stageIds);
      if (wanted.size !== input.stageIds.length || wanted.size !== existing.length || existing.some((s) => !wanted.has(s.id))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "stageIds must list each of the event's stages exactly once" });
      }

      // (eventId, order) is unique, so park every stage on a negative order first
      // to avoid colliding while they swap places.
      await ctx.prisma.$transaction([
        ...input.stageIds.map((id, i) => ctx.prisma.stage.update({ where: { id }, data: { order: -(i + 1) } })),
        ...input.stageIds.map((id, i) => ctx.prisma.stage.update({ where: { id }, data: { order: i + 1 } })),
      ]);
      return ctx.prisma.stage.findMany({ where: { eventId: input.eventId }, orderBy: { order: "asc" } });
    }),
});
