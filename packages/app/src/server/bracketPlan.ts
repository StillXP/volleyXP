import {
  buildGrandFinalMatch,
  generateBracket,
  generateLBRounds,
  getWBRoundDisplayName,
  isByeMatch,
} from "@volley/bracket-model";
import type { BracketTeam, InternalMatch, InternalSlot } from "@volley/bracket-model";

export type EliminationFormat = "single" | "double";

/** What fills one side of a match: a known team, or the winner or loser of another match. */
export type SlotSource =
  | { kind: "team"; teamId: string }
  | { kind: "winner" | "loser"; matchKey: string };

export interface PlannedMatch {
  /** The id the Bracket component uses for this match, e.g. "r1-m1", "lb-r2-m1", "gf-m1". */
  key: string;
  /** Round label, e.g. "Quarterfinal", "Winners Round 1", "Losers Final", "Grand Final". */
  bracketRound: string;
  /** Position within the round, from 0. */
  bracketPosition: number;
  team1: SlotSource;
  team2: SlotSource;
  /** Where the winner goes next, and into which side (1 = team1, 2 = team2). */
  winnerTo?: { matchKey: string; slot: 1 | 2 };
  loserTo?: { matchKey: string; slot: 1 | 2 };
}

/**
 * Lists the matches a bracket needs and how they connect, using the same generator
 * as the Bracket component so the saved bracket matches what the UI draws.
 *
 * Bye matches are never stored: a team with a bye is placed straight into its
 * next match, and a loser who has nowhere to drop is simply out.
 */
export function planBracket(teams: BracketTeam[], format: EliminationFormat): PlannedMatch[] {
  const double = format === "double";
  const noResults = new Map();
  const winners = generateBracket(teams, [], double);
  const losers = double ? generateLBRounds(winners, noResults, teams) : [];
  const grandFinal = double ? buildGrandFinalMatch(winners, losers, noResults, teams) : null;

  const entries: { match: InternalMatch; bracketRound: string }[] = [];
  for (const round of winners) {
    const label = double ? getWBRoundDisplayName(round.roundName, round.roundIndex) : round.roundName;
    for (const match of round.matches) entries.push({ match, bracketRound: label });
  }
  for (const round of losers) {
    for (const match of round.matches) entries.push({ match, bracketRound: round.roundName });
  }
  if (grandFinal) entries.push({ match: grandFinal, bracketRound: "Grand Final" });

  const byKey = new Map(entries.map((e) => [e.match.matchId, e.match]));

  // Follows a slot back to what really fills it, skipping over bye matches.
  const resolve = (slot: InternalSlot): SlotSource | "bye" => {
    if (slot.team === "bye") return "bye";
    if (slot.team) return { kind: "team", teamId: slot.team.id };
    const from = slot.fromMatchId ? byKey.get(slot.fromMatchId) : undefined;
    if (!from) throw new Error(`Slot has no source: ${JSON.stringify(slot)}`);
    if (!isByeMatch(from)) return { kind: slot.fromMatchIsLoser ? "loser" : "winner", matchKey: from.matchId };
    // A bye match has no loser, and passes its winner through from the side that isn't a bye.
    if (slot.fromMatchIsLoser) return "bye";
    const a = resolve(from.team1);
    const b = resolve(from.team2);
    return a === "bye" ? b : a;
  };

  const plan: PlannedMatch[] = [];
  const byPlannedKey = new Map<string, PlannedMatch>();
  for (const { match, bracketRound } of entries) {
    if (isByeMatch(match)) continue;
    const team1 = resolve(match.team1);
    const team2 = resolve(match.team2);
    if (team1 === "bye" || team2 === "bye") {
      throw new Error(`Match ${match.matchId} resolved to a bye; the bracket generator and planner disagree`);
    }
    const planned: PlannedMatch = { key: match.matchId, bracketRound, bracketPosition: match.matchIndex, team1, team2 };
    plan.push(planned);
    byPlannedKey.set(planned.key, planned);
  }

  // Wire each feeder to the slot it fills.
  for (const planned of plan) {
    ([planned.team1, planned.team2] as const).forEach((source, i) => {
      if (source.kind === "team") return;
      const feeder = byPlannedKey.get(source.matchKey)!;
      const link = { matchKey: planned.key, slot: (i + 1) as 1 | 2 };
      if (source.kind === "winner") feeder.winnerTo = link;
      else feeder.loserTo = link;
    });
  }
  return plan;
}
