import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MatchCard } from '../MatchCard/MatchCard';
import { MatchView, MatchViewOverlay } from '../MatchView/MatchView';
import type { MatchViewProps, MatchViewTeam, MatchViewWinnerPath, MatchViewLoserPath } from '../MatchView/MatchView';
import { cssVars } from '@lockin/tokens';
import {
  StyledBracket,
  StyledRoundGroup,
  StyledMatchColumn,
  StyledMatchSlot,
  StyledDoubleBracketWrapper,
  StyledBracketSection,
  StyledSectionBody,
  StyledRoundHeaders,
  StyledRoundHeader,
  StyledRoundHeaderLabel,
  StyledRoundHeaderDivider,
  StyledRoundHeaderSpacer,
  CONNECTOR_WIDTH,
} from './Bracket.styles';
import {
  buildGrandFinalMatch,
  generateBracket,
  generateLBRounds,
  getWBRoundDisplayName,
  isByeMatch,
} from '../../bracket-model';
import type {
  BracketMatchData,
  BracketMatchScore,
  BracketTeam,
  InternalMatch,
  InternalRound,
  InternalSlot,
} from '../../bracket-model';

export type { BracketMatchData, BracketMatchScore, BracketTeam };

// ─── Layout constants ─────────────────────────────────────────────────────────
// Derived from MatchCard rendered dimensions. Update if MatchCard layout changes.
// CARD_HEIGHT = 8(py) + 85(scorecard) + 4(gap) + 20(footer) + 8(py) = 125
const CARD_HEIGHT = 125;
const BASE_GAP = 0;
const CONNECTOR_STROKE = cssVars.color.border.strong;
const CONNECTOR_HIGHLIGHT = cssVars.color.border.success;

// Vertical offset from the top of a MatchCard to the centre of its team divider line.
// 8(card py) + 2(scorecard border) + 40(team row: 8+24+8) + 0.5(divider centre)
const CARD_DIVIDER_OFFSET = 50.5;

// ─── Single-elim spacing helpers ─────────────────────────────────────────────

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


// ─── Types ────────────────────────────────────────────────────────────────────


export interface BracketProps {
  /** Teams in the bracket. The bracket size is derived from this list. */
  teams: BracketTeam[];
  /** Optional match results and metadata, keyed by matchId. */
  matchData?: BracketMatchData[];
  /**
   * Override the assumed MatchCard height (px) used to compute connector positions.
   * Default: 153.
   */
  cardHeight?: number;
  /** Single or double elimination. Default: 'single'. */
  eliminationFormat?: 'single' | 'double';
  /**
   * Content for the open match's detail view, such as scoring controls. Called with the
   * match's id (the same ids as `matchData`) and shown under its score card.
   */
  renderMatchActions?: (matchId: string) => React.ReactNode;
  className?: string;
}

// ─── Match card props builder ─────────────────────────────────────────────────

function buildMatchCardProps(
  match: InternalMatch,
  resultMap: Map<string, BracketMatchData>,
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
    matchId: match.shortId,
    status,
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
    ...(result?.videoUrl  !== undefined && { videoUrl:  result.videoUrl  }),
  };
}

// ─── MatchView helpers ────────────────────────────────────────────────────────

/**
 * Returns the matchId of the match a winner advances to, computed structurally
 * from the match ID pattern (avoids relying on fromMatchId which is cleared once
 * a result is known).
 */
function getWinnerNextMatchId(
  matchId: string,
  wbRoundCount: number,
  lbRoundCount: number
): string | undefined {
  const wb = matchId.match(/^r(\d+)-m(\d+)$/);
  if (wb) {
    const r = +wb[1], m = +wb[2];
    if (r < wbRoundCount) return `r${r + 1}-m${Math.ceil(m / 2)}`;
    return lbRoundCount > 0 ? 'gf-m1' : undefined;
  }
  const lb = matchId.match(/^lb-r(\d+)-m(\d+)$/);
  if (lb) {
    const r = +lb[1], m = +lb[2];
    if (r < lbRoundCount) {
      const halvingIndex     = Math.floor((r - 1) / 2);
      const nextHalvingIndex = Math.floor(r / 2);
      return halvingIndex === nextHalvingIndex
        ? `lb-r${r + 1}-m${m}`
        : `lb-r${r + 1}-m${Math.ceil(m / 2)}`;
    }
    return 'gf-m1';
  }
  return undefined;
}

