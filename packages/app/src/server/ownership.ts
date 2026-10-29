import { TRPCError } from "@trpc/server";
import type { Context } from "./trpc";

type Db = Context["prisma"];

// A caller who doesn't own the record gets the same error as a missing one,
// so the API doesn't reveal which ids exist.
const notFound = (what: string) => new TRPCError({ code: "NOT_FOUND", message: `${what} not found` });

export async function assertTournamentOwner(db: Db, userId: string, tournamentId: string) {
  const found = await db.tournament.findFirst({
    where: { id: tournamentId, ownerId: userId },
    select: { id: true },
  });
  if (!found) throw notFound("Tournament");
}

export async function assertEventOwner(db: Db, userId: string, eventId: string) {
  const found = await db.event.findFirst({
    where: { id: eventId, tournament: { ownerId: userId } },
    select: { id: true },
  });
  if (!found) throw notFound("Event");
}

export async function assertStageOwner(db: Db, userId: string, stageId: string) {
  const found = await db.stage.findFirst({
    where: { id: stageId, event: { tournament: { ownerId: userId } } },
    select: { id: true },
  });
  if (!found) throw notFound("Stage");
}

export async function assertTeamOwner(db: Db, userId: string, teamId: string) {
  const found = await db.team.findFirst({
    where: { id: teamId, event: { tournament: { ownerId: userId } } },
    select: { id: true },
  });
  if (!found) throw notFound("Team");
}

/** Returns the match's teams so callers can validate scores and winners against them. */
export async function assertMatchOwner(db: Db, userId: string, matchId: string) {
  const found = await db.match.findFirst({
    where: { id: matchId, stage: { event: { tournament: { ownerId: userId } } } },
    select: { id: true, team1Id: true, team2Id: true },
  });
  if (!found) throw notFound("Match");
  return found;
}
