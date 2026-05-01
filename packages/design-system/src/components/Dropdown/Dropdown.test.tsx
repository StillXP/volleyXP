import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dropdown } from './Dropdown';

const OPTIONS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry', disabled: true },
];

describe('Dropdown', () => {
  it('renders the placeholder when no value is selected', () => {
    render(<Dropdown options={OPTIONS} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Select an option');
  });

  it('renders a custom placeholder', () => {
    render(<Dropdown options={OPTIONS} placeholder="Pick a fruit" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Pick a fruit');
  });

  it('renders the label', () => {
    render(<Dropdown options={OPTIONS} label="Fruit" />);
    expect(screen.getByText('Fruit')).toBeInTheDocument();
  });

  it('opens the listbox on trigger click', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={OPTIONS} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('closes the listbox on second trigger click', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={OPTIONS} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders all options when open', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={OPTIONS} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('calls onChange and updates display when an option is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Banana' }));
    expect(onChange).toHaveBeenCalledWith('banana', OPTIONS[1]);
    expect(screen.getByRole('combobox')).toHaveTextContent('Banana');
  });

  it('does not call onChange for a disabled option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} onChange={onChange} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Cherry' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={OPTIONS} disabled />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders the selected value when defaultValue is provided', () => {
    render(<Dropdown options={OPTIONS} defaultValue="banana" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Banana');
  });

  it('renders the selected value in controlled mode', () => {
    render(<Dropdown options={OPTIONS} value="apple" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Apple');
  });

  it('opens with ArrowDown key', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={OPTIONS} />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('selects highlighted option with Enter key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} onChange={onChange} />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalled();
  });

  it('closes the listbox with Escape key', async () => {
    const user = userEvent.setup();
    render(<Dropdown options={OPTIONS} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders error text', () => {
    render(<Dropdown options={OPTIONS} errorText="Selection required" />);
    expect(screen.getByText('Selection required')).toBeInTheDocument();
  });

  it('sets aria-invalid on the trigger when errorText is provided', () => {
    render(<Dropdown options={OPTIONS} errorText="Selection required" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('closes when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Dropdown options={OPTIONS} />
        <button>Outside</button>
      </div>
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
