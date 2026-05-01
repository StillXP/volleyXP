import { css } from 'styled-components';

/** Accessible focus ring — matches :focus-visible selector */
export const focusRing = (offset = '2px') => css`
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.brand.primary};
    outline-offset: ${offset};
  }
`;

/** Single-line text overflow with ellipsis */
export const truncate = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** Visually hide an element while keeping it accessible to screen readers */
export const visuallyHidden = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

/** Apply a consistent surface elevation using shadow tokens */
export const surface = (level: 'sm' | 'md' | 'lg' = 'sm') => css`
  box-shadow: ${({ theme }) => theme.shadow[level]};
`;

/** Responsive breakpoint helper — usage: ${respondTo('md')} { ... } */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const respondTo = (bp: keyof typeof breakpoints) => css`
  @media (min-width: ${breakpoints[bp]})
`;
