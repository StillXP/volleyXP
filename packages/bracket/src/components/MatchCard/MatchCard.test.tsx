import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cssVars } from '@lockin/tokens';
import { MatchCard } from './MatchCard';

const team1 = { seed: 1, name: 'Team Alpha', setScores: [21, 15], totalSets: 2, winner: true };
const team2 = { seed: 2, name: 'Team Beta', setScores: [18, 21], totalSets: 1 };

describe('MatchCard', () => {
  it('renders the match id', () => {
    render(<MatchCard matchId="QF1" team1={team1} team2={team2} />);
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
    expect(screen.getAllByText('21')).toHaveLength(2);
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('bolds only winning scores for each completed set', () => {
    render(<MatchCard status="completed" team1={team1} team2={team2} />);

    const firstSetWinner = screen.getAllByText('21')[0];
    const firstSetLoser = screen.getByText('18');
    const secondSetWinner = screen.getAllByText('21')[1];
    const secondSetLoser = screen.getByText('15');

    expect(window.getComputedStyle(firstSetWinner).fontWeight).toBe(cssVars.font.weight.bold);
    expect(window.getComputedStyle(secondSetWinner).fontWeight).toBe(cssVars.font.weight.bold);
    expect(window.getComputedStyle(firstSetLoser).fontWeight).toBe(cssVars.font.weight.regular);
    expect(window.getComputedStyle(secondSetLoser).fontWeight).toBe(cssVars.font.weight.regular);
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

    expect(window.getComputedStyle(completedSetWinner).fontWeight).toBe(cssVars.font.weight.bold);
    expect(window.getComputedStyle(incompleteSetScore).fontWeight).toBe(cssVars.font.weight.regular);
  });

  it('renders seed numbers for non-upcoming matches', () => {
    render(<MatchCard status="completed" team1={{ seed: 5, name: 'Team X' }} team2={{ seed: 8, name: 'Team Y' }} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders seed numbers for upcoming matches when a seed is provided', () => {
    render(<MatchCard status="upcoming" team1={{ seed: 5, name: 'Team X' }} team2={{ seed: 8, name: 'Team Y' }} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('omits the seed for placeholder teams in upcoming matches', () => {
    render(<MatchCard status="upcoming" team1={{ name: 'Winner of WB1', isPlaceholder: true }} team2={{ name: 'Winner of WB2', isPlaceholder: true }} />);
    expect(screen.getByText('Winner of WB1')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });
});
