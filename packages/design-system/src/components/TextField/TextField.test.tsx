import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField';

describe('TextField', () => {
  it('renders the label', () => {
    render(<TextField label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('associates label with input via htmlFor', () => {
    render(<TextField label="Email" id="email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'email');
  });

  it('renders helper text', () => {
    render(<TextField label="Email" helperText="We'll never share your email" />);
    expect(screen.getByText("We'll never share your email")).toBeInTheDocument();
  });

  it('renders error text', () => {
    render(<TextField label="Email" errorText="Invalid email address" />);
    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
  });

  it('hides helper text when errorText is provided', () => {
    render(
      <TextField label="Email" helperText="Helper" errorText="Error" />
    );
    expect(screen.queryByText('Helper')).not.toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('sets aria-invalid when errorText is provided', () => {
    render(<TextField label="Email" errorText="Invalid" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid without errorText', () => {
    render(<TextField label="Email" />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('links aria-describedby to error id', () => {
    render(<TextField label="Email" id="email" errorText="Invalid" />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-describedby')).toContain('email-error');
  });

  it('links aria-describedby to helper id', () => {
    render(<TextField label="Email" id="email" helperText="Hint" />);
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-describedby')).toContain('email-helper');
  });

  it('disables the input when disabled is true', () => {
    render(<TextField label="Email" disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('visually hides the label when hideLabel is true', () => {
    render(<TextField label="Email" hideLabel />);
    const label = screen.getByText('Email');
    expect(label).toHaveClass('visuallyHidden');
  });

  it('renders leadingAddon', () => {
    render(<TextField label="Search" leadingAddon={<span>icon</span>} />);
    expect(screen.getByText('icon')).toBeInTheDocument();
  });

  it('renders trailingAddon', () => {
    render(<TextField label="Search" trailingAddon={<span>clear</span>} />);
    expect(screen.getByText('clear')).toBeInTheDocument();
  });

  it('forwards a ref to the input element', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<TextField label="Email" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
