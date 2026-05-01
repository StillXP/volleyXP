import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Link } from './Link';

describe('Link', () => {
  it('renders children', () => {
    render(<Link href="/test">Go here</Link>);
    expect(screen.getByRole('link', { name: /go here/i })).toBeInTheDocument();
  });

  it('renders as an anchor by default', () => {
    render(<Link href="/test">Link</Link>);
    expect(screen.getByRole('link')).toBeInstanceOf(HTMLAnchorElement);
  });

  it('applies the correct variant class', () => {
    render(<Link variant="subtle">Subtle</Link>);
    expect(screen.getByRole('link')).toHaveClass('subtle');
  });

  it('applies external attributes when external is true', () => {
    render(<Link href="https://example.com" external>External</Link>);
    const link = screen.getByRole('link', { name: /external/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders external icon indicator when external is true', () => {
    render(<Link href="https://example.com" external>External</Link>);
    expect(screen.getByLabelText('(opens in new tab)')).toBeInTheDocument();
  });

  it('does not render external icon when external is false', () => {
    render(<Link href="/internal">Internal</Link>);
    expect(screen.queryByLabelText('(opens in new tab)')).not.toBeInTheDocument();
  });

  it('renders as a custom component via the as prop', () => {
    const CustomComponent = (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a data-custom="true" {...props} />
    );
    render(<Link as={CustomComponent} href="/test">Custom</Link>);
    expect(screen.getByRole('link')).toHaveAttribute('data-custom', 'true');
  });

  it('forwards a ref to the anchor element', () => {
    const ref = { current: null as HTMLAnchorElement | null };
    render(<Link ref={ref} href="/test">Ref</Link>);
    expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
  });
});
