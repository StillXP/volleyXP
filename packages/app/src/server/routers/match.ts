import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
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
    .mutation(({ ctx, input }) => {
      const { scheduledTime, ...rest } = input;
      return ctx.prisma.match.create({
        data: { ...rest, scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined },
        include: matchInclude,
      });
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(MatchStatus) }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.match.update({ where: { id: input.id }, data: { status: input.status } })
    ),

  // Record a single game's scores within a match
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
      const winnerId =
        input.team1Score > input.team2Score
          ? (await ctx.prisma.match.findUniqueOrThrow({ where: { id: input.matchId } })).team1Id
          : (await ctx.prisma.match.findUniqueOrThrow({ where: { id: input.matchId } })).team2Id;

      return ctx.prisma.game.upsert({
        where: { matchId_gameNumber: { matchId: input.matchId, gameNumber: input.gameNumber } },
        update: { team1Score: input.team1Score, team2Score: input.team2Score, winnerId },
        create: { matchId: input.matchId, gameNumber: input.gameNumber, team1Score: input.team1Score, team2Score: input.team2Score, winnerId },
      });
    }),

  // Mark a match complete and set the winner
  complete: protectedProcedure
    .input(z.object({ id: z.string(), winnerId: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.match.update({
        where: { id: input.id },
        data: { status: "COMPLETED", winnerId: input.winnerId },
        include: matchInclude,
      })
    ),
});
