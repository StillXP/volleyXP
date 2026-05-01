import type { Meta, StoryObj } from '@storybook/react';
import { Dropdown } from './Dropdown';

const fruitOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
  { value: 'elderberry', label: 'Elderberry', disabled: true },
  { value: 'fig', label: 'Fig' },
  { value: 'grape', label: 'Grape' },
];

const meta: Meta<typeof Dropdown> = {
  title: 'Components/Dropdown',
  component: Dropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Accessible select component built with the ARIA listbox pattern. Supports keyboard navigation (arrows, enter, escape), controlled and uncontrolled modes, and disabled options.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
    label: { control: 'text' },
    errorText: { control: 'text' },
  },
  args: {
    options: fruitOptions,
    placeholder: 'Select a fruit',
    label: 'Fruit',
    size: 'md',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280, paddingBottom: 260 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Dropdown>;

export const Default: Story = {};

export const WithDefaultValue: Story = {
  args: { defaultValue: 'cherry' },
};

export const WithError: Story = {
  args: {
    errorText: 'Please select an option to continue.',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 280, paddingBottom: 260 }}>
      <Dropdown options={fruitOptions} label="Small" placeholder="Select…" size="sm" />
      <Dropdown options={fruitOptions} label="Medium" placeholder="Select…" size="md" />
      <Dropdown options={fruitOptions} label="Large" placeholder="Select…" size="lg" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'apple' },
};

export const NoLabel: Story = {
  args: { placeholder: 'Choose a fruit…' },
};