/**
 * Returns the LB match that receives the loser of the given WB match.
 * Uses the structural pairing rules, so it works even after results are resolved.
 */
function getLoserLBMatch(
  wbMatchId: string,
  lbRounds: InternalRound[]
): InternalMatch | undefined {
  const wb = wbMatchId.match(/^r(\d+)-m(\d+)$/);
  if (!wb) return undefined;
  const r = +wb[1], m = +wb[2];
  if (r === 1) {
    // Two WB R1 losers pair into one LB R1 match
    return lbRounds[0]?.matches[Math.ceil(m / 2) - 1];
  }
  // WB R{r} loser → LB R{2(r-1)} as team2, 1-to-1 (0-based round index: 2r-3)
  return lbRounds[2 * r - 3]?.matches[m - 1];
}

function ordinal(n: number): string {
  const v = n % 100;
  const suffix =
    v === 11 || v === 12 || v === 13 ? 'th'
    : n % 10 === 1 ? 'st'
    : n % 10 === 2 ? 'nd'
    : n % 10 === 3 ? 'rd'
    : 'th';
  return `${n}${suffix}`;
}

/**
 * Returns the best finishing placement for a team eliminated in the given LB round,
 * e.g. "7th" for a team that could finish 7th–8th.
 *
 * teamsAbove = sum of eliminations in all later LB rounds (each of those placed higher)
 * bestPlace  = teamsAbove + 3  (+1 for 1st, +1 for 2nd, +1 to step past them)
 */
function getLBLoserPlacement(lbRoundNum: number, totalLBRounds: number, wbRoundCount: number): string {
  const bracketSize = Math.pow(2, wbRoundCount);
  const matchesInRound = (r: number) =>
    bracketSize / Math.pow(2, Math.floor((r - 1) / 2) + 2);

  let teamsAbove = 0;
  for (let r = lbRoundNum + 1; r <= totalLBRounds; r++) {
    teamsAbove += matchesInRound(r);
  }

  return ordinal(teamsAbove + 3);
}

function getBracketSection(matchId: string, eliminationFormat: 'single' | 'double'): string {
  if (eliminationFormat === 'single') return 'Bracket';
  if (matchId.startsWith('lb-')) return 'Losers Bracket';
  if (matchId.startsWith('gf-')) return 'Grand Final';
  return 'Winners Bracket';
}

