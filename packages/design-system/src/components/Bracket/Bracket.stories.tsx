import type { Meta, StoryObj } from '@storybook/react';
import { Bracket } from './Bracket';
import type { BracketTeam, BracketMatchData } from './Bracket';

const makeTeams = (n: number): BracketTeam[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));

const meta: Meta<typeof Bracket> = {
  title: 'Components/Bracket',
  component: Bracket,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Generates a single-elimination tournament bracket from a list of seeded teams. ' +
          'Byes are automatically assigned to top seeds when the team count is not a power of 2. ' +
          'Pass matchData to populate scores, statuses, and propagate winners to the next round.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    colorScheme: { control: 'select', options: ['light', 'dark'] },
  },
};

export default meta;
type Story = StoryObj<typeof Bracket>;

// ─── 8 teams (power of 2, no byes) ────────────────────────────────────────────

export const EightTeams: Story = {
  name: '8 Teams (clean bracket)',
  args: {
    teams: makeTeams(8),
    colorScheme: 'light',
  },
};

// ─── 7 teams (seed 1 gets a bye) ──────────────────────────────────────────────

export const SevenTeams: Story = {
  name: '7 Teams (seed 1 bye)',
  args: {
    teams: makeTeams(7),
    colorScheme: 'light',
  },
};

// ─── 5 teams (seeds 1–3 get byes) ─────────────────────────────────────────────

export const FiveTeams: Story = {
  name: '5 Teams (seeds 1–3 bye)',
  args: {
    teams: makeTeams(5),
    colorScheme: 'light',
  },
};

// ─── 8 teams with mixed match results ─────────────────────────────────────────

const mixedResults: BracketMatchData[] = [
  {
    matchId: 'r1-m1',
    status: 'completed',
    winnerId: 'team-8',
    team1Score: { setScores: [19, 12], totalSets: 0 },
    team2Score: { setScores: [21, 21], totalSets: 2 },
  },
  {
    matchId: 'r1-m2',
    status: 'completed',
    winnerId: 'team-4',
    team1Score: { setScores: [21, 21], totalSets: 2 },
    team2Score: { setScores: [15, 18], totalSets: 0 },
  },
  {
    matchId: 'r1-m3',
    status: 'live',
    team1Score: { setScores: [21, 13], totalSets: 1 },
    team2Score: { setScores: [19, 21], totalSets: 1 },
    location: 'Court 2',
  },
  {
    matchId: 'r1-m4',
    status: 'upcoming',
    location: 'Court 3',
    startTime: '2:00 PM',
  },
];

export const WithResults: Story = {
  name: '8 Teams with Results',
  args: {
    teams: makeTeams(8),
    matchData: mixedResults,
    colorScheme: 'light',
  },
};

// ─── 16 teams ─────────────────────────────────────────────────────────────────

export const SixteenTeams: Story = {
  name: '16 Teams',
  args: {
    teams: makeTeams(16),
    colorScheme: 'light',
  },
};

// ─── Dark color scheme ────────────────────────────────────────────────────────

export const DarkScheme: Story = {
  name: '8 Teams (dark)',
  args: {
    teams: makeTeams(8),
    matchData: mixedResults,
    colorScheme: 'dark',
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};
