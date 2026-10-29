import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { assertMatchOwner, assertStageOwner } from "../ownership";
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

      const { scheduledTime, ...rest } = input;
      return ctx.prisma.match.create({
        data: { ...rest, scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined },
        include: matchInclude,
      });
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(MatchStatus) }))
    .mutation(async ({ ctx, input }) => {
      await assertMatchOwner(ctx.prisma, ctx.userId, input.id);
      return ctx.prisma.match.update({ where: { id: input.id }, data: { status: input.status } });
    }),

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
      const match = await assertMatchOwner(ctx.prisma, ctx.userId, input.matchId);
      if (!match.team1Id || !match.team2Id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Both teams must be set before recording a game" });
      }
      if (input.team1Score === input.team2Score) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A game cannot end in a tie" });
      }
      const winnerId = input.team1Score > input.team2Score ? match.team1Id : match.team2Id;

      return ctx.prisma.game.upsert({
        where: { matchId_gameNumber: { matchId: input.matchId, gameNumber: input.gameNumber } },
        update: { team1Score: input.team1Score, team2Score: input.team2Score, winnerId },
        create: { matchId: input.matchId, gameNumber: input.gameNumber, team1Score: input.team1Score, team2Score: input.team2Score, winnerId },
      });
    }),

  // Mark a match complete and set the winner
  complete: protectedProcedure
    .input(z.object({ id: z.string(), winnerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const match = await assertMatchOwner(ctx.prisma, ctx.userId, input.id);
      if (input.winnerId !== match.team1Id && input.winnerId !== match.team2Id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Winner must be one of the match's teams" });
      }
      return ctx.prisma.match.update({
        where: { id: input.id },
        data: { status: "COMPLETED", winnerId: input.winnerId },
        include: matchInclude,
      });
    }),
});
