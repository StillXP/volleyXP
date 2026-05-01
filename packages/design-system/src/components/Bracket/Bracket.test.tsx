import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Bracket } from './Bracket';
import type { BracketTeam, BracketMatchData } from './Bracket';

const make = (n: number): BracketTeam[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));

describe('Bracket', () => {
  it('renders a power-of-2 bracket (8 teams) with all round-1 matches', () => {
    render(<Bracket teams={make(8)} />);
    // 4 round-1 matches
    expect(screen.getAllByText(/Round of 16 \d/)).toHaveLength(4);
  });

  it('renders correct number of rounds for 8 teams', () => {
    render(<Bracket teams={make(8)} />);
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getAllByText(/Semifinal \d/)).toHaveLength(2);
    expect(screen.getAllByText(/Quarterfinal \d/)).toHaveLength(4);
  });

  it('renders all team names in round 1', () => {
    render(<Bracket teams={make(4)} />);
    for (let i = 1; i <= 4; i++) {
      expect(screen.getByText(`Team ${i}`)).toBeInTheDocument();
    }
  });

  it('does not render bye match cards for a 7-team bracket', () => {
    render(<Bracket teams={make(7)} />);
    // Only 1 real round-1 match (7v8 position); no BYE card shown
    expect(screen.queryByText('BYE')).not.toBeInTheDocument();
  });

  it('renders only the real round-1 match for a 9-team bracket (8v9)', () => {
    render(<Bracket teams={make(9)} />);
    // Seed 8 and seed 9 are the only round-1 real match
    expect(screen.getByText('Team 8')).toBeInTheDocument();
    expect(screen.getByText('Team 9')).toBeInTheDocument();
    expect(screen.queryByText('BYE')).not.toBeInTheDocument();
  });

  it('renders no round-1 cards when all teams have byes (power-of-2 minus 1 special case: 3 teams)', () => {
    // bracketSize=4, seeds [1,4,2,3]: pair0=(1vBYE), pair1=(2v3) → 1 real match
    render(<Bracket teams={make(3)} />);
    expect(screen.queryByText('BYE')).not.toBeInTheDocument();
    expect(screen.getByText('Team 2')).toBeInTheDocument();
    expect(screen.getByText('Team 3')).toBeInTheDocument();
  });

  it('shows "Winner of X" placeholder in later rounds when result is unknown', () => {
    render(<Bracket teams={make(4)} />);
    expect(screen.getAllByText(/Winner of/i).length).toBeGreaterThan(0);
  });

  it('propagates a winner to the next round when winnerId is provided', () => {
    const teams = make(4);
    const matchData: BracketMatchData[] = [
      {
        matchId: 'r1-m1',
        status: 'completed',
        winnerId: 'team-1',
        team1Score: { setScores: [21, 21], totalSets: 2 },
        team2Score: { setScores: [15, 18], totalSets: 0 },
      },
    ];
    render(<Bracket teams={teams} matchData={matchData} />);
    // "Team 1" should now appear in the semifinal slot, not "Winner of ..."
    const team1Instances = screen.getAllByText('Team 1');
    expect(team1Instances.length).toBeGreaterThanOrEqual(2);
  });

  it('shows COMPLETED status for a finished match', () => {
    const teams = make(4);
    const matchData: BracketMatchData[] = [
      { matchId: 'r1-m1', status: 'completed', winnerId: 'team-1' },
    ];
    render(<Bracket teams={teams} matchData={matchData} />);
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0);
  });

  it('shows LIVE status for an in-progress match', () => {
    const teams = make(4);
    const matchData: BracketMatchData[] = [
      { matchId: 'r1-m1', status: 'live' },
    ];
    render(<Bracket teams={teams} matchData={matchData} />);
    expect(screen.getAllByText('LIVE').length).toBeGreaterThan(0);
  });

  it('renders a 2-team bracket as a single final match', () => {
    render(<Bracket teams={make(2)} />);
    expect(screen.getByText('Final')).toBeInTheDocument();
  });

  it('renders a 16-team bracket with 4 rounds', () => {
    render(<Bracket teams={make(16)} />);
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getAllByText(/Semifinal \d/).length).toBe(2);
    expect(screen.getAllByText(/Quarterfinal \d/).length).toBe(4);
    expect(screen.getAllByText(/Round of 16 \d/).length).toBe(8);
  });
});
