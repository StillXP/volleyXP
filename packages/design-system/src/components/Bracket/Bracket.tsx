import { useMemo, useState } from 'react';
import { MatchCard } from '../MatchCard/MatchCard';
import type { MatchCardColorScheme, MatchCardStatus } from '../MatchCard/MatchCard';
import { defaultTheme } from '../../styles/theme';
import {
  StyledBracket,
  StyledRoundGroup,
  StyledMatchColumn,
  StyledMatchSlot,
  StyledDoubleBracketWrapper,
  StyledBracketSection,
  StyledSectionHeading,
  StyledSectionBody,
} from './Bracket.styles';

// ─── Layout constants ─────────────────────────────────────────────────────────
// Derived from MatchCard rendered dimensions. Update if MatchCard layout changes.
// CARD_HEIGHT = 8(py) + 24(title) + 4(gap) + 85(scorecard) + 4(gap) + 20(footer) + 8(py) = 153
const CARD_HEIGHT = 153;
const BASE_GAP = 0;
const CONNECTOR_WIDTH = 56;
const CONNECTOR_HIGHLIGHT_LIGHT = defaultTheme.color.green[500];
const CONNECTOR_HIGHLIGHT_DARK = defaultTheme.color.green[300];

// Vertical offset from the top of a MatchCard to the centre of its team divider line.
// 8(card py) + 24(title) + 4(gap) + 2(scorecard border) + 40(team row: 8+24+8) + 0.5(divider centre)
const CARD_DIVIDER_OFFSET = 78.5;

// ─── Single-elim spacing helpers ─────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Returns seed positions for a bracket of given size using standard seeding.
 * getSeedOrder(8) → [1, 8, 4, 5, 2, 7, 3, 6]
 */
function getSeedOrder(bracketSize: number): number[] {
  if (bracketSize === 1) return [1];
  const prev = getSeedOrder(bracketSize / 2);
  const result: number[] = [];
  for (const s of prev) {
    result.push(s);
    result.push(bracketSize + 1 - s);
  }
  return result;
}

function getRoundName(numMatchesInRound: number): string {
  if (numMatchesInRound === 1) return 'Final';
  if (numMatchesInRound === 2) return 'Semifinal';
  if (numMatchesInRound === 4) return 'Quarterfinal';
  return `Round of ${numMatchesInRound * 2}`;
}

function getMatchTitle(roundName: string, matchIndex: number, numMatchesInRound: number): string {
  if (numMatchesInRound === 1) return roundName;
  return `${roundName} #${matchIndex + 1}`;
}

/** Gap between match cards in a given round (0-indexed). */
export function getRoundGap(roundIndex: number): number {
  if (roundIndex === 0) return BASE_GAP;
  return 2 * getRoundGap(roundIndex - 1) + CARD_HEIGHT;
}

/** Top padding for a round column so its first match vertically centres between its two feeders. */
export function getRoundTopPad(roundIndex: number): number {
  if (roundIndex === 0) return 0;
  return getRoundTopPad(roundIndex - 1) + (CARD_HEIGHT + getRoundGap(roundIndex - 1)) / 2;
}

/** Total pixel height of a round column. */
function getColumnHeight(numMatches: number, roundIndex: number): number {
  return (
    getRoundTopPad(roundIndex) +
    numMatches * CARD_HEIGHT +
    (numMatches - 1) * getRoundGap(roundIndex)
  );
}

/** Top offset (px) for a match card at the given index within its round. */
function getMatchTop(matchIndex: number, roundIndex: number, cardHeight: number): number {
  return getRoundTopPad(roundIndex) + matchIndex * (cardHeight + getRoundGap(roundIndex));
}

// ─── LB naming helpers ────────────────────────────────────────────────────────

function getLBRoundName(lbRoundIndex: number, totalLBRounds: number): string {
  const num = lbRoundIndex + 1;
  if (num === totalLBRounds) return 'LB Final';
  if (num === totalLBRounds - 1) return 'LB Semifinal';
  if (num === totalLBRounds - 2 && totalLBRounds > 4) return 'LB Quarterfinal';
  return `LB Round ${num}`;
}

