import { darken } from 'polished';
import styled, { css, keyframes } from 'styled-components';
import { focusRing } from '@/styles/mixins';
import type { ButtonSize, ButtonVariant } from './Button';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// ─── Size variants ────────────────────────────────────────────────────────────

const sizeStyles: Record<ButtonSize, ReturnType<typeof css>> = {
  sm: css`
    padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    letter-spacing: 0.02em;
  `,
  md: css`
    padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    letter-spacing: 0.02em;
  `,
  lg: css`
    padding: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[6]};
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    letter-spacing: 0.02em;
  `,
};

// ─── Variant styles ───────────────────────────────────────────────────────────

const variantStyles: Record<ButtonVariant, ReturnType<typeof css>> = {
  primary: css`
    background-color: ${({ theme }) => theme.color.brand.primary};
    color: ${({ theme }) => theme.color.neutral[0]};
    border-color: ${({ theme }) => theme.color.brand.primary};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => darken(0.08, theme.color.brand.primary)};
      border-color: ${({ theme }) => darken(0.08, theme.color.brand.primary)};
    }

    &:active:not(:disabled) {
      background-color: ${({ theme }) => darken(0.14, theme.color.brand.primary)};
    }
  `,
  secondary: css`
    background-color: ${({ theme }) => theme.color.neutral[300]};
    color: ${({ theme }) => theme.color.neutral[900]};
    border-color: transparent;

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => darken(0.08, theme.color.neutral[300])};
    }

    &:active:not(:disabled) {
      background-color: ${({ theme }) => darken(0.14, theme.color.neutral[300])};
    }
  `,
  ghost: css`
    background-color: transparent;
    color: ${({ theme }) => theme.color.neutral[900]};
    border-color: transparent;

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => theme.color.neutral[200]};
    }

    &:active:not(:disabled) {
      background-color: ${({ theme }) => theme.color.neutral[300]};
    }
  `,
  destructive: css`
    background-color: ${({ theme }) => theme.color.red[900]};
    color: ${({ theme }) => theme.color.neutral[0]};
    border-color: ${({ theme }) => theme.color.red[900]};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => darken(0.08, theme.color.red[900])};
      border-color: ${({ theme }) => darken(0.08, theme.color.red[900])};
    }

    &:active:not(:disabled) {
      background-color: ${({ theme }) => darken(0.14, theme.color.red[900])};
    }
  `,
  submit: css`
    background-color: ${({ theme }) => theme.color.green[700]};
    color: ${({ theme }) => theme.color.neutral[0]};
    border-color: ${({ theme }) => theme.color.green[700]};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => darken(0.08, theme.color.green[700])};
      border-color: ${({ theme }) => darken(0.08, theme.color.green[700])};
    }

    &:active:not(:disabled) {
      background-color: ${({ theme }) => darken(0.14, theme.color.green[700])};
    }
  `,
};

// ─── Sub-elements ─────────────────────────────────────────────────────────────

export const StyledContent = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`;

export const StyledIconSlot = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
`;

export const StyledSpinner = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const StyledSpinnerIcon = styled.svg`
  animation: ${spin} 0.75s linear infinite;
`;

// ─── Root element ─────────────────────────────────────────────────────────────

interface StyledButtonProps {
  $variant: ButtonVariant;
  $size: ButtonSize;
  $loading: boolean;
  $fullWidth: boolean;
}

export const StyledButton = styled.button<StyledButtonProps>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[1]};
  border: ${({ theme }) => theme.border.width.default} solid transparent;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
  transition:
    background-color ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default},
    color           ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default},
    border-color    ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default},
    box-shadow      ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default},
    opacity         ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default};

  ${focusRing()}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Size */
  ${({ $size }) => sizeStyles[$size]}

  /* Variant */
  ${({ $variant }) => variantStyles[$variant]}

  /* Modifiers */
  ${({ $fullWidth }) => $fullWidth && css`width: 100%;`}

  ${({ $loading }) =>
    $loading &&
    css`
      ${StyledContent} {
        opacity: 0;
      }
    `}
`;
