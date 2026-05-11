import {
  StyledMatchCard,
  StyledScoreCardWrapper,
  StyledMatchIdMarker,
  StyledScoreCard,
  StyledTeamRow,
  StyledTeamLeft,
  StyledSeed,
  StyledTeamName,
  StyledTeamRight,
  StyledSetScores,
  StyledSetScore,
  StyledSetBadge,
  StyledDivider,
  StyledFooter,
  StyledStatusGroup,
  StyledStatusLabel,
  StyledFooterMeta,
  type TeamRowHighlight,
} from './MatchCard.styles';

export type MatchCardStatus = 'completed' | 'live' | 'upcoming';
export type MatchCardColorScheme = 'light' | 'dark';

export interface MatchCardTeam {
  /** Seed number shown before team name */
  seed?: number;
  /** Team name, or placeholder for upcoming matches */
  name: string;
  /** True when name is origin text (e.g. "Winner of Quarterfinal #3") rather than a scheduled team */
  isPlaceholder?: boolean;
  /** Unique team identifier used for cross-card hover highlighting */
  teamId?: string;
  /** Individual set scores (e.g. [19, 12]) */
  setScores?: number[];
  /** Total sets won */
  totalSets?: number;
  /** Whether this team won the match */
  winner?: boolean;
}

export interface MatchCardProps {
  /** Short match identifier shown as a badge on the left (e.g. "1", "L3", "GF") */
  matchId?: string;
  /** Current match status */
  status?: MatchCardStatus;
  /** Light or dark color scheme */
  colorScheme?: MatchCardColorScheme;
  /** Top team data */
  team1?: MatchCardTeam;
  /** Bottom team data */
  team2?: MatchCardTeam;
  /** Court or venue label */
  location?: string;
  /** Scheduled start time (shown for upcoming matches) */
  startTime?: string;
  /** Live stream URL — when provided, the TV icon is shown on live matches */
  videoUrl?: string;
  /** ID of the team whose rows should be highlighted across all cards */
  highlightedTeamId?: string | undefined;
  /** Called when a team row is hovered — passes the team's ID */
  onTeamHover?: ((teamId: string) => void) | undefined;
  /** Called when a team row is no longer hovered */
  onTeamLeave?: (() => void) | undefined;
  /** Renders only the score card rows, without the title or status footer. Width becomes 100%. */
  scoreOnly?: boolean;
  className?: string;
}

const LiveTvIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 14H3V8h18v12zm-10-3.5l6-4.5-6-4.5v9z" />
  </svg>
);

interface TeamRowProps {
  team: MatchCardTeam;
  opponent?: MatchCardTeam;
  status: MatchCardStatus;
  colorScheme: MatchCardColorScheme;
  highlightedTeamId?: string | undefined;
  onTeamHover?: ((teamId: string) => void) | undefined;
  onTeamLeave?: (() => void) | undefined;
}

function TeamRow({ team, opponent, status, colorScheme, highlightedTeamId, onTeamHover, onTeamLeave }: TeamRowProps) {
  const isUpcoming = status === 'upcoming';
  const isWinner = status === 'completed' && !!team.winner;
  const opponentScores = opponent?.setScores ?? [];

  const highlight: TeamRowHighlight = !!team.teamId && team.teamId === highlightedTeamId
    ? status === 'completed'
      ? team.winner ? 'win' : 'loss'
      : 'pending'
    : false;

  return (
    <StyledTeamRow
      $status={status}
      $colorScheme={colorScheme}
      $highlight={highlight}
      onMouseEnter={team.teamId ? () => onTeamHover?.(team.teamId!) : undefined}
      onMouseLeave={team.teamId ? onTeamLeave : undefined}
    >
      <StyledTeamLeft>
        {team.seed != null && (
          <StyledSeed $colorScheme={colorScheme}>{team.seed}</StyledSeed>
        )}
        <StyledTeamName $status={status} $winner={isWinner} $colorScheme={colorScheme} $isPlaceholder={!!team.isPlaceholder}>
          {team.name}
        </StyledTeamName>
      </StyledTeamLeft>
      {!isUpcoming && (
        <StyledTeamRight>
          {team.setScores && team.setScores.length > 0 && (
            <StyledSetScores $colorScheme={colorScheme}>
              {team.setScores.map((score, i) => (
                <StyledSetScore
                  key={i}
                  $winner={opponentScores[i] != null && score > opponentScores[i]}
                >
                  {score}
                </StyledSetScore>
              ))}
            </StyledSetScores>
          )}
          {team.totalSets != null && (
            <StyledSetBadge $winner={isWinner} $colorScheme={colorScheme}>
              {team.totalSets}
            </StyledSetBadge>
          )}
        </StyledTeamRight>
      )}
    </StyledTeamRow>
  );
}

export function MatchCard({
  matchId,
  status = 'completed',
  colorScheme = 'light',
  team1 = { seed: 12, name: 'Team 1', setScores: [19, 12], totalSets: 0 },
  team2 = { name: 'Team 2', setScores: [21, 21], totalSets: 2, winner: true },
  location = 'Court 2',
  startTime = '12:00 PM',
  videoUrl,
  highlightedTeamId,
  onTeamHover,
  onTeamLeave,
  scoreOnly = false,
  className,
}: MatchCardProps) {
  const isLive = status === 'live';
  const isUpcoming = status === 'upcoming';

  return (
    <StyledMatchCard $colorScheme={colorScheme} $scoreOnly={scoreOnly} className={className}>
      <StyledScoreCardWrapper>
        {!scoreOnly && matchId && (
          <StyledMatchIdMarker $colorScheme={colorScheme}>{matchId}</StyledMatchIdMarker>
        )}
        <StyledScoreCard $colorScheme={colorScheme}>
          <TeamRow team={team1} opponent={team2} status={status} colorScheme={colorScheme} highlightedTeamId={highlightedTeamId} onTeamHover={onTeamHover} onTeamLeave={onTeamLeave} />
          <StyledDivider $colorScheme={colorScheme} />
          <TeamRow team={team2} opponent={team1} status={status} colorScheme={colorScheme} highlightedTeamId={highlightedTeamId} onTeamHover={onTeamHover} onTeamLeave={onTeamLeave} />
        </StyledScoreCard>
      </StyledScoreCardWrapper>
      {!scoreOnly && (
        <StyledFooter>
          <StyledStatusGroup>
            {status === 'completed' && (
              <StyledStatusLabel $status="completed">COMPLETED</StyledStatusLabel>
            )}
            {isLive && (
              <>
                <StyledStatusLabel $status="live">LIVE</StyledStatusLabel>
                {videoUrl && <LiveTvIcon />}
              </>
            )}
            {isUpcoming && (
              <StyledStatusLabel $status="upcoming">UPCOMING</StyledStatusLabel>
            )}
          </StyledStatusGroup>
          {(isLive || isUpcoming) && (
            <StyledFooterMeta $colorScheme={colorScheme}>
              {location && <span>{location}</span>}
              {isUpcoming && startTime && <span>{startTime}</span>}
            </StyledFooterMeta>
          )}
        </StyledFooter>
      )}
    </StyledMatchCard>
  );
}
