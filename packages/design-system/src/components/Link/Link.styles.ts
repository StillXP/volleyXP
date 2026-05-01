import { darken } from 'polished';
import styled, { css } from 'styled-components';
import { focusRing } from '@/styles/mixins';
import type { LinkVariant } from './Link';

// ─── Variant styles ───────────────────────────────────────────────────────────

const variantStyles: Record<LinkVariant, ReturnType<typeof css>> = {
  default: css`
    color: ${({ theme }) => theme.color.brand.primary};
    text-decoration-color: ${({ theme }) => theme.color.brand.primary};

    &:hover {
      color: ${({ theme }) => darken(0.1, theme.color.brand.primary)};
      text-decoration-color: ${({ theme }) => darken(0.1, theme.color.brand.primary)};
    }

    &:visited {
      color: ${({ theme }) => theme.color.brand.secondary};
      text-decoration-color: ${({ theme }) => theme.color.brand.secondary};
    }
  `,
  subtle: css`
    color: ${({ theme }) => theme.color.neutral[700]};
    text-decoration-color: ${({ theme }) => theme.color.neutral[300]};

    &:hover {
      color: ${({ theme }) => theme.color.neutral[900]};
      text-decoration-color: ${({ theme }) => theme.color.neutral[700]};
    }
  `,
  standalone: css`
    color: ${({ theme }) => theme.color.brand.primary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
      text-decoration-color: currentcolor;
    }
  `,
};

// ─── Sub-elements ─────────────────────────────────────────────────────────────

export const StyledExternalIcon = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 2px;
`;

// ─── Root element ─────────────────────────────────────────────────────────────

interface StyledLinkProps {
  $variant: LinkVariant;
}

export const StyledLink = styled.a<StyledLinkProps>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  transition:
    color   ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default},
    opacity ${({ theme }) => theme.transition.duration.fast} ${({ theme }) => theme.transition.easing.default};

  ${focusRing()}
  &:focus-visible {
    border-radius: ${({ theme }) => theme.border.radius.sm};
  }

  ${({ $variant }) => variantStyles[$variant]}
`;
