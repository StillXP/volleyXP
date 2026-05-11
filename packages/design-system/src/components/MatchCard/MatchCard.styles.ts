import styled, { css } from 'styled-components';
import type { MatchCardColorScheme, MatchCardStatus } from './MatchCard';

// ─── Root ─────────────────────────────────────────────────────────────────────

export const StyledMatchCard = styled.div<{ $colorScheme: MatchCardColorScheme; $scoreOnly?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};

  ${({ $scoreOnly, theme }) =>
    $scoreOnly
      ? css`
          width: 100%;
          padding: 0;
        `
      : css`
          width: 280px;
          padding: ${theme.spacing[2]} 0;
        `}
`;

// ─── Score card wrapper + match ID marker ─────────────────────────────────────

export const StyledScoreCardWrapper = styled.div`
  position: relative;
  width: 100%;
`;

export const StyledMatchIdMarker = styled.div<{ $colorScheme: MatchCardColorScheme }>`
  position: absolute;
  left: -20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  padding: 2px ${({ theme }) => theme.spacing[1]};
  border: ${({ theme }) => theme.border.width.default} solid;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  text-transform: uppercase;
  text-align: center;
  white-space: nowrap;

  ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark'
      ? css`
          background-color: ${theme.color.neutral[0]};
          border-color: ${theme.color.neutral[900]};
          color: ${theme.color.neutral[900]};
        `
      : css`
          background-color: ${theme.color.neutral[0]};
          border-color: ${theme.color.neutral[900]};
          color: ${theme.color.neutral[900]};
        `}
`;

// ─── Score card ───────────────────────────────────────────────────────────────

export const StyledScoreCard = styled.div<{ $colorScheme: MatchCardColorScheme }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  border: ${({ theme }) => theme.border.width.thick} solid;
  border-radius: 0 ${({ theme }) => theme.border.radius.lg} ${({ theme }) => theme.border.radius.lg} 0;

  ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark'
      ? css`
          background-color: ${theme.color.neutral[900]};
          border-color: ${theme.color.neutral[0]};
        `
      : css`
          background-color: ${theme.color.neutral[0]};
          border-color: ${theme.color.neutral[900]};
        `}
`;

// ─── Team row ─────────────────────────────────────────────────────────────────

export type TeamRowHighlight = 'win' | 'loss' | 'pending' | false;

export const StyledTeamRow = styled.div<{
  $status: MatchCardStatus;
  $colorScheme: MatchCardColorScheme;
  $highlight: TeamRowHighlight;
}>`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing[2]};
  width: 100%;
  gap: ${({ theme }) => theme.spacing[2]};
  transition: background-color 150ms ease;
  cursor: default;

  ${({ $highlight, $colorScheme, theme }) => {
    if (!$highlight) return null;
    const bg = {
      win:     $colorScheme === 'dark' ? theme.color.green[700]   : theme.color.green[0],
      loss:    $colorScheme === 'dark' ? theme.color.red[700]     : theme.color.red[100],
      pending: $colorScheme === 'dark' ? theme.color.neutral[700] : theme.color.neutral[200],
    }[$highlight];
    return css`background-color: ${bg};`;
  }}
`;

export const StyledTeamLeft = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`;

export const StyledSeed = styled.span<{ $colorScheme: MatchCardColorScheme }>`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.regular};
  line-height: 16px;
  color: ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark' ? theme.color.neutral[0] : theme.color.neutral[900]};
`;

export const StyledTeamName = styled.p<{
  $status: MatchCardStatus;
  $winner: boolean;
  $colorScheme: MatchCardColorScheme;
  $isPlaceholder: boolean;
}>`
  flex: 1;
  min-width: 0;
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark' ? theme.color.neutral[0] : theme.color.neutral[900]};

  ${({ $isPlaceholder }) =>
    $isPlaceholder &&
    css`
      font-style: italic;
    `}

  font-weight: ${({ $winner, $status }) =>
    $winner && $status === 'completed' ? 700 : 400};
`;

// ─── Score columns ────────────────────────────────────────────────────────────

export const StyledTeamRight = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-shrink: 0;
`;

export const StyledSetScores = styled.div<{
  $colorScheme: MatchCardColorScheme;
}>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  align-items: center;
  justify-content: flex-end;
  width: 64px;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  line-height: 16px;
  text-align: center;
  color: ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark' ? theme.color.neutral[0] : theme.color.neutral[900]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.regular};
`;

export const StyledSetScore = styled.span<{ $winner?: boolean }>`
  width: 16px;
  flex-shrink: 0;
  font-weight: ${({ $winner, theme }) =>
    $winner ? theme.typography.fontWeight.bold : theme.typography.fontWeight.regular};
`;

export const StyledSetBadge = styled.div<{
  $winner: boolean;
  $colorScheme: MatchCardColorScheme;
}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 20px;
  padding: 0 ${({ theme }) => theme.spacing[1]};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  text-align: center;
  white-space: nowrap;

  ${({ $winner, $colorScheme, theme }) =>
    $winner
      ? css`
          background-color: ${theme.color.green[700]};
          color: ${theme.color.neutral[0]};
          font-weight: ${theme.typography.fontWeight.bold};
        `
      : css`
          color: ${$colorScheme === 'dark' ? theme.color.neutral[0] : theme.color.neutral[900]};
          font-weight: ${theme.typography.fontWeight.semibold};
        `}
`;

// ─── Divider ──────────────────────────────────────────────────────────────────

export const StyledDivider = styled.div<{ $colorScheme: MatchCardColorScheme }>`
  height: 0;
  width: 100%;
  border-top: 1px solid;
  border-color: ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark' ? theme.color.neutral[0] : theme.color.neutral[900]};
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
  gap: ${({ theme }) => theme.spacing[1]};
  flex: 1;
  min-width: 0;
`;

export const StyledStatusLabel = styled.span<{ $status: MatchCardStatus }>`
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;

  ${({ $status, theme }) => {
    if ($status === 'completed') {
      return css`color: ${theme.color.green[700]};`;
    }
    if ($status === 'live') {
      return css`color: ${theme.color.red[900]};`;
    }
    return css`color: ${theme.color.blue[900]};`;
  }}
`;

export const StyledFooterMeta = styled.div<{ $colorScheme: MatchCardColorScheme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[1]};
  align-items: center;
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.regular};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  white-space: nowrap;
  color: ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark' ? theme.color.neutral[0] : theme.color.neutral[900]};
`;
