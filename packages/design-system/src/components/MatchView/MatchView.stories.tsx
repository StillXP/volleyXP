import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { MatchView, MatchViewOverlay } from './MatchView';
import type { MatchViewProps } from './MatchView';

// ─── Shared arg presets ───────────────────────────────────────────────────────

const baseArgs: MatchViewProps = {
  bracketSection: 'Winners Bracket',
  matchName: 'Quarterfinal #1',
  status: 'upcoming',
  team1: { seed: 12, name: 'Team 1' },
  team2: { seed: 5,  name: 'Team 2' },
  startTime: 'Sat, May 2 • 2:30 PM',
  location: 'Court 3 • Long Beach',
  winnerPath: { destination: 'Semifinal 1', href: '#sf1' },
  loserPath:  { destination: 'LB Round 2', href: '#lb-r2' },
  onClose: () => {},
};

const liveArgs: MatchViewProps = {
  ...baseArgs,
  status: 'live',
  team1: { seed: 12, name: 'Team 1', setScores: [19, 12], totalSets: 0 },
  team2: { seed: 5,  name: 'Team 2', setScores: [21, 13], totalSets: 1 },
  videoUrl: 'https://example.com/live',
};

const completedArgs: MatchViewProps = {
  ...baseArgs,
  status: 'completed',
  team1: { seed: 12, name: 'Team 1', setScores: [19, 12], totalSets: 0 },
  team2: { seed: 5,  name: 'Team 2', setScores: [21, 21], totalSets: 2, winner: true },
  videoUrl: 'https://example.com/replay',
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof MatchView> = {
  title: 'Components/MatchView',
  component: MatchView,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Displays detailed match information — score, bracket paths, and actions — in an overlay ' +
          'panel triggered when a bracket match card is clicked. ' +
          'Wrap with `MatchViewOverlay` for the full modal experience.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status:    { control: 'select', options: ['upcoming', 'live', 'completed'] },
    startTime: { control: 'text' },
    location:  { control: 'text' },
    videoUrl:  { control: 'text', description: 'Leave empty to show disabled state' },
    shareUrl:  { control: 'text' },
  },
  args: baseArgs,
  decorators: [
    (Story) => (
      <div style={{ padding: 24, background: '#f5f5f5', minWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MatchView>;

// ─── Panel stories ────────────────────────────────────────────────────────────

export const Upcoming: Story = {};

export const Live: Story = {
  args: liveArgs,
};

export const Completed: Story = {
  args: completedArgs,
};

export const CompletedLoserEliminated: Story = {
  name: 'Completed — Loser Eliminated',
  args: {
    ...completedArgs,
    loserPath: { destination: '13th', eliminated: true },
  },
};

export const NoTimeOrLocation: Story = {
  name: 'No Time or Location',
  render: () => (
    <MatchView
      bracketSection="Winners Bracket"
      matchName="Quarterfinal #1"
      status="upcoming"
      team1={{ seed: 12, name: 'Team 1' }}
      team2={{ seed: 5, name: 'Team 2' }}
      winnerPath={{ destination: 'Semifinal 1', href: '#sf1' }}
      loserPath={{ destination: 'LB Round 2', href: '#lb-r2' }}
      onClose={() => {}}
    />
  ),
};

export const NoVideoAvailable: Story = {
  name: 'No Video Available',
  render: () => (
    <MatchView
      bracketSection="Winners Bracket"
      matchName="Quarterfinal #1"
      status="live"
      team1={{ seed: 12, name: 'Team 1', setScores: [19, 12], totalSets: 0 }}
      team2={{ seed: 5,  name: 'Team 2', setScores: [21, 13], totalSets: 1 }}
      startTime="Sat, May 2 • 2:30 PM"
      location="Court 3 • Long Beach"
      winnerPath={{ destination: 'Semifinal 1', href: '#sf1' }}
      loserPath={{ destination: 'LB Round 2', href: '#lb-r2' }}
      onClose={() => {}}
    />
  ),
};

export const NoViewLinks: Story = {
  name: 'No "View" Links on Paths',
  args: {
    ...completedArgs,
    winnerPath: { destination: 'Semifinal 1' },
    loserPath:  { destination: 'LB Round 2' },
  },
};

export const LosersBreacketMatch: Story = {
  name: "Losers Bracket Match",
  args: {
    ...completedArgs,
    bracketSection: 'Losers Bracket',
    matchName: 'LB Round 2 #3',
    winnerPath: { destination: 'LB Quarterfinal 2', href: '#lb-qf2' },
    loserPath:  { destination: '9th–12th', eliminated: true },
  },
};

// ─── Overlay stories ──────────────────────────────────────────────────────────

export const WithOverlay: Story = {
  name: 'With Overlay — Upcoming',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: '12px 24px',
            background: '#0066FF',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        >
          Open Match View
        </button>
        {open && (
          <MatchViewOverlay onClose={() => setOpen(false)}>
            <MatchView {...args} onClose={() => setOpen(false)} />
          </MatchViewOverlay>
        )}
      </div>
    );
  },
  args: baseArgs,
};

export const WithOverlayCompleted: Story = {
  name: 'With Overlay — Completed',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: '12px 24px',
            background: '#0066FF',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        >
          Open Match View
        </button>
        {open && (
          <MatchViewOverlay onClose={() => setOpen(false)}>
            <MatchView {...args} onClose={() => setOpen(false)} />
          </MatchViewOverlay>
        )}
      </div>
    );
  },
  args: completedArgs,
};

export const AllVariantsSideBySide: Story = {
  name: 'All Statuses Side By Side',
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div
      style={{
        display: 'flex',
        gap: 24,
        padding: 24,
        background: '#f5f5f5',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}
    >
      <MatchView {...baseArgs} onClose={() => {}} />
      <MatchView {...liveArgs} onClose={() => {}} />
      <MatchView {...completedArgs} onClose={() => {}} />
      <MatchView
        {...completedArgs}
        loserPath={{ destination: '13th', eliminated: true }}
        onClose={() => {}}
      />
    </div>
  ),
};
