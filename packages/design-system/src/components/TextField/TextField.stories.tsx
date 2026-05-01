import type { Meta, StoryObj } from '@storybook/react';
import { TextField } from './TextField';

const meta: Meta<typeof TextField> = {
  title: 'Components/TextField',
  component: TextField,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Controlled text input with label, helper text, error state, and optional leading/trailing addons. Label is always required for accessibility.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    hideLabel: { control: 'boolean' },
    label: { control: 'text' },
    helperText: { control: 'text' },
    errorText: { control: 'text' },
    placeholder: { control: 'text' },
  },
  args: {
    label: 'Email',
    placeholder: 'you@example.com',
    size: 'md',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TextField>;

export const Default: Story = {};

export const WithHelperText: Story = {
  args: {
    helperText: "We'll never share your email with anyone.",
  },
};

export const WithError: Story = {
  args: {
    errorText: 'Please enter a valid email address.',
    defaultValue: 'not-an-email',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
      <TextField label="Small" placeholder="Small input" size="sm" />
      <TextField label="Medium" placeholder="Medium input" size="md" />
      <TextField label="Large" placeholder="Large input" size="lg" />
    </div>
  ),
};

export const WithLeadingAddon: Story = {
  args: {
    label: 'Website',
    placeholder: 'example.com',
    leadingAddon: (
      <span style={{ fontSize: 14, color: '#737373' }}>https://</span>
    ),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'disabled@example.com',
  },
};

export const HiddenLabel: Story = {
  args: {
    hideLabel: true,
    placeholder: 'Search…',
    label: 'Search',
  },
};
