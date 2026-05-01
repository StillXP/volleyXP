import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders the title', () => {
    render(<Card title="My Card" />);
    expect(screen.getByText('My Card')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<Card title="My Card" description="Some description" />);
    expect(screen.getByText('Some description')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    render(<Card title="My Card" />);
    expect(screen.queryByText('Some description')).not.toBeInTheDocument();
  });

  it('renders tags joined with a separator', () => {
    render(<Card title="My Card" tags={['Design Tokens', 'Automation']} />);
    expect(screen.getByText('Design Tokens · Automation')).toBeInTheDocument();
  });

  it('does not render tags when omitted', () => {
    render(<Card title="My Card" />);
    expect(screen.queryByRole('paragraph', { name: /·/ })).not.toBeInTheDocument();
  });

  it('renders an image with the correct src and alt', () => {
    render(<Card title="My Card" image="/card.jpg" imageAlt="A card image" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/card.jpg');
    expect(img).toHaveAttribute('alt', 'A card image');
  });

  it('does not render an image when image prop is omitted', () => {
    render(<Card title="My Card" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
