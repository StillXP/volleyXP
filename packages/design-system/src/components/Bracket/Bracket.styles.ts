import styled from 'styled-components';
import type { MatchCardColorScheme } from '../MatchCard/MatchCard';

export const CONNECTOR_WIDTH = 56;

// ─── Root ─────────────────────────────────────────────────────────────────────

export const StyledBracket = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: ${({ theme }) => theme.spacing[4]};
`;

// ─── Round group (match column + connector SVG) ────────────────────────────────

export const StyledRoundGroup = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex-shrink: 0;
`;

// ─── Match column ─────────────────────────────────────────────────────────────
// Fixed height keeps the vertical grid consistent across rounds even when some
// slots are empty (bye positions). Match cards are absolutely positioned inside.

export const StyledMatchColumn = styled.div<{ $height: number }>`
  position: relative;
  width: 280px;
  height: ${({ $height }) => $height}px;
  flex-shrink: 0;
`;

// ─── Match slot ───────────────────────────────────────────────────────────────

export const StyledMatchSlot = styled.div<{ $top: number }>`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: 0;
  width: 100%;
`;

// ─── Double-elimination layout ────────────────────────────────────────────────

export const StyledDoubleBracketWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[8]};
  padding: ${({ theme }) => theme.spacing[4]};
`;

export const StyledBracketSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`;

export const StyledSectionHeading = styled.h2<{ $colorScheme: MatchCardColorScheme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark' ? theme.color.neutral[300] : theme.color.neutral[500]};
  padding-bottom: ${({ theme }) => theme.spacing[3]};
  border-bottom: 1px solid ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark' ? 'rgba(255,255,255,0.12)' : theme.color.neutral[200]};
`;

/** Horizontal row of round groups — no overflow, handled by the outer scroll container. */
export const StyledSectionBody = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
`;

export const StyledGrandFinalSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`;

// ─── Per-round column headers ─────────────────────────────────────────────────

export const StyledRoundHeaders = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
`;

export const StyledRoundHeader = styled.div`
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`;

export const StyledRoundHeaderLabel = styled.p<{ $colorScheme: MatchCardColorScheme }>`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  text-transform: uppercase;
  white-space: nowrap;
  color: ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark' ? theme.color.neutral[400] : theme.color.neutral[500]};
`;

export const StyledRoundHeaderDivider = styled.div<{ $colorScheme: MatchCardColorScheme }>`
  height: 1px;
  width: 100%;
  background-color: ${({ $colorScheme, theme }) =>
    $colorScheme === 'dark' ? theme.color.neutral[700] : theme.color.neutral[300]};
`;

export const StyledRoundHeaderSpacer = styled.div`
  width: ${CONNECTOR_WIDTH}px;
  flex-shrink: 0;
`;
