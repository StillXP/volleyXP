import { rgba } from 'polished';
import styled, { css } from 'styled-components';
import { visuallyHidden } from '@/styles/mixins';
import type { TextFieldSize } from './TextField';

// ─── Size variants (applied to StyledInputWrapper) ────────────────────────────

const inputSizeStyles: Record<TextFieldSize, ReturnType<typeof css>> = {
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

// ─── Wrapper ──────────────────────────────────────────────────────────────────

export const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
`;

// ─── Label ────────────────────────────────────────────────────────────────────

interface StyledLabelProps {
  $hidden: boolean;
}

export const StyledLabel = styled.label<StyledLabelProps>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  color: ${({ theme }) => theme.color.neutral[700]};

  ${({ $hidden }) => $hidden && visuallyHidden}
`;

// ─── Input wrapper ────────────────────────────────────────────────────────────

interface StyledInputWrapperProps {
  $size: TextFieldSize;
  $error: boolean;
  $disabled: boolean;
}

export const StyledInputWrapper = styled.div<StyledInputWrapperProps>`
  display: flex;
  align-items: center;
  background-color: ${({ theme }) => theme.color.neutral[0]};
  border: ${({ theme }) => theme.border.width.default} solid ${({ theme }) => theme.color.neutral[300]};
  border-radius: ${({ theme }) => theme.border.radius.md};
  transition:
    border-color ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default},
    box-shadow   ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default};

  &:focus-within {
    border-color: ${({ theme }) => theme.color.brand.primary};
    box-shadow: 0 0 0 3px ${({ theme }) => rgba(theme.color.brand.primary, 0.15)};
  }

  ${({ $error, theme }) =>
    $error &&
    css`
      border-color: ${theme.color.semantic.error};

      &:focus-within {
        box-shadow: 0 0 0 3px ${rgba(theme.color.semantic.error, 0.15)};
      }
    `}

  ${({ $disabled, theme }) =>
    $disabled &&
    css`
      background-color: ${theme.color.neutral[100]};
      opacity: 0.6;
      cursor: not-allowed;
    `}

  /* Size-driven input padding/font-size */
  ${({ $size }) => inputSizeStyles[$size]}
`;

// ─── Input ────────────────────────────────────────────────────────────────────

export const StyledInput = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  color: ${({ theme }) => theme.color.neutral[900]};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};

  /* Size styles are inherited from StyledInputWrapper via CSS cascade */
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  font-size: ${({ theme }) => theme.typography.fontSize.base};

  &::placeholder {
    color: ${({ theme }) => theme.color.neutral[500]};
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

// ─── Addon ────────────────────────────────────────────────────────────────────

export const StyledAddon = styled.span`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0 ${({ theme }) => theme.spacing[3]};
  color: ${({ theme }) => theme.color.neutral[500]};

  &:first-child {
    padding-right: ${({ theme }) => theme.spacing[1]};
  }

  &:last-child {
    padding-left: ${({ theme }) => theme.spacing[1]};
  }
`;

// ─── Helper / Error text ──────────────────────────────────────────────────────

export const StyledHelperText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.color.neutral[500]};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;

export const StyledErrorText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.color.semantic.error};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;
