import styled, { keyframes } from 'styled-components';
import { cssVars } from '@lockin/tokens';

export type PathOutcome = 'win' | 'loss' | 'neutral';

// Lock In has no z-index tokens; keep layering local to this component.
const Z_MODAL = 200;
const Z_TOOLTIP = 300;

// ─── Overlay ──────────────────────────────────────────────────────────────────

// The overlay scrolls when its content is taller than the screen (a phone showing the
// scoring controls). Auto margins on the dialog keep it centered when it does fit,
// which align-items/justify-content can't do without clipping the top when it overflows.
export const StyledOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  overflow-y: auto;
  background-color: ${cssVars.color.background.overlay};
  z-index: ${Z_MODAL};
  padding: ${cssVars.space.md};
  cursor: default;
  user-select: none;

  /* Safari makes inputs inside a user-select: none ancestor impossible to type in. */
  & input,
  & textarea {
    user-select: text;
  }
`;

// ─── Root ─────────────────────────────────────────────────────────────────────

export const StyledMatchView = styled.div`
  background-color: ${cssVars.color.surface.raised};
  border: ${cssVars.border.width.thin} solid ${cssVars.color.border.subtle};
  border-radius: ${cssVars.radius.xl};
  width: 452px;
  max-width: 100%;
  margin: auto;
  display: flex;
  flex-direction: column;
  box-shadow: ${cssVars.shadow.lg};

  /* Focused by code when it opens so assistive tech announces it; nothing to click there. */
  &:focus {
    outline: none;
  }
`;

// ─── Header ───────────────────────────────────────────────────────────────────

export const StyledHeader = styled.div`
  display: flex;
  gap: ${cssVars.space['2xs']};
  align-items: flex-end;
  padding: ${cssVars.space.md} ${cssVars.space.lg};
  width: 100%;
`;

export const StyledHeaderLeft = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${cssVars.space['2xs']};
`;

export const StyledSectionLabel = styled.p`
  margin: 0;
  font: ${cssVars.typography.overline};
  letter-spacing: var(--ds-typography-overline-letter-spacing);
  text-transform: uppercase;
  color: ${cssVars.color.text.brand};
`;

export const StyledMatchName = styled.p`
  margin: 0;
  font: ${cssVars.typography.heading.md};
  letter-spacing: var(--ds-typography-heading-md-letter-spacing);
  color: ${cssVars.color.text.primary};
`;

const statusColor = {
  completed: cssVars.color.text.success,
  live: cssVars.color.text.danger,
  upcoming: cssVars.color.text.info,
};

export const StyledStatusBadge = styled.span<{ $status: 'upcoming' | 'live' | 'completed' }>`
  flex-shrink: 0;
  font: ${cssVars.typography.overline};
  letter-spacing: var(--ds-typography-overline-letter-spacing);
  text-transform: uppercase;
  white-space: nowrap;
  color: ${({ $status }) => statusColor[$status]};
`;

// ─── Divider ──────────────────────────────────────────────────────────────────

export const StyledDivider = styled.div`
  width: 100%;
  height: ${cssVars.border.width.thin};
  background-color: ${cssVars.color.border.default};
  flex-shrink: 0;
`;

// ─── Score section ────────────────────────────────────────────────────────────

export const StyledScoreSection = styled.div`
  padding: ${cssVars.space.md} ${cssVars.space.lg} ${cssVars.space.xs};
  width: 100%;
`;

// ─── Meta rows (time / location) ──────────────────────────────────────────────

export const StyledMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${cssVars.space['2xs']};
  padding: 2px ${cssVars.space.lg};
  color: ${cssVars.color.icon.secondary};
`;

export const StyledMetaText = styled.p`
  margin: 0;
  font: ${cssVars.typography.body.sm};
  color: ${cssVars.color.text.secondary};
  white-space: nowrap;
`;

// ─── Bracket Paths ────────────────────────────────────────────────────────────

export const StyledPathsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${cssVars.space.xs};
  padding: ${cssVars.space.xs} ${cssVars.space.lg} ${cssVars.space.md};
  width: 100%;
`;

export const StyledPathsHeading = styled.p`
  margin: 0;
  font: ${cssVars.typography.overline};
  letter-spacing: var(--ds-typography-overline-letter-spacing);
  text-transform: uppercase;
  color: ${cssVars.color.text.secondary};
`;

const pathTone = {
  win: cssVars.color.status.success,
  loss: cssVars.color.status.danger,
  neutral: cssVars.color.status.neutral,
};

export const StyledPathCard = styled.div<{ $outcome: PathOutcome }>`
  display: flex;
  align-items: center;
  gap: ${cssVars.space.md};
  padding: ${cssVars.space.xs} ${cssVars.space.sm};
  border-radius: ${cssVars.radius.md};
  border: ${cssVars.border.width.thin} solid ${({ $outcome }) => pathTone[$outcome].border};
  background-color: ${({ $outcome }) => pathTone[$outcome].bg};
  width: 100%;
`;

export const StyledPathIconBubble = styled.div<{ $outcome: PathOutcome }>`
  display: flex;
  align-items: center;
  padding: ${cssVars.space.xs};
  border-radius: ${cssVars.radius.full};
  flex-shrink: 0;
  background-color: ${({ $outcome }) => pathTone[$outcome].solid};
  color: ${({ $outcome }) => pathTone[$outcome].onSolid};
`;

export const StyledPathInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;

export const StyledPathSublabel = styled.p<{ $outcome: PathOutcome }>`
  margin: 0;
  font: ${cssVars.typography.overline};
  letter-spacing: var(--ds-typography-overline-letter-spacing);
  text-transform: uppercase;
  color: ${({ $outcome }) => pathTone[$outcome].text};
`;

export const StyledPathDestination = styled.p`
  margin: 0;
  font: ${cssVars.typography.label.md};
  color: ${cssVars.color.text.primary};
`;

// ─── Actions ──────────────────────────────────────────────────────────────────

export const StyledActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${cssVars.space.md} ${cssVars.space.lg};
  width: 100%;

  @media (max-width: 639px) {
    flex-direction: column;
    align-items: stretch;
    gap: ${cssVars.space.xs};
  }
`;

export const StyledButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${cssVars.space.xs};

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
  background-color: ${cssVars.color.background.inverse};
  color: ${cssVars.color.text.inverse};
  font: ${cssVars.typography.label.sm};
  padding: ${cssVars.space['2xs']} ${cssVars.space.xs};
  border-radius: ${cssVars.radius.sm};
  white-space: nowrap;
  pointer-events: none;
  animation: ${fadeInUp} ${cssVars.motion.duration.fast} ${cssVars.motion.easing.enter};
  z-index: ${Z_TOOLTIP};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
