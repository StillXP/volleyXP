import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { assertMatchOwner, assertStageOwner } from "../ownership";
import { completeByForfeit, recordGameScore, reopenMatch } from "../matchScoring";
import { MatchStatus } from "../../generated/prisma/client";

const matchInclude = {
  team1: true,
  team2: true,
  winner: true,
  court: true,
  games: { orderBy: { gameNumber: "asc" as const } },
} as const;

export const matchRouter = router({
  getByStage: publicProcedure
    .input(z.object({ stageId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.match.findMany({
        where: { stageId: input.stageId },
        include: matchInclude,
        orderBy: [{ bracketRound: "asc" }, { bracketPosition: "asc" }, { scheduledTime: "asc" }],
      })
    ),

  getByEvent: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.match.findMany({
        where: { stage: { eventId: input.eventId } },
        include: { ...matchInclude, stage: true, pool: true },
        orderBy: [{ scheduledTime: "asc" }, { createdAt: "asc" }],
      })
    ),

  create: protectedProcedure
    .input(
      z.object({
        stageId: z.string(),
        poolId: z.string().optional(),
        team1Id: z.string().optional(),
        team2Id: z.string().optional(),
        courtId: z.string().optional(),
        scheduledTime: z.string().datetime().optional(),
        bracketRound: z.string().optional(),
        bracketPosition: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertStageOwner(ctx.prisma, ctx.userId, input.stageId);

      // Teams must belong to the event this stage is part of.
      const teamIds = [...new Set([input.team1Id, input.team2Id].filter((id): id is string => !!id))];
      if (teamIds.length > 0) {
        const valid = await ctx.prisma.team.count({
          where: { id: { in: teamIds }, event: { stages: { some: { id: input.stageId } } } },
        });
        if (valid !== teamIds.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Teams must belong to this stage's event" });
        }
      }

      // A pool must belong to this stage, which must be one that has pools.
      if (input.poolId) {
        const validPool = await ctx.prisma.pool.count({
          where: { id: input.poolId, stageId: input.stageId, stage: { type: { in: ["POOL_PLAY", "ROUND_ROBIN"] } } },
        });
        if (!validPool) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pool must belong to this pool-play or round-robin stage" });
        }
        // Pool matches are only between teams drawn into that pool.
        if (teamIds.length > 0) {
          const inPool = await ctx.prisma.poolTeam.count({ where: { poolId: input.poolId, teamId: { in: teamIds } } });
          if (inPool !== teamIds.length) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Teams must be assigned to this pool" });
          }
        }
      }

      // A court must be one of the courts allocated to this stage's event.
      if (input.courtId) {
        const allocated = await ctx.prisma.eventCourt.count({
          where: { courtId: input.courtId, event: { stages: { some: { id: input.stageId } } } },
        });
        if (!allocated) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Court is not allocated to this event" });
        }
      }

      const { scheduledTime, ...rest } = input;
      return ctx.prisma.match.create({
        data: { ...rest, scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined },
        include: matchInclude,
      });
    }),

  // Starts or cancels a match, or puts one back to scheduled. A match is completed by
  // scoring it (recordGame) or by complete; reopen undoes a forfeit.
  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(MatchStatus) }))
    .mutation(async ({ ctx, input }) => {
      const match = await assertMatchOwner(ctx.prisma, ctx.userId, input.id);
      if (input.status === "COMPLETED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Score the match, or use complete for a forfeit, to finish it" });
      }
      if (match.status === "COMPLETED") {
        throw new TRPCError({ code: "CONFLICT", message: "This match is completed. Edit its last game or reopen it." });
      }
      const data = input.status === "IN_PROGRESS" ? { status: input.status, actualStartTime: new Date() } : { status: input.status };
      return ctx.prisma.match.update({ where: { id: input.id }, data });
    }),

  // Records a game's score, which may be a game still being played (call it again as
  // points are scored). Finishing a game that wins the match completes the match and
  // moves the winner, and in double elimination the loser, into their next matches.
  recordGame: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        gameNumber: z.number().int().min(1),
        team1Score: z.number().int().min(0),
        team2Score: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertMatchOwner(ctx.prisma, ctx.userId, input.matchId);
      await ctx.prisma.$transaction((tx) => recordGameScore(tx, input));
      return ctx.prisma.match.findUniqueOrThrow({ where: { id: input.matchId }, include: matchInclude });
    }),

  // Ends a match without playing it out (a forfeit or walkover) and moves the players on.
  complete: protectedProcedure
    .input(z.object({ id: z.string(), winnerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertMatchOwner(ctx.prisma, ctx.userId, input.id);
      await ctx.prisma.$transaction((tx) => completeByForfeit(tx, { matchId: input.id, winnerId: input.winnerId }));
      return ctx.prisma.match.findUniqueOrThrow({ where: { id: input.id }, include: matchInclude });
    }),

  // Undoes a forfeit. To change a result decided by games, edit its last game instead.
  reopen: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertMatchOwner(ctx.prisma, ctx.userId, input.id);
      await ctx.prisma.$transaction((tx) => reopenMatch(tx, input.id));
      return ctx.prisma.match.findUniqueOrThrow({ where: { id: input.id }, include: matchInclude });
    }),
});
