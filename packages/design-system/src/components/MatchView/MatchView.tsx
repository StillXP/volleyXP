import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { Link } from '../Link';
import { MatchCard } from '../MatchCard';
import type { MatchCardStatus } from '../MatchCard';
import {
  StyledMatchView,
  StyledHeader,
  StyledHeaderLeft,
  StyledSectionLabel,
  StyledMatchName,
  StyledStatusBadge,
  StyledDivider,
  StyledScoreSection,
  StyledMetaRow,
  StyledMetaText,
  StyledPathsSection,
  StyledPathsHeading,
  StyledPathCard,
  StyledPathIconBubble,
  StyledPathInfo,
  StyledPathSublabel,
  StyledPathDestination,
  StyledActions,
  StyledButtonGroup,
  StyledShareWrapper,
  StyledShareTooltip,
  StyledOutlineButton,
  StyledPathNavButton,
  StyledOverlay,
  PATH_LINK_STYLE,
} from './MatchView.styles';
import type { PathOutcome } from './MatchView.styles';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchViewTeam {
  seed?: number;
  name: string;
  setScores?: number[];
  totalSets?: number;
  winner?: boolean;
}

export interface MatchViewWinnerPath {
  /** Round or stage label, e.g. "Semifinal 1" */
  destination: string;
  /** Optional href to navigate to the winner's next match */
  href?: string;
  /** In-bracket callback; takes priority over href when both are provided */
  onNavigate?: () => void;
}

export interface MatchViewLoserPath {
  /** Round label ("LB Round 2") or placement ("13th") */
  destination: string;
  /**
   * When true, losing this match means elimination from the tournament.
   * Shows "Loser places [destination]" instead of "Loser advances to [destination]".
   */
  eliminated?: boolean;
  /** Optional href to navigate to the loser's next match or placement page */
  href?: string;
  /** In-bracket callback; takes priority over href when both are provided */
  onNavigate?: () => void;
}

export interface MatchViewProps {
  /** Bracket section label, e.g. "Winners Bracket" */
  bracketSection: string;
  /** Match name, e.g. "Quarterfinal #1" */
  matchName: string;
  /** Current match status */
  status: 'upcoming' | 'live' | 'completed';
  /** Top team */
  team1: MatchViewTeam;
  /** Bottom team */
  team2: MatchViewTeam;
  /** Optional formatted time string, e.g. "Sat, May 2 • 2:30 PM" */
  startTime?: string;
  /** Optional venue string, e.g. "Court 3 • Long Beach" */
  location?: string;
  /** Winner bracket path */
  winnerPath: MatchViewWinnerPath;
  /** Loser bracket path */
  loserPath: MatchViewLoserPath;
  /**
   * URL to the match video stream or replay.
   * When undefined, the video button is shown disabled.
   */
  videoUrl?: string;
  /**
   * URL to share. Defaults to window.location.href when omitted.
   * On devices with the Web Share API, triggers native sharing.
   * On desktop, copies to clipboard and shows a "Link Copied" tooltip.
   */
  shareUrl?: string;
  /** Called when the Close button is clicked */
  onClose: () => void;
  className?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Material Design "Live TV" filled icon — matches the Figma spec exactly.
const LiveTvIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 14H3V8h18v12zm-10-3.5l6-4.5-6-4.5v9z" />
  </svg>
);

function resolveVideoLabel(status: MatchViewProps['status'], videoUrl?: string): string {
  if (!videoUrl) return 'Video Unavailable';
  return status === 'live' ? 'Watch Live' : 'Watch Replay';
}

// ─── MatchView ────────────────────────────────────────────────────────────────

