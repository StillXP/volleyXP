import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';

describe('Icon', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('is decorative (aria-hidden) when no title is provided', () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has role="img" when a title is provided', () => {
    render(<Icon name="check" title="Confirmed" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders a title element with the provided text', () => {
    render(<Icon name="check" title="Confirmed" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('links aria-labelledby to the title element id', () => {
    render(<Icon name="check" title="Confirmed" />);
    const svg = screen.getByRole('img');
    const titleEl = screen.getByText('Confirmed');
    expect(svg.getAttribute('aria-labelledby')).toBe(titleEl.id);
  });

  it('applies a numeric size as px dimensions', () => {
    const { container } = render(<Icon name="check" size={24} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '24px');
    expect(svg).toHaveAttribute('height', '24px');
  });

  it('applies a string size directly', () => {
    const { container } = render(<Icon name="check" size="2rem" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '2rem');
    expect(svg).toHaveAttribute('height', '2rem');
  });

  it('defaults to 1em size', () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '1em');
    expect(svg).toHaveAttribute('height', '1em');
  });

  it('applies the color prop to the stroke attribute', () => {
    const { container } = render(<Icon name="check" color="#ff0000" />);
    expect(container.querySelector('svg')).toHaveAttribute('stroke', '#ff0000');
  });

  it('defaults stroke to currentColor', () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector('svg')).toHaveAttribute('stroke', 'currentColor');
  });
});
