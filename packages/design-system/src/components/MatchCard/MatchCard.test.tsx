import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MatchCard } from './MatchCard';

const team1 = { seed: 1, name: 'Team Alpha', setScores: [21, 15], totalSets: 2, winner: true };
const team2 = { seed: 2, name: 'Team Beta', setScores: [18, 21], totalSets: 1 };

describe('MatchCard', () => {
  it('renders the match title', () => {
    render(<MatchCard title="QF1" team1={team1} team2={team2} />);
    expect(screen.getByText('QF1')).toBeInTheDocument();
  });

  it('renders both team names', () => {
    render(<MatchCard team1={team1} team2={team2} />);
    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
  });

  it('renders COMPLETED status label', () => {
    render(<MatchCard status="completed" team1={team1} team2={team2} />);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  it('renders LIVE status label', () => {
    render(<MatchCard status="live" team1={team1} team2={team2} />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('renders UPCOMING status label', () => {
    render(<MatchCard status="upcoming" team1={team1} team2={team2} />);
    expect(screen.getByText('UPCOMING')).toBeInTheDocument();
  });

  it('shows location and time for upcoming matches', () => {
    render(
      <MatchCard status="upcoming" team1={team1} team2={team2} location="Court 1" startTime="3:00 PM" />
    );
    expect(screen.getByText('Court 1')).toBeInTheDocument();
    expect(screen.getByText('3:00 PM')).toBeInTheDocument();
  });

  it('shows location for live matches', () => {
    render(<MatchCard status="live" team1={team1} team2={team2} location="Court 3" />);
    expect(screen.getByText('Court 3')).toBeInTheDocument();
  });

  it('does not show start time for live matches', () => {
    render(<MatchCard status="live" team1={team1} team2={team2} startTime="4:00 PM" />);
    expect(screen.queryByText('4:00 PM')).not.toBeInTheDocument();
  });

  it('renders set scores for completed matches', () => {
    render(<MatchCard status="completed" team1={team1} team2={team2} />);
    expect(screen.getByText('21')).toBeInTheDocument();
  });

  it('bolds only winning scores for each completed set', () => {
    render(<MatchCard status="completed" team1={team1} team2={team2} />);

    const firstSetWinner = screen.getAllByText('21')[0];
    const firstSetLoser = screen.getByText('18');
    const secondSetWinner = screen.getAllByText('21')[1];
    const secondSetLoser = screen.getByText('15');

    expect(window.getComputedStyle(firstSetWinner).fontWeight).toBe('700');
    expect(window.getComputedStyle(secondSetWinner).fontWeight).toBe('700');
    expect(window.getComputedStyle(firstSetLoser).fontWeight).toBe('400');
    expect(window.getComputedStyle(secondSetLoser).fontWeight).toBe('400');
  });

  it('does not bold scores when a set is incomplete', () => {
    render(
      <MatchCard
        status="live"
        team1={{ name: 'Team A', setScores: [21, 10] }}
        team2={{ name: 'Team B', setScores: [19] }}
      />
    );

    const completedSetWinner = screen.getByText('21');
    const incompleteSetScore = screen.getByText('10');

    expect(window.getComputedStyle(completedSetWinner).fontWeight).toBe('700');
    expect(window.getComputedStyle(incompleteSetScore).fontWeight).toBe('400');
  });

  it('renders seed numbers for non-upcoming matches', () => {
    render(<MatchCard status="completed" team1={{ seed: 5, name: 'Team X' }} team2={{ seed: 8, name: 'Team Y' }} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('does not render seed numbers for upcoming matches', () => {
    render(<MatchCard status="upcoming" team1={{ seed: 5, name: 'Winner of WB1' }} team2={{ seed: 8, name: 'Winner of WB2' }} />);
    expect(screen.queryByText('5')).not.toBeInTheDocument();
    expect(screen.queryByText('8')).not.toBeInTheDocument();
  });
});
