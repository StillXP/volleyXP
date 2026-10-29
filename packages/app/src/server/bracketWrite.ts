import { randomUUID } from "node:crypto";
import type { BracketTeam } from "@volley/bracket-model";
import type { Prisma } from "../generated/prisma/client";
import { planBracket, type EliminationFormat, type SlotSource } from "./bracketPlan";

/**
 * Writes an elimination stage and all of its matches for teams that already exist.
 * Run it inside a transaction so a failure leaves nothing behind.
 */
export async function writeBracket(
  tx: Prisma.TransactionClient,
  args: { eventId: string; teams: BracketTeam[]; format: EliminationFormat; order: number }
) {
  const double = args.format === "double";
  const plan = planBracket(args.teams, args.format);
  // Ids are chosen up front so matches can point at each other in a single write.
  const matchIds = new Map(plan.map((m) => [m.key, randomUUID()]));
  const teamId = (source: SlotSource) => (source.kind === "team" ? source.teamId : null);

  const stage = await tx.stage.create({
    data: {
      eventId: args.eventId,
      order: args.order,
      name: double ? "Double Elimination" : "Single Elimination",
      type: double ? "DOUBLE_ELIM" : "SINGLE_ELIM",
    },
  });
  await tx.match.createMany({
    data: plan.map((m) => ({
      id: matchIds.get(m.key)!,
      stageId: stage.id,
      bracketKey: m.key,
      bracketRound: m.bracketRound,
      bracketPosition: m.bracketPosition,
      team1Id: teamId(m.team1),
      team2Id: teamId(m.team2),
      nextWinnerMatchId: m.winnerTo ? matchIds.get(m.winnerTo.matchKey)! : null,
      nextWinnerSlot: m.winnerTo?.slot ?? null,
      nextLoserMatchId: m.loserTo ? matchIds.get(m.loserTo.matchKey)! : null,
      nextLoserSlot: m.loserTo?.slot ?? null,
    })),
  });
  return { stageId: stage.id };
}