export function MatchView({
  bracketSection,
  matchName,
  status,
  team1,
  team2,
  startTime,
  location,
  winnerPath,
  loserPath,
  videoUrl,
  shareUrl,
  onClose,
  className,
}: MatchViewProps) {
  const [showCopied, setShowCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive which team won/lost to personalise the bracket path labels.
  const winnerTeam = status === 'completed' ? (team1.winner ? team1 : team2) : null;
  const loserTeam  = status === 'completed' ? (team1.winner ? team2 : team1) : null;

  const winOutcome: PathOutcome  = status === 'completed' ? 'win'  : 'neutral';
  const lossOutcome: PathOutcome = status === 'completed' ? 'loss' : 'neutral';

  const isFinalMatch = !winnerPath.href && !winnerPath.onNavigate;
  const winnerLabel = isFinalMatch
    ? (winnerTeam ? `${winnerTeam.name} place` : 'Winner places')
    : (winnerTeam ? `${winnerTeam.name} advance to` : 'Winner advances to');

  const loserLabel = loserPath.eliminated
    ? (loserTeam ? `${loserTeam.name} place` : 'Loser places')
    : (loserTeam ? `${loserTeam.name} advance to` : 'Loser advances to');

  const handleShare = useCallback(async () => {
    const url = shareUrl ?? (typeof window !== 'undefined' ? window.location.href : '');

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ url, title: `${bracketSection} – ${matchName}` });
      } catch {
        // User cancelled or share not supported — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShowCopied(true);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setShowCopied(false), 2000);
      } catch {
        // Clipboard not available — no-op
      }
    }
  }, [shareUrl, bracketSection, matchName]);

  useEffect(
    () => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); },
    []
  );

  return (
    <StyledMatchView
      className={className}
      role="dialog"
      aria-modal="true"
      aria-label={`${matchName} match details`}
    >
      {/* ─── Header ─── */}
      <StyledHeader>
        <StyledHeaderLeft>
          <StyledSectionLabel>{bracketSection}</StyledSectionLabel>
          <StyledMatchName>{matchName}</StyledMatchName>
        </StyledHeaderLeft>
        <StyledStatusBadge $status={status}>
          {status === 'completed' ? 'Completed' : status === 'live' ? 'Live' : 'Upcoming'}
        </StyledStatusBadge>
      </StyledHeader>

      <StyledDivider />

      {/* ─── Score card (team rows only) ─── */}
      <StyledScoreSection>
        <MatchCard
          scoreOnly
          status={status as MatchCardStatus}
          team1={team1}
          team2={team2}
        />
      </StyledScoreSection>

      {/* ─── Optional metadata ─── */}
      {startTime && (
        <StyledMetaRow>
          <Icon name="clock" size={16} />
          <StyledMetaText>{startTime}</StyledMetaText>
        </StyledMetaRow>
      )}
      {location && (
        <StyledMetaRow>
          <Icon name="map-pin" size={16} />
          <StyledMetaText>{location}</StyledMetaText>
        </StyledMetaRow>
      )}

      {/* ─── Bracket Paths ─── */}
      <StyledPathsSection>
        <StyledPathsHeading>Bracket Paths</StyledPathsHeading>

        <StyledPathCard $outcome={winOutcome}>
          <StyledPathIconBubble $outcome={winOutcome}>
            <Icon name="check" size={20} />
          </StyledPathIconBubble>
          <StyledPathInfo>
            <StyledPathSublabel $outcome={winOutcome}>{winnerLabel}</StyledPathSublabel>
            <StyledPathDestination>{winnerPath.destination}</StyledPathDestination>
          </StyledPathInfo>
          {(winnerPath.onNavigate || winnerPath.href) && (
            winnerPath.onNavigate ? (
              <StyledPathNavButton onClick={winnerPath.onNavigate} style={PATH_LINK_STYLE}>
                View <Icon name="chevron-right" size={16} />
              </StyledPathNavButton>
            ) : (
              <Link href={winnerPath.href!} variant="standalone" style={PATH_LINK_STYLE}>
                View <Icon name="chevron-right" size={16} />
              </Link>
            )
          )}
        </StyledPathCard>

        <StyledPathCard $outcome={lossOutcome}>
          <StyledPathIconBubble $outcome={lossOutcome}>
            <Icon name="close" size={20} />
          </StyledPathIconBubble>
          <StyledPathInfo>
            <StyledPathSublabel $outcome={lossOutcome}>{loserLabel}</StyledPathSublabel>
            <StyledPathDestination>{loserPath.destination}</StyledPathDestination>
          </StyledPathInfo>
          {(loserPath.onNavigate || loserPath.href) && (
            loserPath.onNavigate ? (
              <StyledPathNavButton onClick={loserPath.onNavigate} style={PATH_LINK_STYLE}>
                View <Icon name="chevron-right" size={16} />
              </StyledPathNavButton>
            ) : (
              <Link href={loserPath.href!} variant="standalone" style={PATH_LINK_STYLE}>
                View <Icon name="chevron-right" size={16} />
              </Link>
            )
          )}
        </StyledPathCard>
      </StyledPathsSection>

      <StyledDivider />

      {/* ─── Actions ─── */}
      <StyledActions>
        <Button
          variant={videoUrl ? 'primary' : 'secondary'}
          size="sm"
          iconLeft={<LiveTvIcon />}
          disabled={!videoUrl}
          onClick={videoUrl ? () => window.open(videoUrl, '_blank') : undefined}
        >
          {resolveVideoLabel(status, videoUrl)}
        </Button>

        <StyledButtonGroup>
          <StyledShareWrapper>
            <StyledOutlineButton
              variant="ghost"
              size="sm"
              iconLeft={<Icon name="share" size={16} />}
              onClick={handleShare}
            >
              Share
            </StyledOutlineButton>
            {showCopied && <StyledShareTooltip>Link Copied</StyledShareTooltip>}
          </StyledShareWrapper>

          <StyledOutlineButton variant="ghost" size="sm" onClick={onClose}>
            Close
          </StyledOutlineButton>
        </StyledButtonGroup>
      </StyledActions>
    </StyledMatchView>
  );
}

// ─── MatchViewOverlay ─────────────────────────────────────────────────────────

export interface MatchViewOverlayProps {
  /** Called when the backdrop is clicked or Escape is pressed */
  onClose: () => void;
  children: React.ReactNode;
}

export function MatchViewOverlay({ onClose, children }: MatchViewOverlayProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <StyledOverlay
      onClick={handleBackdropClick}
      onMouseDown={e => e.stopPropagation()}
      onMouseMove={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
    >
      {children}
    </StyledOverlay>
  );
}
