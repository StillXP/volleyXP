// Pure bracket structure: seeding, rounds, byes and how winners and losers feed
// later matches. No React, so the server can build the same bracket the UI draws.

import type { MatchCardStatus } from '../components/MatchCard/MatchCard';

// ─── Seeding and naming ───────────────────────────────────────────────────────

export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Returns seed positions for a bracket of given size using standard seeding.
 * getSeedOrder(8) → [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function getSeedOrder(bracketSize: number): number[] {
  if (bracketSize === 1) return [1];
  const prev = getSeedOrder(bracketSize / 2);
  const result: number[] = [];
  for (const s of prev) {
    result.push(s);
    result.push(bracketSize + 1 - s);
  }
  return result;
}

export function getRoundName(numMatchesInRound: number): string {
  if (numMatchesInRound === 1) return 'Final';
  if (numMatchesInRound === 2) return 'Semifinal';
  if (numMatchesInRound === 4) return 'Quarterfinal';
  return `Round of ${numMatchesInRound * 2}`;
}

export function getWBRoundDisplayName(roundName: string, roundIndex: number): string {
  if (roundName.startsWith('Round of')) return `Winners Round ${roundIndex + 1}`;
  return `Winners ${roundName}`;
}

export function getMatchTitle(roundName: string, shortId: string): string {
  return `${roundName} - ${shortId}`;
}

export function getLBRoundName(lbRoundIndex: number, totalLBRounds: number): string {
  const num = lbRoundIndex + 1;
  if (num === totalLBRounds) return 'Losers Final';
  if (num === totalLBRounds - 1) return 'Losers Semifinal';
  if (num === totalLBRounds - 2 && totalLBRounds > 4) return 'Losers Quarterfinal';
  return `Losers Round ${num}`;
}

export function getLBMatchTitle(roundName: string, shortId: string): string {
  return `${roundName} - ${shortId}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BracketTeam {
  /** Unique identifier for winner propagation. */
  id: string;
  name: string;
  /** 1-indexed seed. Lower = stronger. */
  seed: number;
}

export interface BracketMatchScore {
  setScores?: number[];
  totalSets?: number;
}

export interface BracketMatchData {
  /**
   * Match identifier.
   * Single elim: "r{round}-m{match}" (1-indexed). e.g. "r1-m1"
   * Double elim WB: same format.
   * Double elim LB: "lb-r{round}-m{match}" (1-indexed). e.g. "lb-r1-m1"
   * Grand Final: "gf-m1"
   */
  matchId: string;
  status?: MatchCardStatus;
  /** ID of the winning team. */
  winnerId?: string;
  team1Score?: BracketMatchScore;
  team2Score?: BracketMatchScore;
  location?: string;
  startTime?: string;
  /** URL to a stream or replay shown in the MatchView video button. */
  videoUrl?: string;
}

// ─── Internal types ───────────────────────────────────────────────────────────

export interface InternalSlot {
  /** null = TBD (winner not yet known). 'bye' = this position is a bye. */
  team: BracketTeam | 'bye' | null;
  /** matchId this slot advances from. */
  fromMatchId?: string;
  /** If true, this slot is filled by the *loser* of fromMatchId (used in LB). */
  fromMatchIsLoser?: boolean;
}

export interface InternalMatch {
  matchId: string;
  shortId: string;
  roundIndex: number;
  matchIndex: number;
  title: string;
  team1: InternalSlot;
  team2: InternalSlot;
}

export interface InternalRound {
  roundIndex: number;
  roundName: string;
  matches: InternalMatch[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A bye match has at least one 'bye' slot — it is never shown as a card. */
export function isByeMatch(match: InternalMatch): boolean {
  return match.team1.team === 'bye' || match.team2.team === 'bye';
}

// ─── Single-elim bracket generation ──────────────────────────────────────────

export function resolveWinner(
  feedMatch: InternalMatch,
  resultMap: Map<string, BracketMatchData>,
  teamById: Map<string, BracketTeam>
): InternalSlot {
  if (feedMatch.team1.team === 'bye' && feedMatch.team2.team === 'bye') {
    return { team: 'bye' };
  }
  if (feedMatch.team1.team === 'bye' && feedMatch.team2.team !== 'bye') {
    return feedMatch.team2.team !== null
      ? { team: feedMatch.team2.team }
      : { team: null, fromMatchId: feedMatch.matchId };
  }
  if (feedMatch.team2.team === 'bye' && feedMatch.team1.team !== 'bye') {
    return feedMatch.team1.team !== null
      ? { team: feedMatch.team1.team }
      : { team: null, fromMatchId: feedMatch.matchId };
  }
  const result = resultMap.get(feedMatch.matchId);
  if (result?.winnerId) {
    return { team: teamById.get(result.winnerId) ?? null };
  }
  return { team: null, fromMatchId: feedMatch.matchId };
}

export function generateBracket(
  teams: BracketTeam[],
  matchData: BracketMatchData[],
  isDoubleElim = false
): InternalRound[] {
  const sorted = [...teams].sort((a, b) => a.seed - b.seed);
  const bracketSize = nextPowerOf2(sorted.length);
  const numRounds = Math.log2(bracketSize);
  const seedOrder = getSeedOrder(bracketSize);
  const resultMap = new Map(matchData.map(r => [r.matchId, r]));
  const teamBySeed = new Map(sorted.map(t => [t.seed, t]));
  const teamById = new Map(sorted.map(t => [t.id, t]));

  const rounds: InternalRound[] = [];
  let wbCount = 0;

  const r1Name = getRoundName(bracketSize / 2);
  const r1DisplayName = isDoubleElim ? getWBRoundDisplayName(r1Name, 0) : r1Name;
  const r1Matches: InternalMatch[] = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const mi = i / 2;
    const matchId = `r1-m${mi + 1}`;
    const team1: InternalSlot = { team: teamBySeed.get(seedOrder[i]) ?? 'bye' };
    const team2: InternalSlot = { team: teamBySeed.get(seedOrder[i + 1]) ?? 'bye' };
    const isBye = team1.team === 'bye' || team2.team === 'bye';
    const shortId = isBye ? '' : `W${++wbCount}`;
    r1Matches.push({
      matchId,
      shortId,
      roundIndex: 0,
      matchIndex: mi,
      title: getMatchTitle(r1DisplayName, shortId),
      team1,
      team2,
    });
  }
  rounds.push({ roundIndex: 0, roundName: r1Name, matches: r1Matches });

  for (let r = 1; r < numRounds; r++) {
    const prev = rounds[r - 1].matches;
    const roundName = getRoundName(prev.length / 2);
    const roundDisplayName = isDoubleElim ? getWBRoundDisplayName(roundName, r) : roundName;
    const newMatches: InternalMatch[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const mi = i / 2;
      const matchId = `r${r + 1}-m${mi + 1}`;
      const team1 = resolveWinner(prev[i], resultMap, teamById);
      const team2 = resolveWinner(prev[i + 1], resultMap, teamById);
      const isBye = team1.team === 'bye' || team2.team === 'bye';
      const shortId = isBye ? '' : `W${++wbCount}`;
      newMatches.push({
        matchId,
        shortId,
        roundIndex: r,
        matchIndex: mi,
        title: getMatchTitle(roundDisplayName, shortId),
        team1,
        team2,
      });
    }
    rounds.push({ roundIndex: r, roundName, matches: newMatches });
  }

  return rounds;
}

// ─── LB generation ───────────────────────────────────────────────────────────

// Resolves the loser of a source match when its result is known, falling back
// to a placeholder slot so the card can display "Loser of [match]" otherwise.
export function resolveLoser(
  sourceMatch: InternalMatch,
  resultMap: Map<string, BracketMatchData>,
  teamById: Map<string, BracketTeam>
): InternalSlot {
  const result = resultMap.get(sourceMatch.matchId);
  if (result?.winnerId) {
    const t1 = sourceMatch.team1.team;
    const t2 = sourceMatch.team2.team;
    if (t1 && t1 !== 'bye' && t1.id !== result.winnerId) return { team: t1 };
    if (t2 && t2 !== 'bye' && t2.id !== result.winnerId) return { team: t2 };
    // winnerId present but doesn't match either resolved team — look up by id
    const t1id = (t1 as BracketTeam | null)?.id;
    const t2id = (t2 as BracketTeam | null)?.id;
    const loserTeam = (t1id && t1id !== result.winnerId ? teamById.get(t1id) : undefined)
      ?? (t2id && t2id !== result.winnerId ? teamById.get(t2id) : undefined)
      ?? null;
    if (loserTeam) return { team: loserTeam };
  }
  return { team: null, fromMatchId: sourceMatch.matchId, fromMatchIsLoser: true };
}

export function generateLBRounds(
  wbRounds: InternalRound[],
  resultMap: Map<string, BracketMatchData>,
  allTeams: BracketTeam[]
): InternalRound[] {
  const k = wbRounds.length;
  if (k < 2) return [];
  const teamById = new Map(allTeams.map(t => [t.id, t]));

  const totalLBRounds = 2 * (k - 1);
  const lbRounds: InternalRound[] = [];
  let lbCount = 0;

  for (let lbR = 0; lbR < totalLBRounds; lbR++) {
    const lbRoundNum = lbR + 1; // 1-indexed for matchId generation
    const roundName = getLBRoundName(lbR, totalLBRounds);
    let matches: InternalMatch[];

    if (lbRoundNum === 1) {
      // LB R1: pair WB R1 losers against each other
      const wbR1Matches = wbRounds[0].matches;
      matches = [];
      for (let i = 0; i < wbR1Matches.length; i += 2) {
        const mi = i / 2;
        const m1 = wbR1Matches[i];
        const m2 = wbR1Matches[i + 1];
        const team1: InternalSlot = isByeMatch(m1) ? { team: 'bye' } : resolveLoser(m1, resultMap, teamById);
        const team2: InternalSlot = !m2 || isByeMatch(m2) ? { team: 'bye' } : resolveLoser(m2, resultMap, teamById);
        const isBye = team1.team === 'bye' || team2.team === 'bye';
        const shortId = isBye ? '' : `L${++lbCount}`;
        matches.push({
          matchId: `lb-r1-m${mi + 1}`,
          shortId,
          roundIndex: lbR,
          matchIndex: mi,
          title: getLBMatchTitle(roundName, shortId),
          team1,
          team2,
        });
      }
    } else if (lbRoundNum % 2 === 0) {
      // Even LB round: pair each LB survivor with a new WB loser dropping in.
      // LB R2 pulls WB R2 losers (wbRounds index 1), LB R4 pulls WB R3 (index 2), etc.
      const wbDropRoundIndex = lbRoundNum / 2;
      const wbDropMatches = wbRounds[wbDropRoundIndex].matches;
      const prevLBRound = lbRounds[lbR - 1];
      matches = [];
      for (let i = 0; i < prevLBRound.matches.length; i++) {
        const lbPrev = prevLBRound.matches[i];
        const wbDrop = wbDropMatches[i];
        const team1 = resolveWinner(lbPrev, resultMap, teamById);
        const team2: InternalSlot = !wbDrop || isByeMatch(wbDrop) ? { team: 'bye' } : resolveLoser(wbDrop, resultMap, teamById);
        const isBye = team1.team === 'bye' || team2.team === 'bye';
        const shortId = isBye ? '' : `L${++lbCount}`;
        matches.push({
          matchId: `lb-r${lbRoundNum}-m${i + 1}`,
          shortId,
          roundIndex: lbR,
          matchIndex: i,
          title: getLBMatchTitle(roundName, shortId),
          team1,
          team2,
        });
      }
    } else {
      // Odd LB round > 1: LB survivors play each other (bracket halves).
      const prevLBRound = lbRounds[lbR - 1];
      matches = [];
      for (let i = 0; i < prevLBRound.matches.length; i += 2) {
        const mi = i / 2;
        const m1 = prevLBRound.matches[i];
        const m2 = prevLBRound.matches[i + 1];
        const team1: InternalSlot = !m1 ? { team: 'bye' } : resolveWinner(m1, resultMap, teamById);
        const team2: InternalSlot = !m2 ? { team: 'bye' } : resolveWinner(m2, resultMap, teamById);
        const isBye = team1.team === 'bye' || team2.team === 'bye';
        const shortId = isBye ? '' : `L${++lbCount}`;
        matches.push({
          matchId: `lb-r${lbRoundNum}-m${mi + 1}`,
          shortId,
          roundIndex: lbR,
          matchIndex: mi,
          title: getLBMatchTitle(roundName, shortId),
          team1,
          team2,
        });
      }
    }

    lbRounds.push({ roundIndex: lbR, roundName, matches });
  }

  // When WB R1 has byes, the initial LB rounds may be all-bye (no real matches).
  // Renumber from the first real round so column headers and match titles both start at "LB Round 1".
  const firstRealIdx = lbRounds.findIndex(r => r.matches.some(m => !isByeMatch(m)));
  if (firstRealIdx > 0) {
    const visibleTotal = lbRounds.length - firstRealIdx;
    for (let i = firstRealIdx; i < lbRounds.length; i++) {
      const newRoundName = getLBRoundName(i - firstRealIdx, visibleTotal);
      lbRounds[i] = {
        ...lbRounds[i],
        roundName: newRoundName,
        matches: lbRounds[i].matches.map(m => ({
          ...m,
          title: getLBMatchTitle(newRoundName, m.shortId),
        })),
      };
    }
  }

  return lbRounds;
}

export function buildGrandFinalMatch(
  wbRounds: InternalRound[],
  lbRounds: InternalRound[],
  resultMap: Map<string, BracketMatchData>,
  allTeams: BracketTeam[]
): InternalMatch {
  const teamById = new Map(allTeams.map(t => [t.id, t]));
  const wbFinal = wbRounds[wbRounds.length - 1].matches[0];
  const lbFinal = lbRounds.length > 0 ? lbRounds[lbRounds.length - 1].matches[0] : null;
  return {
    matchId: 'gf-m1',
    shortId: 'GF',
    roundIndex: 0,
    matchIndex: 0,
    title: 'Grand Final',
    team1: resolveWinner(wbFinal, resultMap, teamById),
    team2: lbFinal ? resolveWinner(lbFinal, resultMap, teamById) : { team: 'bye' },
  };
}
