import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Icon, Link } from '@lockin/react';
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
  StyledOverlay,
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
   * Content shown under the score card, such as scoring controls for an organizer.
   * Leave it out for a read-only view.
   */
  scoring?: React.ReactNode;
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

// Not in @lockin/icons yet — drawn to match its 24×24 stroke style.
const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
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
  scoring,
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
      tabIndex={-1}
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

      {scoring}

      {/* ─── Optional metadata ─── */}
      {startTime && (
        <StyledMetaRow>
          <Icon name="calendar" size="sm" />
          <StyledMetaText>{startTime}</StyledMetaText>
        </StyledMetaRow>
      )}
      {location && (
        <StyledMetaRow>
          <MapPinIcon />
          <StyledMetaText>{location}</StyledMetaText>
        </StyledMetaRow>
      )}

      {/* ─── Bracket Paths ─── */}
      <StyledPathsSection>
        <StyledPathsHeading>Bracket Paths</StyledPathsHeading>

        <StyledPathCard $outcome={winOutcome}>
          <StyledPathIconBubble $outcome={winOutcome}>
            <Icon name="check" size="md" />
          </StyledPathIconBubble>
          <StyledPathInfo>
            <StyledPathSublabel $outcome={winOutcome}>{winnerLabel}</StyledPathSublabel>
            <StyledPathDestination>{winnerPath.destination}</StyledPathDestination>
          </StyledPathInfo>
          {(winnerPath.onNavigate || winnerPath.href) && (
            winnerPath.onNavigate ? (
              <Button variant="tertiary" size="sm" iconEnd="chevron-right" onClick={winnerPath.onNavigate}>
                View
              </Button>
            ) : (
              <Link href={winnerPath.href!} variant="standalone">
                View
              </Link>
            )
          )}
        </StyledPathCard>

        <StyledPathCard $outcome={lossOutcome}>
          <StyledPathIconBubble $outcome={lossOutcome}>
            <Icon name="close" size="md" />
          </StyledPathIconBubble>
          <StyledPathInfo>
            <StyledPathSublabel $outcome={lossOutcome}>{loserLabel}</StyledPathSublabel>
            <StyledPathDestination>{loserPath.destination}</StyledPathDestination>
          </StyledPathInfo>
          {(loserPath.onNavigate || loserPath.href) && (
            loserPath.onNavigate ? (
              <Button variant="tertiary" size="sm" iconEnd="chevron-right" onClick={loserPath.onNavigate}>
                View
              </Button>
            ) : (
              <Link href={loserPath.href!} variant="standalone">
                View
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
          disabled={!videoUrl}
          onClick={videoUrl ? () => window.open(videoUrl, '_blank') : undefined}
        >
          {resolveVideoLabel(status, videoUrl)}
        </Button>

        <StyledButtonGroup>
          <StyledShareWrapper>
            <Button variant="secondary" size="sm" onClick={handleShare}>
              Share
            </Button>
            {showCopied && <StyledShareTooltip>Link Copied</StyledShareTooltip>}
          </StyledShareWrapper>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** The tab stops inside a container, skipping anything in a collapsed <details>. */
function tabStops(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => {
    const details = el.closest('details');
    return !details || details.open || (el.tagName === 'SUMMARY' && el.parentElement === details);
  });
}

export function MatchViewOverlay({ onClose, children }: MatchViewOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

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

  // Move focus into the dialog when it opens and hand it back to whatever opened it when
  // it closes. Focus lands on the dialog itself, not a button: Space activates a button on
  // key release, so landing on one would press it right after Space opened the dialog.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    overlayRef.current?.querySelector<HTMLElement>('[role="dialog"]')?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  // Keep Tab and Shift+Tab inside the dialog, wrapping at either end.
  const handleTab = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const dialog = overlayRef.current?.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const stops = tabStops(dialog);
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (!first || !last) {
      e.preventDefault();
      dialog.focus();
      return;
    }
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return createPortal(
    <StyledOverlay
      ref={overlayRef}
      onClick={handleBackdropClick}
      onKeyDown={handleTab}
      onMouseDown={e => e.stopPropagation()}
      onMouseMove={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
    >
      {children}
    </StyledOverlay>,
    document.body
  );
}
