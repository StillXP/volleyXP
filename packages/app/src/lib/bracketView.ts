import type { BracketMatchData, BracketTeam } from "@design-system/bracket-model";

interface StoredTeam {
  id: string;
  name: string;
  seed: number | null;
}

/** The part of a stored match the bracket view needs. Dates arrive as strings over tRPC. */
export interface StoredMatch {
  bracketKey: string | null;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  team1: StoredTeam | null;
  team2: StoredTeam | null;
  winnerId: string | null;
  scheduledTime: string | Date | null;
  court: { name: string } | null;
  games: { gameNumber: number; team1Score: number; team2Score: number; winnerId: string | null }[];
}

const STATUS = { SCHEDULED: "upcoming", IN_PROGRESS: "live", COMPLETED: "completed", CANCELLED: "upcoming" } as const;

function scoreFor(games: StoredMatch["games"], team: StoredTeam | null, side: "team1Score" | "team2Score") {
  if (!team || games.length === 0) return undefined;
  return {
    setScores: games.map((g) => g[side]),
    totalSets: games.filter((g) => g.winnerId === team.id).length,
  };
}

/**
 * Turns a stage's stored matches into the props the Bracket component takes.
 *
 * The component draws the bracket from the team list and the format, and fills in
 * results from matchData keyed by bracketKey, so this supplies exactly those.
 */
export function toBracketView(matches: StoredMatch[]): { teams: BracketTeam[]; matchData: BracketMatchData[] } {
  // Every team in the bracket appears in at least one match, including ones that had a bye.
  const byId = new Map<string, StoredTeam>();
  for (const m of matches) for (const t of [m.team1, m.team2]) if (t) byId.set(t.id, t);

  // Ranked rather than trusting stored seeds, so the drawn bracket always has seeds 1..N.
  const teams = [...byId.values()]
    .sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity) || a.name.localeCompare(b.name))
    .map((t, i) => ({ id: t.id, name: t.name, seed: i + 1 }));

  const matchData: BracketMatchData[] = [];
  for (const m of matches) {
    if (!m.bracketKey) continue; // pool-play matches aren't part of a bracket
    const games = [...m.games].sort((a, b) => a.gameNumber - b.gameNumber);
    const team1Score = scoreFor(games, m.team1, "team1Score");
    const team2Score = scoreFor(games, m.team2, "team2Score");
    matchData.push({
      matchId: m.bracketKey,
      status: STATUS[m.status],
      ...(m.winnerId && { winnerId: m.winnerId }),
      ...(team1Score && { team1Score }),
      ...(team2Score && { team2Score }),
      ...(m.court && { location: m.court.name }),
      ...(m.scheduledTime && {
        startTime: new Date(m.scheduledTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      }),
    });
  }
  return { teams, matchData };
}
