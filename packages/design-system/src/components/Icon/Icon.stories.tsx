import type { Meta, StoryObj } from '@storybook/react';
import { ICON_PATHS } from './icons';
import { Icon } from './Icon';

const iconNames = Object.keys(ICON_PATHS) as Array<keyof typeof ICON_PATHS>;

const meta: Meta<typeof Icon> = {
  title: 'Components/Icon',
  component: Icon,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Renders an accessible inline SVG icon from the built-in registry. When `title` is provided the icon is treated as an image; otherwise it is hidden from screen readers as a decorative element.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    name: { control: 'select', options: iconNames },
    size: { control: 'text' },
    color: { control: 'color' },
    title: { control: 'text' },
  },
  args: {
    name: 'check',
    size: '1.5em',
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

export const Default: Story = {};

export const WithTitle: Story = {
  args: {
    name: 'info',
    title: 'Information',
  },
};

export const CustomSize: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Icon name="home" size={16} />
      <Icon name="home" size={24} />
      <Icon name="home" size={32} />
      <Icon name="home" size={48} />
    </div>
  ),
};

export const AllIcons: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: 16,
        width: 600,
      }}
    >
      {iconNames.map((name) => (
        <div
          key={name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #e5e5e5',
          }}
        >
          <Icon name={name} size={20} />
          <span style={{ fontSize: 11, color: '#737373', textAlign: 'center' }}>
            {name}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const InheritColor: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ color: '#0066FF' }}>
        <Icon name="info" size={20} />
      </span>
      <span style={{ color: '#DC2626' }}>
        <Icon name="alert-circle" size={20} />
      </span>
      <span style={{ color: '#16A34A' }}>
        <Icon name="check" size={20} />
      </span>
    </div>
  ),
};