function buildMatchViewData(
  match: InternalMatch,
  resultMap: Map<string, BracketMatchData>,
  titlesByMatchId: Map<string, string>,
  allMatches: InternalMatch[],
  wbRoundCount: number,
  lbRounds: InternalRound[],
  eliminationFormat: 'single' | 'double',
  onNavigate: (matchId: string) => void,
  onClose: () => void
): MatchViewProps {
  const result = resultMap.get(match.matchId);
  const status = result?.status ?? 'upcoming';
  const isLB = match.matchId.startsWith('lb-');
  const isGF = match.matchId.startsWith('gf-');

  const resolveTeam = (slot: InternalSlot, score?: BracketMatchScore, winner?: boolean): MatchViewTeam => {
    if (slot.team && slot.team !== 'bye') {
      const t = slot.team as BracketTeam;
      return {
        name: t.name,
        seed: t.seed,
        ...(score?.setScores !== undefined && { setScores: score.setScores }),
        ...(score?.totalSets !== undefined && { totalSets: score.totalSets }),
        ...(winner !== undefined && { winner }),
      };
    }
    if (slot.fromMatchId) {
      const fromTitle = titlesByMatchId.get(slot.fromMatchId) ?? slot.fromMatchId;
      return { name: `${slot.fromMatchIsLoser ? 'Loser' : 'Winner'} of ${fromTitle}` };
    }
    return { name: 'TBD' };
  };

  const t1IsWinner = !!(result?.winnerId && match.team1.team && match.team1.team !== 'bye' &&
    (match.team1.team as BracketTeam).id === result.winnerId);
  const t2IsWinner = !!(result?.winnerId && match.team2.team && match.team2.team !== 'bye' &&
    (match.team2.team as BracketTeam).id === result.winnerId);

  const team1 = resolveTeam(match.team1, result?.team1Score, t1IsWinner);
  const team2 = resolveTeam(match.team2, result?.team2Score, t2IsWinner);

  const nextWinnerMatchId = isGF
    ? undefined
    : getWinnerNextMatchId(match.matchId, wbRoundCount, lbRounds.length);
  const nextWinnerMatch = nextWinnerMatchId
    ? allMatches.find(m => m.matchId === nextWinnerMatchId)
    : undefined;

  const winnerPath: MatchViewWinnerPath = nextWinnerMatch
    ? { destination: nextWinnerMatch.title, onNavigate: () => onNavigate(nextWinnerMatch.matchId) }
    : { destination: ordinal(1) };

  let loserPath: MatchViewLoserPath;
  if (isGF) {
    loserPath = { destination: ordinal(2), eliminated: true };
  } else if (!isLB && eliminationFormat === 'double') {
    const lbMatch = getLoserLBMatch(match.matchId, lbRounds);
    loserPath = lbMatch
      ? { destination: lbMatch.title, onNavigate: () => onNavigate(lbMatch.matchId) }
      : { destination: 'Losers Bracket' };
  } else if (isLB) {
    const lb = match.matchId.match(/^lb-r(\d+)-/);
    const lbRoundNum = lb ? +lb[1] : 1;
    loserPath = { destination: getLBLoserPlacement(lbRoundNum, lbRounds.length, wbRoundCount), eliminated: true };
  } else {
    // Single-elim: loser of round r in a bracketSize=2^wbRoundCount bracket
    // finishes at best in position bracketSize/2^r + 1
    const se = match.matchId.match(/^r(\d+)-/);
    const r = se ? +se[1] : wbRoundCount;
    const bestPlace = Math.pow(2, wbRoundCount) / Math.pow(2, r) + 1;
    loserPath = { destination: ordinal(bestPlace), eliminated: true };
  }

  return {
    bracketSection: getBracketSection(match.matchId, eliminationFormat),
    matchName: match.title,
    status,
    team1,
    team2,
    ...(result?.startTime !== undefined && { startTime: result.startTime }),
    ...(result?.location  !== undefined && { location:  result.location  }),
    ...(result?.videoUrl  !== undefined && { videoUrl:  result.videoUrl  }),
    winnerPath,
    loserPath,
    onClose,
  };
}

// ─── Single-elim connector SVG ────────────────────────────────────────────────

interface ConnectorProps {
  roundIndex: number;
  matches: InternalMatch[];
  colHeight: number;
  cardHeight: number;
  hoveredTeamMatchIds?: Set<string> | undefined;
}

function BracketConnector({ roundIndex, matches, colHeight, cardHeight, hoveredTeamMatchIds }: ConnectorProps) {
  const gap = getRoundGap(roundIndex);
  const topPad = getRoundTopPad(roundIndex);
  const pairCount = matches.length / 2;
  const xMid = CONNECTOR_WIDTH / 2;

  const pathProps = (highlighted: boolean) => highlighted
    ? { stroke: CONNECTOR_HIGHLIGHT, strokeWidth: 2, fill: 'none' as const }
    : { stroke: CONNECTOR_STROKE, strokeWidth: 1, strokeDasharray: '4 4', fill: 'none' as const };

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
  cardHeight: number;
  hoveredTeamMatchIds?: Set<string>;
}

function LBConnector({ lbRoundIndex, matches, colHeight, cardHeight, hoveredTeamMatchIds }: LBConnectorProps) {
  const halvingIndex = Math.floor(lbRoundIndex / 2);
  const nextHalvingIndex = Math.floor((lbRoundIndex + 1) / 2);

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
              stroke={highlighted ? CONNECTOR_HIGHLIGHT : CONNECTOR_STROKE}
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
      cardHeight={cardHeight}
      hoveredTeamMatchIds={hoveredTeamMatchIds}
    />
  );
}

// ─── Double bracket layout ────────────────────────────────────────────────────

interface DoubleBracketLayoutProps {
  teams: BracketTeam[];
  matchData: BracketMatchData[];
  cardHeight: number;
  renderMatchActions?: (matchId: string) => React.ReactNode;
  className?: string;
}