function getLBMatchTitle(roundName: string, matchIndex: number, totalMatchesInRound: number): string {
  if (totalMatchesInRound === 1) return roundName;
  return `${roundName} #${matchIndex + 1}`;
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
}

export interface BracketProps {
  /** Teams in the bracket. The bracket size is derived from this list. */
  teams: BracketTeam[];
  /** Optional match results and metadata, keyed by matchId. */
  matchData?: BracketMatchData[];
  colorScheme?: MatchCardColorScheme;
  /**
   * Override the assumed MatchCard height (px) used to compute connector positions.
   * Default: 153.
   */
  cardHeight?: number;
  /** Single or double elimination. Default: 'single'. */
  eliminationFormat?: 'single' | 'double';
  className?: string;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface InternalSlot {
  /** null = TBD (winner not yet known). 'bye' = this position is a bye. */
  team: BracketTeam | 'bye' | null;
  /** matchId this slot advances from. */
  fromMatchId?: string;
  /** If true, this slot is filled by the *loser* of fromMatchId (used in LB). */
  fromMatchIsLoser?: boolean;
}

interface InternalMatch {
  matchId: string;
  roundIndex: number;
  matchIndex: number;
  title: string;
  team1: InternalSlot;
  team2: InternalSlot;
}

interface InternalRound {
  roundIndex: number;
  roundName: string;
  matches: InternalMatch[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A bye match has at least one 'bye' slot — it is never shown as a card. */
function isByeMatch(match: InternalMatch): boolean {
  return match.team1.team === 'bye' || match.team2.team === 'bye';
}

// ─── Single-elim bracket generation ──────────────────────────────────────────

function resolveWinner(
  feedMatch: InternalMatch,
  resultMap: Map<string, BracketMatchData>,
  allTeams: BracketTeam[]
): InternalSlot {
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
    const winnerTeam = allTeams.find(t => t.id === result.winnerId) ?? null;
    return { team: winnerTeam };
  }
  return { team: null, fromMatchId: feedMatch.matchId };
}

function generateBracket(
  teams: BracketTeam[],
  matchData: BracketMatchData[]
): InternalRound[] {
  const sorted = [...teams].sort((a, b) => a.seed - b.seed);
  const bracketSize = nextPowerOf2(sorted.length);
  const numRounds = Math.log2(bracketSize);
  const seedOrder = getSeedOrder(bracketSize);
  const resultMap = new Map(matchData.map(r => [r.matchId, r]));
  const teamBySeed = new Map(sorted.map(t => [t.seed, t]));

  const rounds: InternalRound[] = [];

  const r1Name = getRoundName(bracketSize / 2);
  const r1Matches: InternalMatch[] = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const mi = i / 2;
    const matchId = `r1-m${mi + 1}`;
    r1Matches.push({
      matchId,
      roundIndex: 0,
      matchIndex: mi,
      title: getMatchTitle(r1Name, mi, bracketSize / 2),
      team1: { team: teamBySeed.get(seedOrder[i]) ?? 'bye' },
      team2: { team: teamBySeed.get(seedOrder[i + 1]) ?? 'bye' },
    });
  }
  rounds.push({ roundIndex: 0, roundName: r1Name, matches: r1Matches });

  for (let r = 1; r < numRounds; r++) {
    const prev = rounds[r - 1].matches;
    const roundName = getRoundName(prev.length / 2);
    const newMatches: InternalMatch[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const mi = i / 2;
      const matchId = `r${r + 1}-m${mi + 1}`;
      newMatches.push({
        matchId,
        roundIndex: r,
        matchIndex: mi,
        title: getMatchTitle(roundName, mi, prev.length / 2),
        team1: resolveWinner(prev[i], resultMap, sorted),
        team2: resolveWinner(prev[i + 1], resultMap, sorted),
      });
    }
    rounds.push({ roundIndex: r, roundName, matches: newMatches });
  }

