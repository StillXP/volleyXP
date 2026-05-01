import type { Meta, StoryObj } from '@storybook/react';
import { Link } from './Link';

const meta: Meta<typeof Link> = {
  title: 'Components/Link',
  component: Link,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Accessible anchor component with three visual variants and optional external link handling. Supports polymorphic rendering via the `as` prop for router integration.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'subtle', 'standalone'],
    },
    external: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: {
    href: '#',
    children: 'Link text',
    variant: 'default',
  },
};

export default meta;
type Story = StoryObj<typeof Link>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Link href="#" variant="default">Default link</Link>
      <Link href="#" variant="subtle">Subtle link</Link>
      <Link href="#" variant="standalone">Standalone link →</Link>
    </div>
  ),
};

export const External: Story = {
  args: {
    href: 'https://example.com',
    external: true,
    children: 'Open external site',
  },
};

export const InlineText: Story = {
  render: () => (
    <p style={{ fontFamily: 'system-ui', fontSize: 16, maxWidth: 400 }}>
      This is a paragraph of text with an{' '}
      <Link href="#" variant="default">inline link</Link> that follows the surrounding
      font size and a{' '}
      <Link href="#" variant="subtle">subtle variant</Link> for less emphasis.
    </p>
  ),
};