function DoubleBracketLayout({
  teams,
  matchData,
  cardHeight,
  renderMatchActions,
  className,
}: DoubleBracketLayoutProps) {
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);
  const clearHoveredTeam = useCallback(() => setHoveredTeamId(null), []);

  const resultMap = useMemo(
    () => new Map(matchData.map(r => [r.matchId, r])),
    [matchData]
  );

  const sorted = useMemo(() => [...teams].sort((a, b) => a.seed - b.seed), [teams]);

  const wbRounds = useMemo(
    () => generateBracket(teams, matchData, true),
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

  const winnerMatchIdsByTeam = useMemo<Map<string, Set<string>>>(() => {
    const map = new Map<string, Set<string>>();
    const addMatch = (match: InternalMatch) => {
      const winnerId = resultMap.get(match.matchId)?.winnerId;
      if (!winnerId) return;
      if (!map.has(winnerId)) map.set(winnerId, new Set());
      map.get(winnerId)!.add(match.matchId);
    };
    for (const round of [...wbRounds, ...lbRounds]) {
      for (const match of round.matches) addMatch(match);
    }
    addMatch(gfMatch);
    return map;
  }, [wbRounds, lbRounds, gfMatch, resultMap]);

  const hoveredTeamMatchIds = useMemo<Set<string>>(
    () => hoveredTeamId ? winnerMatchIdsByTeam.get(hoveredTeamId) ?? new Set() : new Set(),
    [hoveredTeamId, winnerMatchIdsByTeam]
  );

  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const bracketRef = useRef<HTMLDivElement>(null);

  const allMatches = useMemo(
    () => [...wbRounds.flatMap(r => r.matches), ...lbRounds.flatMap(r => r.matches), gfMatch],
    [wbRounds, lbRounds, gfMatch]
  );

  const allMatchesById = useMemo(
    () => new Map(allMatches.map(m => [m.matchId, m])),
    [allMatches]
  );

  const wbVisibleMatches = useMemo(
    () => wbRounds.map(r => r.matches.filter(m => !isByeMatch(m))),
    [wbRounds]
  );

  const lbVisibleMatches = useMemo(
    () => lbRounds.map(r => r.matches.filter(m => !isByeMatch(m))),
    [lbRounds]
  );

  useEffect(() => {
    if (!selectedMatchId || !bracketRef.current) return;
    const el = bracketRef.current.querySelector<HTMLElement>(`[data-match-id="${selectedMatchId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [selectedMatchId]);

  const handleMatchSelect = (matchId: string) => setSelectedMatchId(matchId);
  const handleOverlayClose = () => setSelectedMatchId(null);
  const selectedMatch = selectedMatchId ? allMatchesById.get(selectedMatchId) ?? null : null;

  return (
    <>
    <StyledDoubleBracketWrapper ref={bracketRef} className={className}>

      {/* ── Winners Bracket + Grand Final ── */}
      <StyledBracketSection>
        <StyledRoundHeaders>
          {wbRounds.map((round, ri) => (
            <Fragment key={ri}>
              <StyledRoundHeader>
                <StyledRoundHeaderLabel>{getWBRoundDisplayName(round.roundName, ri)}</StyledRoundHeaderLabel>
                <StyledRoundHeaderDivider />
              </StyledRoundHeader>
              <StyledRoundHeaderSpacer />
            </Fragment>
          ))}
          <StyledRoundHeader>
            <StyledRoundHeaderLabel>Grand Final</StyledRoundHeaderLabel>
            <StyledRoundHeaderDivider />
          </StyledRoundHeader>
        </StyledRoundHeaders>
        <StyledSectionBody>
          {wbRounds.map((round, ri) => {
            const colHeight = getColumnHeight(round.matches.length, ri);
            const visibleMatches = wbVisibleMatches[ri];
            return (
              <StyledRoundGroup key={ri}>
                <StyledMatchColumn $height={colHeight}>
                  {visibleMatches.map(match => (
                    <StyledMatchSlot
                      key={match.matchId}
                      $top={getMatchTop(match.matchIndex, ri, cardHeight)}
                      data-match-id={match.matchId}
                      onClick={() => handleMatchSelect(match.matchId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <MatchCard {...buildMatchCardProps(match, resultMap, titlesByMatchId)} highlightedTeamId={hoveredTeamId ?? undefined} onTeamHover={setHoveredTeamId} onTeamLeave={clearHoveredTeam} />
                    </StyledMatchSlot>
                  ))}
                </StyledMatchColumn>
                {ri < wbRounds.length - 1 && (
                  <BracketConnector
                    roundIndex={ri}
                    matches={round.matches}
                    colHeight={colHeight}
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
                    stroke={highlighted ? CONNECTOR_HIGHLIGHT : CONNECTOR_STROKE}
                    strokeWidth={highlighted ? 2 : 1}
                    strokeDasharray={highlighted ? undefined : '4 4'}
                  />
                </svg>
                <StyledMatchColumn $height={gfColHeight}>
                  <StyledMatchSlot
                    $top={gfCardTop}
                    data-match-id={gfMatch.matchId}
                    onClick={() => handleMatchSelect(gfMatch.matchId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <MatchCard {...buildMatchCardProps(gfMatch, resultMap, titlesByMatchId)} highlightedTeamId={hoveredTeamId ?? undefined} onTeamHover={setHoveredTeamId} onTeamLeave={clearHoveredTeam} />
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
          <StyledRoundHeaders>
            {(() => {
              const visibleRounds = lbRounds
                .map((round, ri) => ({ round, ri }))
                .filter(({ round }) => round.matches.some(m => !isByeMatch(m)));
              return visibleRounds.map(({ round, ri }, vi) => (
                <Fragment key={ri}>
                  <StyledRoundHeader>
                    <StyledRoundHeaderLabel>{round.roundName}</StyledRoundHeaderLabel>
                    <StyledRoundHeaderDivider />
                  </StyledRoundHeader>
                  {vi < visibleRounds.length - 1 && <StyledRoundHeaderSpacer />}
                </Fragment>
              ));
            })()}
          </StyledRoundHeaders>
          <StyledSectionBody>
            {lbRounds.map((round, ri) => {
              const halvingIndex = Math.floor(ri / 2);
              const colHeight = getColumnHeight(round.matches.length, halvingIndex);
              const visibleMatches = lbVisibleMatches[ri];
              if (visibleMatches.length === 0) return null;
              return (
                <StyledRoundGroup key={ri}>
                  <StyledMatchColumn $height={colHeight}>
                    {visibleMatches.map(match => (
                      <StyledMatchSlot
                        key={match.matchId}
                        $top={getMatchTop(match.matchIndex, halvingIndex, cardHeight)}
                        data-match-id={match.matchId}
                        onClick={() => handleMatchSelect(match.matchId)}
                        style={{ cursor: 'pointer' }}
                      >
                        <MatchCard {...buildMatchCardProps(match, resultMap, titlesByMatchId)} highlightedTeamId={hoveredTeamId ?? undefined} onTeamHover={setHoveredTeamId} onTeamLeave={clearHoveredTeam} />
                      </StyledMatchSlot>
                    ))}
                  </StyledMatchColumn>
                  {ri < lbRounds.length - 1 && (
                    <LBConnector
                      lbRoundIndex={ri}
                      matches={round.matches}
                      colHeight={colHeight}
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
    {selectedMatch && (
      <MatchViewOverlay onClose={handleOverlayClose}>
        <MatchView
          {...buildMatchViewData(
            selectedMatch,
            resultMap,
            titlesByMatchId,
            allMatches,
            wbRounds.length,
            lbRounds,
            'double',
            handleMatchSelect,
            handleOverlayClose
          )}
          {...(renderMatchActions && { scoring: renderMatchActions(selectedMatch.matchId) })}
        />
      </MatchViewOverlay>
    )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Bracket({
  teams,
  matchData = [],
  cardHeight = CARD_HEIGHT,
  eliminationFormat = 'single',
  renderMatchActions,
  className,
}: BracketProps) {
  if (eliminationFormat === 'double') {
    return (
      <DoubleBracketLayout
        teams={teams}
        matchData={matchData}
        cardHeight={cardHeight}
        {...(renderMatchActions !== undefined && { renderMatchActions })}
        {...(className !== undefined && { className })}
      />
    );
  }

  // ── Single elimination ──────────────────────────────────────────────────────

  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);
  const clearHoveredTeam = useCallback(() => setHoveredTeamId(null), []);

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

  const winnerMatchIdsByTeam = useMemo<Map<string, Set<string>>>(() => {
    const map = new Map<string, Set<string>>();
    for (const round of rounds) {
      for (const match of round.matches) {
        const winnerId = resultMap.get(match.matchId)?.winnerId;
        if (!winnerId) continue;
        if (!map.has(winnerId)) map.set(winnerId, new Set());
        map.get(winnerId)!.add(match.matchId);
      }
    }
    return map;
  }, [rounds, resultMap]);

  const hoveredTeamMatchIds = useMemo<Set<string>>(
    () => hoveredTeamId ? winnerMatchIdsByTeam.get(hoveredTeamId) ?? new Set() : new Set(),
    [hoveredTeamId, winnerMatchIdsByTeam]
  );

  const visibleMatchesByRound = useMemo(
    () => rounds.map(r => r.matches.filter(m => !isByeMatch(m))),
    [rounds]
  );

  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const bracketRef = useRef<HTMLDivElement>(null);

  const allMatches = useMemo(() => rounds.flatMap(r => r.matches), [rounds]);

  const allMatchesById = useMemo(
    () => new Map(allMatches.map(m => [m.matchId, m])),
    [allMatches]
  );

  useEffect(() => {
    if (!selectedMatchId || !bracketRef.current) return;
    const el = bracketRef.current.querySelector<HTMLElement>(`[data-match-id="${selectedMatchId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [selectedMatchId]);

  const handleMatchSelect = (matchId: string) => setSelectedMatchId(matchId);
  const handleOverlayClose = () => setSelectedMatchId(null);
  const selectedMatch = selectedMatchId ? allMatchesById.get(selectedMatchId) ?? null : null;

  return (
    <>
    <StyledBracket ref={bracketRef} className={className}>
      <StyledRoundHeaders>
        {rounds.map((round, ri) => (
          <Fragment key={ri}>
            <StyledRoundHeader>
              <StyledRoundHeaderLabel>{round.roundName}</StyledRoundHeaderLabel>
              <StyledRoundHeaderDivider />
            </StyledRoundHeader>
            {ri < rounds.length - 1 && <StyledRoundHeaderSpacer />}
          </Fragment>
        ))}
      </StyledRoundHeaders>
      <StyledSectionBody>
        {rounds.map((round, ri) => {
          const colHeight = getColumnHeight(round.matches.length, ri);
          const visibleMatches = visibleMatchesByRound[ri];

          return (
            <StyledRoundGroup key={ri}>
              <StyledMatchColumn $height={colHeight}>
                {visibleMatches.map(match => (
                  <StyledMatchSlot
                    key={match.matchId}
                    $top={getMatchTop(match.matchIndex, ri, cardHeight)}
                    data-match-id={match.matchId}
                    onClick={() => handleMatchSelect(match.matchId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <MatchCard
                      {...buildMatchCardProps(match, resultMap, titlesByMatchId)}
                      highlightedTeamId={hoveredTeamId ?? undefined}
                      onTeamHover={setHoveredTeamId}
                      onTeamLeave={clearHoveredTeam}
                    />
                  </StyledMatchSlot>
                ))}
              </StyledMatchColumn>
              {ri < rounds.length - 1 && (
                <BracketConnector
                  roundIndex={ri}
                  matches={round.matches}
                  colHeight={colHeight}
                  cardHeight={cardHeight}
                  hoveredTeamMatchIds={hoveredTeamMatchIds}
                />
              )}
            </StyledRoundGroup>
          );
        })}
      </StyledSectionBody>
    </StyledBracket>
    {selectedMatch && (
      <MatchViewOverlay onClose={handleOverlayClose}>
        <MatchView
          {...buildMatchViewData(
            selectedMatch,
            resultMap,
            titlesByMatchId,
            allMatches,
            rounds.length,
            [],
            'single',
            handleMatchSelect,
            handleOverlayClose
          )}
          {...(renderMatchActions && { scoring: renderMatchActions(selectedMatch.matchId) })}
        />
      </MatchViewOverlay>
    )}
    </>
  );
}
