import type React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Button } from '../Button';

export type PathOutcome = 'win' | 'loss' | 'neutral';

// ─── Overlay ──────────────────────────────────────────────────────────────────

export const StyledOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: ${({ theme }) => theme.zIndex.modal};
  padding: ${({ theme }) => theme.spacing[4]};
  cursor: default;
  user-select: none;
`;

// ─── Root ─────────────────────────────────────────────────────────────────────

export const StyledMatchView = styled.div`
  background-color: ${({ theme }) => theme.color.neutral[0]};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  width: 452px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: ${({ theme }) => theme.shadow.lg};
`;

// ─── Header ───────────────────────────────────────────────────────────────────

export const StyledHeader = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing[1]};
  align-items: flex-end;
  padding: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[5]};
  width: 100%;
`;

export const StyledHeaderLeft = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
`;

export const StyledSectionLabel = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  letter-spacing: 0.02em;
  color: ${({ theme }) => theme.color.brand.primary};
`;

export const StyledMatchName = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  letter-spacing: 0.02em;
  color: ${({ theme }) => theme.color.neutral[900]};
`;

export const StyledStatusBadge = styled.span<{ $status: 'upcoming' | 'live' | 'completed' }>`
  flex-shrink: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  text-transform: uppercase;
  white-space: nowrap;

  ${({ $status, theme }) => {
    if ($status === 'completed') return css`color: ${theme.color.green[700]};`;
    if ($status === 'live') return css`color: ${theme.color.red[700]};`;
    return css`color: ${theme.color.blue[700]};`;
  }}
`;

// ─── Divider ──────────────────────────────────────────────────────────────────

export const StyledDivider = styled.div`
  width: 100%;
  height: 1px;
  background-color: ${({ theme }) => theme.color.neutral[300]};
  flex-shrink: 0;
`;

// ─── Score section ────────────────────────────────────────────────────────────

export const StyledScoreSection = styled.div`
  padding: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[5]} ${({ theme }) => theme.spacing[2]};
  width: 100%;
`;

// ─── Meta rows (time / location) ──────────────────────────────────────────────

export const StyledMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  padding: 2px ${({ theme }) => theme.spacing[5]};
  color: ${({ theme }) => theme.color.neutral[500]};
`;

export const StyledMetaText = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.regular};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  white-space: nowrap;
`;

// ─── Bracket Paths ────────────────────────────────────────────────────────────

export const StyledPathsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[5]} ${({ theme }) => theme.spacing[4]};
  width: 100%;
`;

export const StyledPathsHeading = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.neutral[500]};
`;

export const StyledPathCard = styled.div<{ $outcome: PathOutcome }>`
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 10px ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.border.radius.lg};
  border: ${({ theme }) => theme.border.width.default} solid;
  width: 100%;

  ${({ $outcome, theme }) => {
    const dark = theme.mode === 'dark';
    switch ($outcome) {
      case 'win':
        return css`
          background-color: ${dark ? theme.color.green[900] : theme.color.green[100]};
          border-color: ${dark ? theme.color.green[700] : theme.color.green[300]};
        `;
      case 'loss':
        return css`
          background-color: ${dark ? theme.color.red[900] : theme.color.red[100]};
          border-color: ${theme.color.red[700]};
        `;
      default:
        return css`
          background-color: ${theme.color.neutral[200]};
          border-color: ${theme.color.neutral[300]};
        `;
    }
  }}
`;

export const StyledPathIconBubble = styled.div<{ $outcome: PathOutcome }>`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.border.radius.full};
  flex-shrink: 0;

  ${({ $outcome, theme }) => {
    switch ($outcome) {
      case 'win':
        return css`
          background-color: ${theme.color.green[700]};
          color: #ffffff;
        `;
      case 'loss':
        return css`
          background-color: ${theme.color.red[900]};
          color: #ffffff;
        `;
      default:
        return css`
          background-color: ${theme.color.neutral[300]};
          color: #ffffff;
        `;
    }
  }}
`;

export const StyledPathInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
`;

export const StyledPathSublabel = styled.p<{ $outcome: PathOutcome }>`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  text-transform: uppercase;

  ${({ $outcome, theme }) => {
    const dark = theme.mode === 'dark';
    switch ($outcome) {
      case 'win':  return css`color: ${dark ? theme.color.green[100] : theme.color.green[900]};`;
      case 'loss': return css`color: ${dark ? theme.color.red[100] : theme.color.red[900]};`;
      default:     return css`color: ${theme.color.neutral[500]};`;
    }
  }}
`;

export const StyledPathDestination = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.color.neutral[900]};
`;

// Inline style applied directly on <Link> to avoid styled(Link) union-type complexity.
// Values: font-size 14px, font-weight 600, flex-shrink 0
export const PATH_LINK_STYLE: React.CSSProperties = {
  flexShrink: 0,
  fontSize: '14px',
  fontWeight: 600,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export const StyledActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[5]};
  width: 100%;

  @media (max-width: 639px) {
    flex-direction: column;
    align-items: stretch;
    gap: ${({ theme }) => theme.spacing[2]};
  }
`;

export const StyledButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};

  @media (max-width: 639px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

// ─── Share tooltip ────────────────────────────────────────────────────────────

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export const StyledShareWrapper = styled.div`
  position: relative;

  @media (max-width: 639px) {
    & > button {
      width: 100%;
    }
  }
`;

export const StyledShareTooltip = styled.div`
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  background-color: ${({ theme }) => theme.color.neutral[900]};
  color: ${({ theme }) => theme.color.neutral[0]};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  white-space: nowrap;
  pointer-events: none;
  animation: ${fadeInUp} ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.out};
  z-index: ${({ theme }) => theme.zIndex.tooltip};
`;

// Ghost button with a visible border (for Share and Close in the actions row)
export const StyledOutlineButton = styled(Button)`
  && {
    border-color: ${({ theme }) => theme.color.neutral[300]};
  }
`;

// Renders like a standalone Link; used when path navigation triggers an in-bracket callback
export const StyledPathNavButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${({ theme }) => theme.color.brand.primary};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;
