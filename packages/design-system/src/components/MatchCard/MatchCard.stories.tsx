import type { Meta, StoryObj } from '@storybook/react';
import { MatchCard } from './MatchCard';

const completedTeam1 = { seed: 12, name: 'Team 1', setScores: [19, 12], totalSets: 0 };
const completedTeam2 = { name: 'Team 2', setScores: [21, 21], totalSets: 2, winner: true };
const liveTeam1 = { seed: 12, name: 'Team 1', setScores: [19, 12], totalSets: 0 };
const liveTeam2 = { name: 'Team 2', setScores: [21, 13], totalSets: 1 };
const upcomingTeam1 = { seed: 3, name: 'Winner of WB1', isPlaceholder: true };
const upcomingTeam2 = { seed: 5, name: 'Winner of WB2', isPlaceholder: true };
const upcomingTeamScheduled = { seed: 2, name: 'Sand Sharks' };

const meta: Meta<typeof MatchCard> = {
  title: 'Components/MatchCard',
  component: MatchCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Displays a sports match with team scores and match status. Supports completed, live, and upcoming states in light and dark color schemes.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['completed', 'live', 'upcoming'],
      description: 'Current match status',
    },
    colorScheme: {
      control: 'select',
      options: ['light', 'dark'],
      description: 'Light or dark color scheme',
    },
    matchId: { control: 'text', description: 'Short match identifier badge (e.g. "W1", "L3", "GF")' },
    location: { control: 'text', description: 'Court or venue' },
    startTime: { control: 'text', description: 'Scheduled start time (upcoming only)' },
  },
  args: {
    matchId: 'W1',
    colorScheme: 'light',
    location: 'Court 2',
    startTime: '12:00 PM',
  },
};

export default meta;
type Story = StoryObj<typeof MatchCard>;

export const Completed: Story = {
  args: {
    status: 'completed',
    team1: completedTeam1,
    team2: completedTeam2,
  },
};

export const Live: Story = {
  args: {
    status: 'live',
    team1: liveTeam1,
    team2: liveTeam2,
  },
};

export const Upcoming: Story = {
  args: {
    status: 'upcoming',
    team1: upcomingTeam1,
    team2: upcomingTeam2,
  },
};

export const UpcomingMixed: Story = {
  args: {
    status: 'upcoming',
    team1: upcomingTeamScheduled,
    team2: upcomingTeam1,
  },
};

export const CompletedDark: Story = {
  args: {
    status: 'completed',
    colorScheme: 'dark',
    team1: completedTeam1,
    team2: completedTeam2,
  },
};

export const LiveDark: Story = {
  args: {
    status: 'live',
    colorScheme: 'dark',
    team1: liveTeam1,
    team2: liveTeam2,
  },
};

export const UpcomingDark: Story = {
  args: {
    status: 'upcoming',
    colorScheme: 'dark',
    team1: upcomingTeam1,
    team2: upcomingTeam2,
  },
};
