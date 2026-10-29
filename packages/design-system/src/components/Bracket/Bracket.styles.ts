import styled from 'styled-components';
import { cssVars } from '@lockin/tokens';

export const CONNECTOR_WIDTH = 56;

// ─── Root ─────────────────────────────────────────────────────────────────────

export const StyledBracket = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: ${cssVars.space.md};
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
  gap: ${cssVars.space.xl};
  padding: ${cssVars.space.md};
`;

export const StyledBracketSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${cssVars.space.md};
`;

export const StyledSectionHeading = styled.h2`
  font: ${cssVars.typography.overline};
  letter-spacing: var(--ds-typography-overline-letter-spacing);
  text-transform: uppercase;
  color: ${cssVars.color.text.secondary};
  padding-bottom: ${cssVars.space.sm};
  border-bottom: ${cssVars.border.width.thin} solid ${cssVars.color.border.subtle};
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
  gap: ${cssVars.space.md};
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
  gap: ${cssVars.space.xs};
`;

export const StyledRoundHeaderLabel = styled.p`
  margin: 0;
  font: ${cssVars.typography.label.md};
  text-transform: uppercase;
  white-space: nowrap;
  color: ${cssVars.color.text.secondary};
`;

export const StyledRoundHeaderDivider = styled.div`
  height: ${cssVars.border.width.thin};
  width: 100%;
  background-color: ${cssVars.color.border.default};
`;

export const StyledRoundHeaderSpacer = styled.div`
  width: ${CONNECTOR_WIDTH}px;
  flex-shrink: 0;
`;