  return rounds;
}

// ─── LB generation ───────────────────────────────────────────────────────────

// Resolves the loser of a source match when its result is known, falling back
// to a placeholder slot so the card can display "Loser of [match]" otherwise.
function resolveLoser(
  sourceMatch: InternalMatch,
  resultMap: Map<string, BracketMatchData>,
  allTeams: BracketTeam[]
): InternalSlot {
  const result = resultMap.get(sourceMatch.matchId);
  if (result?.winnerId) {
    const t1 = sourceMatch.team1.team;
    const t2 = sourceMatch.team2.team;
    if (t1 && t1 !== 'bye' && t1.id !== result.winnerId) return { team: t1 };
    if (t2 && t2 !== 'bye' && t2.id !== result.winnerId) return { team: t2 };
    // winnerId present but doesn't match either resolved team — treat as unresolved
    const loserTeam = allTeams.find(t => t.id !== result.winnerId && (t.id === (t1 as BracketTeam | null)?.id || t.id === (t2 as BracketTeam | null)?.id)) ?? null;
    if (loserTeam) return { team: loserTeam };
  }
  return { team: null, fromMatchId: sourceMatch.matchId, fromMatchIsLoser: true };
}

function generateLBRounds(
  wbRounds: InternalRound[],
  resultMap: Map<string, BracketMatchData>,
  allTeams: BracketTeam[]
): InternalRound[] {
  const k = wbRounds.length;
  if (k < 2) return [];

  const totalLBRounds = 2 * (k - 1);
  const lbRounds: InternalRound[] = [];

  for (let lbR = 0; lbR < totalLBRounds; lbR++) {
    const lbRoundNum = lbR + 1; // 1-indexed for matchId generation
    const roundName = getLBRoundName(lbR, totalLBRounds);
    let matches: InternalMatch[];

    if (lbRoundNum === 1) {
      // LB R1: pair WB R1 losers against each other
      const wbR1Matches = wbRounds[0].matches;
      const numMatchesInRound = wbR1Matches.length / 2;
      matches = [];
      for (let i = 0; i < wbR1Matches.length; i += 2) {
        const mi = i / 2;
        const m1 = wbR1Matches[i];
        const m2 = wbR1Matches[i + 1];
        matches.push({
          matchId: `lb-r1-m${mi + 1}`,
          roundIndex: lbR,
          matchIndex: mi,
          title: getLBMatchTitle(roundName, mi, numMatchesInRound),
          team1: isByeMatch(m1) ? { team: 'bye' } : resolveLoser(m1, resultMap, allTeams),
          team2: !m2 || isByeMatch(m2) ? { team: 'bye' } : resolveLoser(m2, resultMap, allTeams),
        });
      }
    } else if (lbRoundNum % 2 === 0) {
      // Even LB round: pair each LB survivor with a new WB loser dropping in.
      // LB R2 pulls WB R2 losers (wbRounds index 1), LB R4 pulls WB R3 (index 2), etc.
      const wbDropRoundIndex = lbRoundNum / 2;
      const wbDropMatches = wbRounds[wbDropRoundIndex].matches;
      const prevLBRound = lbRounds[lbR - 1];
      matches = prevLBRound.matches.map((lbPrev, i) => {
        const wbDrop = wbDropMatches[i];
        return {
          matchId: `lb-r${lbRoundNum}-m${i + 1}`,
          roundIndex: lbR,
          matchIndex: i,
          title: getLBMatchTitle(roundName, i, prevLBRound.matches.length),
          team1: resolveWinner(lbPrev, resultMap, allTeams),
          team2: !wbDrop || isByeMatch(wbDrop) ? { team: 'bye' } : resolveLoser(wbDrop, resultMap, allTeams),
        };
      });
    } else {
      // Odd LB round > 1: LB survivors play each other (bracket halves).
      const prevLBRound = lbRounds[lbR - 1];
      const numMatchesInRound = prevLBRound.matches.length / 2;
      matches = [];
      for (let i = 0; i < prevLBRound.matches.length; i += 2) {
        const mi = i / 2;
        const m1 = prevLBRound.matches[i];
        const m2 = prevLBRound.matches[i + 1];
        matches.push({
          matchId: `lb-r${lbRoundNum}-m${mi + 1}`,
          roundIndex: lbR,
          matchIndex: mi,
          title: getLBMatchTitle(roundName, mi, numMatchesInRound),
          team1: !m1 ? { team: 'bye' } : resolveWinner(m1, resultMap, allTeams),
          team2: !m2 ? { team: 'bye' } : resolveWinner(m2, resultMap, allTeams),
        });
      }
    }

    lbRounds.push({ roundIndex: lbR, roundName, matches });
  }

  return lbRounds;
}

function buildGrandFinalMatch(
  wbRounds: InternalRound[],
  lbRounds: InternalRound[],
  resultMap: Map<string, BracketMatchData>,
  allTeams: BracketTeam[]
): InternalMatch {
  const wbFinal = wbRounds[wbRounds.length - 1].matches[0];
  const lbFinal = lbRounds.length > 0 ? lbRounds[lbRounds.length - 1].matches[0] : null;
  return {
    matchId: 'gf-m1',
    roundIndex: 0,
    matchIndex: 0,
    title: 'Grand Final',
    team1: resolveWinner(wbFinal, resultMap, allTeams),
    team2: lbFinal ? resolveWinner(lbFinal, resultMap, allTeams) : { team: 'bye' },
  };
}

// ─── Match card props builder ─────────────────────────────────────────────────

function buildMatchCardProps(
  match: InternalMatch,
  resultMap: Map<string, BracketMatchData>,
  colorScheme: MatchCardColorScheme,
  titlesByMatchId: Map<string, string>
) {
  const result = resultMap.get(match.matchId);

  const resolveSlotDisplay = (slot: InternalSlot): { name: string; seed?: number; teamId?: string; isPlaceholder?: boolean } => {
    if (slot.team && slot.team !== 'bye') return { name: slot.team.name, seed: slot.team.seed, teamId: slot.team.id };
    if (slot.fromMatchId) {
      const fromTitle = titlesByMatchId.get(slot.fromMatchId) ?? slot.fromMatchId;
      const prefix = slot.fromMatchIsLoser ? 'Loser of' : 'Winner of';
      return { name: `${prefix} ${fromTitle}`, isPlaceholder: true };
    }
    return { name: 'TBD', isPlaceholder: true };
  };

  const t1Display = resolveSlotDisplay(match.team1);
  const t2Display = resolveSlotDisplay(match.team2);
  const status = result?.status ?? 'upcoming';

  const t1Id = t1Display.teamId;
  const t2Id = t2Display.teamId;

  return {
    title: match.title,
    status,
    colorScheme,
    team1: {
      ...(t1Display.seed !== undefined && { seed: t1Display.seed }),
      name: t1Display.name,
      ...(t1Display.teamId !== undefined && { teamId: t1Display.teamId }),
      ...(t1Display.isPlaceholder && { isPlaceholder: true }),
      ...(result?.team1Score?.setScores !== undefined && { setScores: result.team1Score.setScores }),
      ...(result?.team1Score?.totalSets !== undefined && { totalSets: result.team1Score.totalSets }),
      winner: result?.winnerId != null && result.winnerId === t1Id,
    },
    team2: {
      ...(t2Display.seed !== undefined && { seed: t2Display.seed }),
      name: t2Display.name,
      ...(t2Display.teamId !== undefined && { teamId: t2Display.teamId }),
      ...(t2Display.isPlaceholder && { isPlaceholder: true }),
      ...(result?.team2Score?.setScores !== undefined && { setScores: result.team2Score.setScores }),
      ...(result?.team2Score?.totalSets !== undefined && { totalSets: result.team2Score.totalSets }),
      winner: result?.winnerId != null && result.winnerId === t2Id,
    },
    ...(result?.location !== undefined && { location: result.location }),
    ...(result?.startTime !== undefined && { startTime: result.startTime }),
  };
}

// ─── Single-elim connector SVG ────────────────────────────────────────────────

function isTeamInMatch(match: InternalMatch, teamId: string): boolean {
  const t1 = match.team1.team;
  const t2 = match.team2.team;
  return (!!t1 && t1 !== 'bye' && t1.id === teamId) || (!!t2 && t2 !== 'bye' && t2.id === teamId);
}

interface ConnectorProps {
  roundIndex: number;
  matches: InternalMatch[];
  colHeight: number;
  colorScheme: MatchCardColorScheme;
  cardHeight: number;
  hoveredTeamMatchIds?: Set<string> | undefined;
}

function BracketConnector({ roundIndex, matches, colHeight, colorScheme, cardHeight, hoveredTeamMatchIds }: ConnectorProps) {
  const gap = getRoundGap(roundIndex);
  const topPad = getRoundTopPad(roundIndex);
  const pairCount = matches.length / 2;
  const stroke = colorScheme === 'dark' ? '#FFFFFF' : '#0A0A0A';
  const highlightStroke = colorScheme === 'dark' ? CONNECTOR_HIGHLIGHT_DARK : CONNECTOR_HIGHLIGHT_LIGHT;
  const xMid = CONNECTOR_WIDTH / 2;

  const pathProps = (highlighted: boolean) => highlighted
    ? { stroke: highlightStroke, strokeWidth: 2, fill: 'none' as const }
    : { stroke, strokeWidth: 1, strokeDasharray: '4 4', fill: 'none' as const };

  return (
    <svg
      width={CONNECTOR_WIDTH}
      height={colHeight}
      style={{ flexShrink: 0, display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      {Array.from({ length: pairCount }, (_, i) => {
        const topMatch = matches[2 * i];
        const botMatch = matches[2 * i + 1];
        const topIsReal = topMatch && !isByeMatch(topMatch);
        const botIsReal = botMatch && !isByeMatch(botMatch);

        if (!topIsReal && !botIsReal) return null;

        const topHighlighted = topIsReal && !!hoveredTeamMatchIds?.has(topMatch.matchId);
        const botHighlighted = botIsReal && !!hoveredTeamMatchIds?.has(botMatch.matchId);
        const outHighlighted = topHighlighted || botHighlighted;

        const yTop = topPad + (2 * i) * (cardHeight + gap) + CARD_DIVIDER_OFFSET;
        const yBot = topPad + (2 * i + 1) * (cardHeight + gap) + CARD_DIVIDER_OFFSET;
        const yMid = (yTop + yBot) / 2;

        if (topIsReal && botIsReal) {
          return (
            <g key={i}>
              <path d={`M 0 ${yTop} H ${xMid} V ${yMid}`} {...pathProps(topHighlighted)} />
              <path d={`M 0 ${yBot} H ${xMid} V ${yMid}`} {...pathProps(botHighlighted)} />
              <path d={`M ${xMid} ${yMid} H ${CONNECTOR_WIDTH}`} {...pathProps(outHighlighted)} />
            </g>
          );
        }

        const ySingle = topIsReal ? yTop : yBot;
        const singleHighlighted = topIsReal ? topHighlighted : botHighlighted;
        return (
          <path
            key={i}
            d={`M 0 ${ySingle} H ${xMid} V ${yMid} H ${CONNECTOR_WIDTH}`}
            {...pathProps(singleHighlighted)}
          />
        );
      })}
    </svg>
  );
}

// ─── LB connector SVG ────────────────────────────────────────────────────────
//
// LB rounds come in (minor, major) pairs sharing the same "halvingIndex":
//   halvingIndex = Math.floor(lbRoundIndex / 2)
//
// Between two rounds with the same halvingIndex (major transition):
//   match count stays the same → draw straight horizontal lines (1-to-1).
//
// Between two rounds where halvingIndex increases (minor transition):
//   match count halves → draw the same branching { connector as single elim.

interface LBConnectorProps {
  lbRoundIndex: number; // 0-based index of the FROM round
  matches: InternalMatch[];
  colHeight: number;
  colorScheme: MatchCardColorScheme;
  cardHeight: number;
  hoveredTeamMatchIds?: Set<string>;
}

function LBConnector({ lbRoundIndex, matches, colHeight, colorScheme, cardHeight, hoveredTeamMatchIds }: LBConnectorProps) {
  const halvingIndex = Math.floor(lbRoundIndex / 2);
  const nextHalvingIndex = Math.floor((lbRoundIndex + 1) / 2);
  const stroke = colorScheme === 'dark' ? '#FFFFFF' : '#0A0A0A';
  const highlightStroke = colorScheme === 'dark' ? CONNECTOR_HIGHLIGHT_DARK : CONNECTOR_HIGHLIGHT_LIGHT;

  if (halvingIndex === nextHalvingIndex) {
    // Straight: each match at position i connects directly to the next round's match i.
    // Both rounds have the same halvingIndex so their cards sit at identical y-positions.
    const gap = getRoundGap(halvingIndex);
    const topPad = getRoundTopPad(halvingIndex);
    return (
      <svg
        width={CONNECTOR_WIDTH}
        height={colHeight}
        style={{ flexShrink: 0, display: 'block', overflow: 'visible' }}
        aria-hidden="true"
      >
        {matches.map((match, i) => {
          if (isByeMatch(match)) return null;
          const highlighted = !!hoveredTeamMatchIds?.has(match.matchId);
          const y = topPad + i * (cardHeight + gap) + CARD_DIVIDER_OFFSET;
          return (
            <line
              key={i}
              x1={0} y1={y} x2={CONNECTOR_WIDTH} y2={y}
              stroke={highlighted ? highlightStroke : stroke}
              strokeWidth={highlighted ? 2 : 1}
              strokeDasharray={highlighted ? undefined : '4 4'}
            />
          );
        })}
      </svg>
    );
  }

  // Branching: halvingIndex increases → match count halves.
  // Reuse BracketConnector with the current halvingIndex as roundIndex.
  return (
    <BracketConnector
      roundIndex={halvingIndex}
      matches={matches}
      colHeight={colHeight}
      colorScheme={colorScheme}
      cardHeight={cardHeight}
      hoveredTeamMatchIds={hoveredTeamMatchIds}
    />
  );
}

// ─── Double bracket layout ────────────────────────────────────────────────────

interface DoubleBracketLayoutProps {
  teams: BracketTeam[];
  matchData: BracketMatchData[];
  colorScheme: MatchCardColorScheme;
  cardHeight: number;
  className?: string;
}

function DoubleBracketLayout({
  teams,
  matchData,
  colorScheme,
  cardHeight,
  className,
}: DoubleBracketLayoutProps) {
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);

  const resultMap = useMemo(
    () => new Map(matchData.map(r => [r.matchId, r])),
    [matchData]
  );

  const sorted = useMemo(() => [...teams].sort((a, b) => a.seed - b.seed), [teams]);

  const wbRounds = useMemo(
    () => generateBracket(teams, matchData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teams, matchData]
  );

  const lbRounds = useMemo(
    () => generateLBRounds(wbRounds, resultMap, sorted),
    [wbRounds, resultMap, sorted]
  );

  const gfMatch = useMemo(
    () => buildGrandFinalMatch(wbRounds, lbRounds, resultMap, sorted),
    [wbRounds, lbRounds, resultMap, sorted]
  );

  const titlesByMatchId = useMemo(() => {
    const map = new Map<string, string>();
    for (const round of [...wbRounds, ...lbRounds]) {
      for (const match of round.matches) {
        map.set(match.matchId, match.title);
      }
    }
    map.set(gfMatch.matchId, gfMatch.title);
    return map;
  }, [wbRounds, lbRounds, gfMatch]);

  const hoveredTeamMatchIds = useMemo<Set<string>>(() => {
    if (!hoveredTeamId) return new Set();
    const set = new Set<string>();
    const add = (match: InternalMatch) => {
      if (!isTeamInMatch(match, hoveredTeamId)) return;
      const result = resultMap.get(match.matchId);
      if (result?.winnerId === hoveredTeamId) set.add(match.matchId);
    };
    for (const round of [...wbRounds, ...lbRounds]) {
      for (const match of round.matches) add(match);
    }
    add(gfMatch);
    return set;
  }, [hoveredTeamId, wbRounds, lbRounds, gfMatch, resultMap]);

  return (
    <StyledDoubleBracketWrapper className={className}>

      {/* ── Winners Bracket + Grand Final ── */}
      <StyledBracketSection>
        <StyledSectionHeading $colorScheme={colorScheme}>Winners Bracket</StyledSectionHeading>
        <StyledSectionBody>
          {wbRounds.map((round, ri) => {
            const colHeight = getColumnHeight(round.matches.length, ri);
            const visibleMatches = round.matches.filter(m => !isByeMatch(m));
            return (
              <StyledRoundGroup key={ri}>
                <StyledMatchColumn $height={colHeight}>
                  {visibleMatches.map(match => (
                    <StyledMatchSlot key={match.matchId} $top={getMatchTop(match.matchIndex, ri, cardHeight)}>
                      <MatchCard {...buildMatchCardProps(match, resultMap, colorScheme, titlesByMatchId)} highlightedTeamId={hoveredTeamId ?? undefined} onTeamHover={setHoveredTeamId} onTeamLeave={() => setHoveredTeamId(null)} />
                    </StyledMatchSlot>
                  ))}
                </StyledMatchColumn>
                {ri < wbRounds.length - 1 && (
                  <BracketConnector
                    roundIndex={ri}
                    matches={round.matches}
                    colHeight={colHeight}
                    colorScheme={colorScheme}
                    cardHeight={cardHeight}
                    hoveredTeamMatchIds={hoveredTeamMatchIds}
                  />
                )}
              </StyledRoundGroup>
            );
          })}
          {/* Straight connector from WB Final into Grand Final */}
          {(() => {
            const wbFinalRoundIndex = wbRounds.length - 1;
            const wbFinal = wbRounds[wbFinalRoundIndex].matches[0];
            const gfColHeight = getColumnHeight(1, wbFinalRoundIndex);
            const gfCardTop = getMatchTop(0, wbFinalRoundIndex, cardHeight);
            const highlighted = !!hoveredTeamId && resultMap.get(wbFinal.matchId)?.winnerId === hoveredTeamId;
            const stroke = colorScheme === 'dark' ? '#FFFFFF' : '#0A0A0A';
            const highlightStroke = colorScheme === 'dark' ? CONNECTOR_HIGHLIGHT_DARK : CONNECTOR_HIGHLIGHT_LIGHT;
            const y = gfCardTop + CARD_DIVIDER_OFFSET;
            return (
              <>
                <svg
                  width={CONNECTOR_WIDTH}
                  height={gfColHeight}
                  style={{ flexShrink: 0, display: 'block', overflow: 'visible' }}
                  aria-hidden="true"
                >
                  <line
                    x1={0} y1={y} x2={CONNECTOR_WIDTH} y2={y}
                    stroke={highlighted ? highlightStroke : stroke}
                    strokeWidth={highlighted ? 2 : 1}
                    strokeDasharray={highlighted ? undefined : '4 4'}
                  />
                </svg>
                <StyledMatchColumn $height={gfColHeight}>
                  <StyledMatchSlot $top={gfCardTop}>
                    <MatchCard {...buildMatchCardProps(gfMatch, resultMap, colorScheme, titlesByMatchId)} highlightedTeamId={hoveredTeamId ?? undefined} onTeamHover={setHoveredTeamId} onTeamLeave={() => setHoveredTeamId(null)} />
                  </StyledMatchSlot>
                </StyledMatchColumn>
              </>
            );
          })()}
        </StyledSectionBody>
      </StyledBracketSection>

      {/* ── Losers Bracket ── */}
      {lbRounds.length > 0 && (
        <StyledBracketSection>
          <StyledSectionHeading $colorScheme={colorScheme}>Losers Bracket</StyledSectionHeading>
          <StyledSectionBody>
            {lbRounds.map((round, ri) => {
              const halvingIndex = Math.floor(ri / 2);
              const colHeight = getColumnHeight(round.matches.length, halvingIndex);
              const visibleMatches = round.matches.filter(m => !isByeMatch(m));
              if (visibleMatches.length === 0) return null;
              return (
                <StyledRoundGroup key={ri}>
                  <StyledMatchColumn $height={colHeight}>
                    {visibleMatches.map(match => (
                      <StyledMatchSlot key={match.matchId} $top={getMatchTop(match.matchIndex, halvingIndex, cardHeight)}>
                        <MatchCard {...buildMatchCardProps(match, resultMap, colorScheme, titlesByMatchId)} highlightedTeamId={hoveredTeamId ?? undefined} onTeamHover={setHoveredTeamId} onTeamLeave={() => setHoveredTeamId(null)} />
                      </StyledMatchSlot>
                    ))}
                  </StyledMatchColumn>
                  {ri < lbRounds.length - 1 && (
                    <LBConnector
                      lbRoundIndex={ri}
                      matches={round.matches}
                      colHeight={colHeight}
                      colorScheme={colorScheme}
                      cardHeight={cardHeight}
                      hoveredTeamMatchIds={hoveredTeamMatchIds}
                    />
                  )}
                </StyledRoundGroup>
              );
            })}
          </StyledSectionBody>
        </StyledBracketSection>
      )}

    </StyledDoubleBracketWrapper>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Bracket({
  teams,
  matchData = [],
  colorScheme = 'light',
  cardHeight = CARD_HEIGHT,
  eliminationFormat = 'single',
  className,
}: BracketProps) {
  if (eliminationFormat === 'double') {
    return (
      <DoubleBracketLayout
        teams={teams}
        matchData={matchData}
        colorScheme={colorScheme}
        cardHeight={cardHeight}
        className={className}
      />
    );
  }

  // ── Single elimination ──────────────────────────────────────────────────────

  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);

  const resultMap = useMemo(
    () => new Map(matchData.map(r => [r.matchId, r])),
    [matchData]
  );

  const rounds = useMemo(
    () => generateBracket(teams, matchData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teams, matchData]
  );

  const titlesByMatchId = useMemo(() => {
    const map = new Map<string, string>();
    for (const round of rounds) {
      for (const match of round.matches) {
        map.set(match.matchId, match.title);
      }
    }
    return map;
  }, [rounds]);

  const hoveredTeamMatchIds = useMemo<Set<string>>(() => {
    if (!hoveredTeamId) return new Set();
    const set = new Set<string>();
    for (const round of rounds) {
      for (const match of round.matches) {
        if (!isTeamInMatch(match, hoveredTeamId)) continue;
        const result = resultMap.get(match.matchId);
        if (result?.winnerId === hoveredTeamId) set.add(match.matchId);
      }
    }
    return set;
  }, [hoveredTeamId, rounds, resultMap]);

  return (
    <StyledBracket className={className}>
      {rounds.map((round, ri) => {
        const colHeight = getColumnHeight(round.matches.length, ri);
        const visibleMatches = round.matches.filter(m => !isByeMatch(m));

        return (
          <StyledRoundGroup key={ri}>
            <StyledMatchColumn $height={colHeight}>
              {visibleMatches.map(match => (
                <StyledMatchSlot
                  key={match.matchId}
                  $top={getMatchTop(match.matchIndex, ri, cardHeight)}
                >
                  <MatchCard
                    {...buildMatchCardProps(match, resultMap, colorScheme, titlesByMatchId)}
                    highlightedTeamId={hoveredTeamId ?? undefined}
                    onTeamHover={setHoveredTeamId}
                    onTeamLeave={() => setHoveredTeamId(null)}
                  />
                </StyledMatchSlot>
              ))}
            </StyledMatchColumn>
            {ri < rounds.length - 1 && (
              <BracketConnector
                roundIndex={ri}
                matches={round.matches}
                colHeight={colHeight}
                colorScheme={colorScheme}
                cardHeight={cardHeight}
                hoveredTeamMatchIds={hoveredTeamMatchIds}
              />
            )}
          </StyledRoundGroup>
        );
      })}
    </StyledBracket>
  );
}
