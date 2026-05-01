import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Content card with an optional image, title, description, and tags.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    image: { control: 'text', description: 'Image source URL' },
    imageAlt: { control: 'text', description: 'Alt text for the image' },
    title: { control: 'text', description: 'Card title' },
    description: { control: 'text', description: 'Supporting description text' },
    tags: { control: 'object', description: 'Tags shown below the description' },
  },
  args: {
    title: 'Revamping Design Token Workflows at CBS Sports',
    description:
      'Developed an automated token system to support expanding coverage of the Playbook Design System',
    tags: ['Design Tokens', 'Cross-Functional Workflows', 'Automation'],
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {};

export const WithImage: Story = {
  args: {
    image: 'https://placehold.co/524x261',
    imageAlt: 'Card image',
  },
};

export const NoDescription: Story = {
  args: {
    description: undefined,
  },
};

export const NoTags: Story = {
  args: {
    tags: undefined,
  },
};

export const TitleOnly: Story = {
  args: {
    description: undefined,
    tags: undefined,
  },
};
