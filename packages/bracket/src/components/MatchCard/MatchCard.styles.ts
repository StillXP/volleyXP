import styled, { css } from 'styled-components';
import { cssVars } from '@lockin/tokens';
import type { MatchCardStatus } from './MatchCard';

// Pixel geometry here feeds CARD_HEIGHT / CARD_DIVIDER_OFFSET in Bracket.tsx —
// keep spacing, border widths and line heights in sync with those constants.

const fontBase = css`
  font-family: ${cssVars.font.family.sans};
  line-height: ${cssVars.font.lineHeight.normal};
`;

// ─── Root ─────────────────────────────────────────────────────────────────────

export const StyledMatchCard = styled.div<{ $scoreOnly?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${cssVars.space['2xs']};

  ${({ $scoreOnly }) =>
    $scoreOnly
      ? css`
          width: 100%;
          padding: 0;
        `
      : css`
          width: 280px;
          padding: ${cssVars.space.xs} 0;
        `}
`;

// ─── Score card wrapper + match ID marker ─────────────────────────────────────

export const StyledScoreCardWrapper = styled.div`
  position: relative;
  width: 100%;
`;

export const StyledMatchIdMarker = styled.div`
  ${fontBase}
  position: absolute;
  left: -20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  padding: 2px ${cssVars.space['2xs']};
  border: ${cssVars.border.width.thin} solid ${cssVars.color.border.strong};
  border-radius: ${cssVars.radius.sm};
  background-color: ${cssVars.color.surface.default};
  color: ${cssVars.color.text.primary};
  font-size: ${cssVars.font.size.xs};
  font-weight: ${cssVars.font.weight.medium};
  text-transform: uppercase;
  text-align: center;
  white-space: nowrap;
`;

// ─── Score card ───────────────────────────────────────────────────────────────

export const StyledScoreCard = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  background-color: ${cssVars.color.surface.default};
  border: ${cssVars.border.width.thick} solid ${cssVars.color.border.strong};
  border-radius: 0 ${cssVars.radius.md} ${cssVars.radius.md} 0;
`;

// ─── Team row ─────────────────────────────────────────────────────────────────

export type TeamRowHighlight = 'win' | 'loss' | 'pending' | false;

const highlightBg: Record<Exclude<TeamRowHighlight, false>, string> = {
  win: cssVars.color.status.success.bg,
  loss: cssVars.color.status.danger.bg,
  pending: cssVars.color.background.muted,
};

export const StyledTeamRow = styled.div<{
  $status: MatchCardStatus;
  $highlight: TeamRowHighlight;
}>`
  display: flex;
  align-items: center;
  padding: ${cssVars.space.xs};
  width: 100%;
  gap: ${cssVars.space.xs};
  transition: background-color ${cssVars.motion.duration.fast} ${cssVars.motion.easing.standard};
  cursor: default;

  ${({ $highlight }) => $highlight && css`background-color: ${highlightBg[$highlight]};`}
`;

export const StyledTeamLeft = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: ${cssVars.space.xs};
`;

export const StyledSeed = styled.span`
  flex-shrink: 0;
  font-family: ${cssVars.font.family.sans};
  font-size: ${cssVars.font.size.xs};
  font-weight: ${cssVars.font.weight.regular};
  line-height: 16px;
  color: ${cssVars.color.text.secondary};
`;

export const StyledTeamName = styled.p<{
  $status: MatchCardStatus;
  $winner: boolean;
  $isPlaceholder: boolean;
}>`
  ${fontBase}
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: ${cssVars.font.size.md};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ $isPlaceholder }) =>
    $isPlaceholder ? cssVars.color.text.secondary : cssVars.color.text.primary};

  ${({ $isPlaceholder }) =>
    $isPlaceholder &&
    css`
      font-style: italic;
    `}

  font-weight: ${({ $winner, $status }) =>
    $winner && $status === 'completed' ? cssVars.font.weight.bold : cssVars.font.weight.regular};
`;

// ─── Score columns ────────────────────────────────────────────────────────────

export const StyledTeamRight = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${cssVars.space.xs};
  flex-shrink: 0;
`;

export const StyledSetScores = styled.div`
  display: flex;
  gap: ${cssVars.space.xs};
  align-items: center;
  justify-content: flex-end;
  width: 64px;
  font-family: ${cssVars.font.family.sans};
  font-size: ${cssVars.font.size.xs};
  line-height: 16px;
  text-align: center;
  color: ${cssVars.color.text.primary};
  font-weight: ${cssVars.font.weight.regular};
`;

export const StyledSetScore = styled.span<{ $winner?: boolean }>`
  width: 16px;
  flex-shrink: 0;
  font-weight: ${({ $winner }) => ($winner ? cssVars.font.weight.bold : cssVars.font.weight.regular)};
`;

export const StyledSetBadge = styled.div<{ $winner: boolean }>`
  ${fontBase}
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 20px;
  padding: 0 ${cssVars.space['2xs']};
  font-size: ${cssVars.font.size.md};
  text-align: center;
  white-space: nowrap;

  ${({ $winner }) =>
    $winner
      ? css`
          background-color: ${cssVars.color.status.success.solid};
          color: ${cssVars.color.status.success.onSolid};
          font-weight: ${cssVars.font.weight.bold};
        `
      : css`
          color: ${cssVars.color.text.primary};
          font-weight: ${cssVars.font.weight.semibold};
        `}
`;

// ─── Divider ──────────────────────────────────────────────────────────────────

export const StyledDivider = styled.div`
  height: 0;
  width: 100%;
  border-top: ${cssVars.border.width.thin} solid ${cssVars.color.border.default};
`;

// ─── Footer ───────────────────────────────────────────────────────────────────

export const StyledFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

export const StyledStatusGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${cssVars.space['2xs']};
  flex: 1;
  min-width: 0;
  color: ${cssVars.color.icon.secondary};
`;

const statusColor: Record<MatchCardStatus, string> = {
  completed: cssVars.color.text.success,
  live: cssVars.color.text.danger,
  upcoming: cssVars.color.text.info,
};

export const StyledStatusLabel = styled.span<{ $status: MatchCardStatus }>`
  ${fontBase}
  font-size: ${cssVars.font.size.xs};
  font-weight: ${cssVars.font.weight.semibold};
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
  color: ${({ $status }) => statusColor[$status]};
`;

export const StyledFooterMeta = styled.div`
  ${fontBase}
  display: flex;
  gap: ${cssVars.space['2xs']};
  align-items: center;
  flex-shrink: 0;
  font-size: ${cssVars.font.size.xs};
  font-weight: ${cssVars.font.weight.regular};
  white-space: nowrap;
  color: ${cssVars.color.text.secondary};
`;
