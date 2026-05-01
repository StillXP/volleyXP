import React from 'react';
import { StyledExternalIcon, StyledLink } from './Link.styles';

export type LinkVariant = 'default' | 'subtle' | 'standalone';

export interface LinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Visual style of the link */
  variant?: LinkVariant;
  /**
   * When true, automatically adds target="_blank" and rel="noopener noreferrer"
   * and appends an external link indicator.
   */
  external?: boolean;
  /**
   * Polymorphic render target — pass a router Link component (e.g. React Router,
   * Next.js) to have this component render as that element instead of <a>.
   *
   * @example
   * import { Link as RouterLink } from 'react-router-dom';
   * <Link as={RouterLink} to="/about">About</Link>
   */
  as?: React.ElementType;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (
    { variant = 'default', external = false, as: Component = 'a', children, ...props },
    ref
  ) => {
    const externalProps = external
      ? { target: '_blank', rel: 'noopener noreferrer' }
      : {};

    return (
      <StyledLink
        as={Component}
        ref={ref}
        $variant={variant}
        {...externalProps}
        {...props}
      >
        {children}
        {external && (
          <StyledExternalIcon aria-label="(opens in new tab)">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </StyledExternalIcon>
        )}
      </StyledLink>
    );
  }
);

Link.displayName = 'Link';
