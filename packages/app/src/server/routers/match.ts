import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { MatchStatus } from "../../generated/prisma/client";

export const matchRouter = router({
  getByTournament: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.match.findMany({
        where: { tournamentId: input.tournamentId },
        include: { participants: { include: { team: true } } },
        orderBy: [{ round: "asc" }, { createdAt: "asc" }],
      })
    ),

  create: protectedProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        round: z.number().int().min(1),
        courtName: z.string().optional(),
        scheduledAt: z.string().datetime().optional(),
        teamIds: z.array(z.string()).min(2).max(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { teamIds, scheduledAt, ...matchData } = input;
      return ctx.prisma.match.create({
        data: {
          ...matchData,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          participants: {
            create: teamIds.map((teamId) => ({ teamId })),
          },
        },
        include: { participants: { include: { team: true } } },
      });
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(MatchStatus) }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.match.update({
        where: { id: input.id },
        data: { status: input.status },
      })
    ),

  recordScore: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        scores: z.array(z.object({ teamId: z.string(), score: z.number().int().min(0) })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const maxScore = Math.max(...input.scores.map((s) => s.score));
      await Promise.all(
        input.scores.map((s) =>
          ctx.prisma.matchParticipant.update({
            where: { matchId_teamId: { matchId: input.matchId, teamId: s.teamId } },
            data: { score: s.score, isWinner: s.score === maxScore },
          })
        )
      );
      return ctx.prisma.match.update({
        where: { id: input.matchId },
        data: { status: "COMPLETED" },
        include: { participants: { include: { team: true } } },
      });
    }),
});
