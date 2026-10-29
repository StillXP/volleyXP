import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "../generated/prisma/client";
import { defaultTeamName } from "../lib/teamName";

type Tx = Prisma.TransactionClient;

export const conflict = (message: string) => new TRPCError({ code: "CONFLICT", message });
export const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });

/** The secret in a team's invite link: 128 random bits. */
export const newInviteCode = () => randomBytes(16).toString("base64url");

/** Teams that count against the entry cap. */
const COUNTED = ["REGISTERED", "CHECKED_IN"] as const;

/**
 * Locks the event row until the transaction ends, so registrations for one event take
 * turns. Without it two people taking the last place, or the last spot on a team, could
 * both be told yes.
 */
export async function lockEvent(tx: Tx, eventId: string) {
  await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, teamSize: true, entryCap: true },
  });
  if (!event) throw notFound("Event not found");
  return event;
}

export type LockedEvent = Awaited<ReturnType<typeof lockEvent>>;

export const registrationOpen = (event: { status: string }) => event.status === "REGISTRATION";

/** Rosters and names can change until the bracket exists. */
export const beforeBracket = (event: { status: string }) => event.status === "REGISTRATION" || event.status === "SEEDING";

export const countedTeams = (tx: Tx, eventId: string) =>
  tx.team.count({ where: { eventId, status: { in: [...COUNTED] } } });

/** Moves waitlisted teams into any free places, oldest first. Returns the teams promoted. */
export async function promoteWaitlist(tx: Tx, eventId: string, entryCap: number | null): Promise<string[]> {
  const room = entryCap === null ? undefined : Math.max(0, entryCap - (await countedTeams(tx, eventId)));
  if (room === 0) return [];
  const waiting = await tx.team.findMany({
    where: { eventId, status: "WAITLISTED" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...(room !== undefined && { take: room }),
    select: { id: true },
  });
  if (waiting.length > 0) {
    await tx.team.updateMany({ where: { id: { in: waiting.map((t) => t.id) } }, data: { status: "REGISTERED" } });
  }
  return waiting.map((t) => t.id);
}

/** Recomputes a team's name from its members, if it is still using the generated one. */
export async function refreshDefaultName(tx: Tx, teamId: string) {
  const team = await tx.team.findUniqueOrThrow({ where: { id: teamId }, select: { usesDefaultName: true } });
  if (!team.usesDefaultName) return;
  // Captain first (CAPTAIN is declared before PLAYER), then in the order they joined.
  const members = await tx.teamMember.findMany({
    where: { teamId },
    orderBy: [{ role: "asc" }, { id: "asc" }],
    select: { user: { select: { firstName: true, lastName: true } } },
  });
  const name = defaultTeamName(members.map((m) => m.user));
  if (name) await tx.team.update({ where: { id: teamId }, data: { name } });
}

/** The caller must be the team's captain. Anyone else gets the same answer as a missing team. */
export async function assertCaptain(tx: Tx, teamId: string, userId: string) {
  const member = await tx.teamMember.findFirst({
    where: { teamId, userId, role: "CAPTAIN" },
    select: { team: { select: { id: true, eventId: true, status: true } } },
  });
  if (!member) throw notFound("Team not found");
  return member.team;
}

export async function assertNotOnATeam(tx: Tx, eventId: string, userId: string) {
  const existing = await tx.teamMember.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { id: true } });
  if (existing) throw conflict("You're already on a team in this event");
}
