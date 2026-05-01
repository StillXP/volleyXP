import { rgba } from 'polished';
import styled, { css, keyframes } from 'styled-components';
import { focusRing, truncate } from '@/styles/mixins';
import type { DropdownSize } from './Dropdown';

const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ─── Size variants ────────────────────────────────────────────────────────────

const triggerSizeStyles: Record<DropdownSize, ReturnType<typeof css>> = {
  sm: css`
    padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
  `,
  md: css`
    padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
  `,
  lg: css`
    padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
  `,
};

// ─── Root wrapper ─────────────────────────────────────────────────────────────

export const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
`;

// ─── Label ────────────────────────────────────────────────────────────────────

export const StyledLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  color: ${({ theme }) => theme.color.neutral[700]};
`;

// ─── Container (positions the list) ──────────────────────────────────────────

export const StyledContainer = styled.div`
  position: relative;
`;

// ─── Trigger button ───────────────────────────────────────────────────────────

interface StyledTriggerProps {
  $size: DropdownSize;
  $open: boolean;
  $error: boolean;
  $placeholder: boolean;
}

export const StyledTrigger = styled.button<StyledTriggerProps>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background-color: ${({ theme }) => theme.color.neutral[0]};
  border: ${({ theme }) => theme.border.width.default} solid ${({ theme }) => theme.color.neutral[300]};
  border-radius: ${({ theme }) => theme.border.radius.md};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  color: ${({ theme }) => theme.color.neutral[900]};
  cursor: pointer;
  text-align: left;
  transition:
    border-color ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default},
    box-shadow   ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default};

  ${focusRing()}

  &:disabled {
    background-color: ${({ theme }) => theme.color.neutral[100]};
    opacity: 0.6;
    cursor: not-allowed;
  }

  ${({ $size }) => triggerSizeStyles[$size]}

  ${({ $open, theme }) =>
    $open &&
    css`
      border-color: ${theme.color.brand.primary};
      box-shadow: 0 0 0 3px ${rgba(theme.color.brand.primary, 0.15)};
    `}

  ${({ $error, $open, theme }) =>
    $error &&
    css`
      border-color: ${theme.color.semantic.error};
      ${$open && css`box-shadow: 0 0 0 3px ${rgba(theme.color.semantic.error, 0.15)};`}
    `}
`;

// ─── Trigger label ────────────────────────────────────────────────────────────

interface StyledTriggerLabelProps {
  $placeholder: boolean;
}

export const StyledTriggerLabel = styled.span<StyledTriggerLabelProps>`
  flex: 1;
  ${truncate}
  ${({ $placeholder, theme }) =>
    $placeholder && css`color: ${theme.color.neutral[500]};`}
`;

// ─── Chevron ──────────────────────────────────────────────────────────────────

interface StyledChevronProps {
  $open: boolean;
}

export const StyledChevron = styled.span<StyledChevronProps>`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: ${({ theme }) => theme.spacing[2]};
  color: ${({ theme }) => theme.color.neutral[500]};
  transition: transform ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default};

  ${({ $open }) => $open && css`transform: rotate(180deg);`}
`;

// ─── Option list ──────────────────────────────────────────────────────────────

export const StyledList = styled.ul`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing[1]});
  left: 0;
  right: 0;
  z-index: ${({ theme }) => theme.zIndex.dropdown};
  background-color: ${({ theme }) => theme.color.neutral[0]};
  border: ${({ theme }) => theme.border.width.default} solid ${({ theme }) => theme.color.neutral[200]};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.md};
  list-style: none;
  margin: 0;
  padding: ${({ theme }) => theme.spacing[1]} 0;
  max-height: 240px;
  overflow-y: auto;
  animation: ${slideDown} ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.out};

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => theme.color.neutral[300]} transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) => theme.color.neutral[300]};
    border-radius: ${({ theme }) => theme.border.radius.full};
  }
`;

// ─── Option item ──────────────────────────────────────────────────────────────

interface StyledOptionProps {
  $selected: boolean;
  $highlighted: boolean;
  $disabled: boolean;
}

export const StyledOption = styled.li<StyledOptionProps>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  color: ${({ theme }) => theme.color.neutral[900]};
  cursor: pointer;
  transition: background-color ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default};

  &:focus {
    outline: none;
  }

  ${({ $highlighted, theme }) =>
    $highlighted && css`background-color: ${theme.color.neutral[100]};`}

  ${({ $selected, theme }) =>
    $selected &&
    css`
      color: ${theme.color.brand.primary};
      font-weight: ${theme.typography.fontWeight.medium};
    `}

  ${({ $disabled }) =>
    $disabled &&
    css`
      opacity: 0.5;
      cursor: not-allowed;
    `}
`;

// ─── Checkmark ────────────────────────────────────────────────────────────────

export const StyledCheckmark = styled.span`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.color.brand.primary};
  margin-left: ${({ theme }) => theme.spacing[2]};
`;

// ─── Error text ───────────────────────────────────────────────────────────────

export const StyledErrorText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.color.semantic.error};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;
