import { TRPCError } from "@trpc/server";
import type { Prisma } from "../generated/prisma/client";
import { gameWinner, matchOutcome, targetFor, type Side } from "../lib/matchRules";

type Tx = Prisma.TransactionClient;

const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });
const conflict = (message: string) => new TRPCError({ code: "CONFLICT", message });

const SCORING_SELECT = {
  id: true,
  status: true,
  team1Id: true,
  team2Id: true,
  winnerId: true,
  actualStartTime: true,
  nextWinnerMatchId: true,
  nextWinnerSlot: true,
  nextLoserMatchId: true,
  nextLoserSlot: true,
  games: {
    orderBy: { gameNumber: "asc" },
    select: { gameNumber: true, team1Score: true, team2Score: true, winnerId: true, completedAt: true },
  },
  stage: { select: { event: { select: { bestOf: true, pointsToWin: true, pointsToWinLastGame: true } } } },
} satisfies Prisma.MatchSelect;

type ScoringMatch = Prisma.MatchGetPayload<{ select: typeof SCORING_SELECT }>;

/**
 * Loads a match for scoring and holds its row lock until the transaction ends, so two
 * scorekeepers recording at once take turns instead of both acting on stale state.
 */
async function lockAndLoad(tx: Tx, matchId: string): Promise<ScoringMatch> {
  await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`;
  return tx.match.findUniqueOrThrow({ where: { id: matchId }, select: SCORING_SELECT });
}

const slotField = (slot: number | null) => (slot === 2 ? "team2Id" : "team1Id");

/** Puts the winner and loser into the matches they feed, on the side the bracket planned. */
async function advance(tx: Tx, match: ScoringMatch, winnerId: string, loserId: string) {
  if (match.nextWinnerMatchId) {
    await tx.match.update({ where: { id: match.nextWinnerMatchId }, data: { [slotField(match.nextWinnerSlot)]: winnerId } });
  }
  if (match.nextLoserMatchId) {
    await tx.match.update({ where: { id: match.nextLoserMatchId }, data: { [slotField(match.nextLoserSlot)]: loserId } });
  }
}

/** Takes a result back out of the matches it fed. */
async function retract(tx: Tx, match: ScoringMatch) {
  if (match.nextWinnerMatchId) {
    await tx.match.update({ where: { id: match.nextWinnerMatchId }, data: { [slotField(match.nextWinnerSlot)]: null } });
  }
  if (match.nextLoserMatchId) {
    await tx.match.update({ where: { id: match.nextLoserMatchId }, data: { [slotField(match.nextLoserSlot)]: null } });
  }
}

/** A result can only be changed while nothing downstream has been played on the strength of it. */
async function assertDownstreamNotStarted(tx: Tx, match: ScoringMatch) {
  const ids = [match.nextWinnerMatchId, match.nextLoserMatchId].filter((id): id is string => !!id);
  if (ids.length === 0) return;
  const started = await tx.match.count({
    where: { id: { in: ids }, OR: [{ status: { not: "SCHEDULED" } }, { games: { some: {} } }] },
  });
  if (started > 0) throw conflict("A match that depends on this result has already started, so it can't be changed");
}

const winnerTeam = (match: ScoringMatch, side: Side) => (side === 1 ? match.team1Id! : match.team2Id!);
const loserTeam = (match: ScoringMatch, side: Side) => (side === 1 ? match.team2Id! : match.team1Id!);

function requireTeams(match: ScoringMatch) {
  if (!match.team1Id || !match.team2Id) throw badRequest("Both teams must be set before scoring this match");
  if (match.status === "CANCELLED") throw conflict("This match was cancelled");
}

/**
 * Records a game's score, which may be a game still being played. When the score
 * finishes the game and that gives a team enough games, the match completes and the
 * winner and loser move on. Editing the latest game, or one that keeps its winner,
 * corrects an earlier mistake, as long as nothing downstream has started.
 */
export async function recordGameScore(tx: Tx, input: { matchId: string; gameNumber: number; team1Score: number; team2Score: number }) {
  const match = await lockAndLoad(tx, input.matchId);
  requireTeams(match);
  const rules = match.stage.event;
  const { gameNumber, team1Score, team2Score } = input;

  if (gameNumber > rules.bestOf) throw badRequest(`This match is a best of ${rules.bestOf}`);

  const before = matchOutcome(match.games, rules);
  if (match.status === "COMPLETED" && !before.winner) {
    throw conflict("This match was completed by forfeit. Reopen it to record games.");
  }

  const last = match.games.at(-1);
  const lastNumber = last?.gameNumber ?? 0;
  const existing = match.games.find((g) => g.gameNumber === gameNumber);
  const target = targetFor(gameNumber, rules);
  const newSide = gameWinner(team1Score, team2Score, target);

  if (!existing) {
    if (before.winner) throw conflict("This match has already been decided");
    if (gameNumber !== lastNumber + 1) throw badRequest(`Record game ${lastNumber + 1} next`);
    if (last && !gameWinner(last.team1Score, last.team2Score, targetFor(last.gameNumber, rules))) {
      throw badRequest(`Finish game ${lastNumber} first`);
    }
  } else if (gameNumber < lastNumber) {
    // Earlier games can be corrected, but not in a way that changes how the match unfolded.
    const oldSide = gameWinner(existing.team1Score, existing.team2Score, target);
    if (newSide === null || newSide !== oldSide) {
      throw conflict("Later games have been recorded, so this game's result can't change");
    }
  }

  const games = [...match.games.filter((g) => g.gameNumber !== gameNumber), { gameNumber, team1Score, team2Score }];
  const after = matchOutcome(games, rules);
  const newWinnerId = after.winner ? winnerTeam(match, after.winner) : null;
  const resultChanged = newWinnerId !== match.winnerId;

  // Taking a result back or changing it moves players who may already be waiting downstream.
  if (resultChanged && match.winnerId) {
    await assertDownstreamNotStarted(tx, match);
    await retract(tx, match);
  }

  const now = new Date();
  await tx.game.upsert({
    where: { matchId_gameNumber: { matchId: match.id, gameNumber } },
    update: {
      team1Score,
      team2Score,
      winnerId: newSide ? winnerTeam(match, newSide) : null,
      completedAt: newSide ? (existing?.completedAt ?? now) : null,
    },
    create: {
      matchId: match.id,
      gameNumber,
      team1Score,
      team2Score,
      winnerId: newSide ? winnerTeam(match, newSide) : null,
      completedAt: newSide ? now : null,
    },
  });

  const started = match.actualStartTime ?? now;
  if (newWinnerId) {
    await tx.match.update({ where: { id: match.id }, data: { status: "COMPLETED", winnerId: newWinnerId, actualStartTime: started } });
    // A score correction that leaves the winner alone has nothing new to move.
    if (resultChanged) await advance(tx, match, newWinnerId, loserTeam(match, after.winner!));
  } else {
    await tx.match.update({ where: { id: match.id }, data: { status: "IN_PROGRESS", winnerId: null, actualStartTime: started } });
  }
}

/** Ends a match without it being played out (a forfeit or walkover), and moves the players on. */
export async function completeByForfeit(tx: Tx, input: { matchId: string; winnerId: string }) {
  const match = await lockAndLoad(tx, input.matchId);
  requireTeams(match);
  if (input.winnerId !== match.team1Id && input.winnerId !== match.team2Id) {
    throw badRequest("Winner must be one of the match's teams");
  }
  if (match.status === "COMPLETED" && match.winnerId === input.winnerId) return;

  if (match.status === "COMPLETED") {
    await assertDownstreamNotStarted(tx, match);
    await retract(tx, match);
  }
  const side: Side = input.winnerId === match.team1Id ? 1 : 2;
  await tx.match.update({
    where: { id: match.id },
    data: { status: "COMPLETED", winnerId: input.winnerId, actualStartTime: match.actualStartTime ?? new Date() },
  });
  await advance(tx, match, input.winnerId, loserTeam(match, side));
}

/** Undoes a forfeit. A match decided by its games is changed by editing its last game instead. */
export async function reopenMatch(tx: Tx, matchId: string) {
  const match = await lockAndLoad(tx, matchId);
  if (match.status !== "COMPLETED") throw conflict("Only a completed match can be reopened");
  if (matchOutcome(match.games, match.stage.event).winner) {
    throw conflict("This match was decided by its games. Edit the last game to change the result.");
  }
  await assertDownstreamNotStarted(tx, match);
  await retract(tx, match);
  await tx.match.update({
    where: { id: match.id },
    data: { status: match.games.length > 0 ? "IN_PROGRESS" : "SCHEDULED", winnerId: null },
  });
}
