import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
    // An 8-team bracket opens with the quarterfinals: 4 + 2 + 1 = 7 matches
    expect(screen.getByText('Quarterfinal')).toBeInTheDocument();
    expect(screen.queryByText('Round of 16')).not.toBeInTheDocument();
    expect(screen.getAllByText(/^W\d+$/)).toHaveLength(7);
    // The 4 round-1 matches feed the 2 semifinals
    expect(screen.getAllByText(/^Winner of Quarterfinal - W\d+$/)).toHaveLength(4);
  });

  it('renders correct number of rounds for 8 teams', () => {
    render(<Bracket teams={make(8)} />);
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByText('Semifinal')).toBeInTheDocument();
    expect(screen.getByText('Quarterfinal')).toBeInTheDocument();
    // 2 semifinals are fed by the 4 quarterfinals
    expect(screen.getAllByText(/^Winner of Semifinal - W\d+$/)).toHaveLength(2);
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
    for (const round of ['Round of 16', 'Quarterfinal', 'Semifinal']) {
      expect(screen.getByText(round)).toBeInTheDocument();
    }
    // 8 + 4 + 2 + 1 matches
    expect(screen.getAllByText(/^W\d+$/)).toHaveLength(15);
  });
});

describe('Bracket renderMatchActions', () => {
  const open = (container: HTMLElement, matchId: string) =>
    userEvent.click(container.querySelector(`[data-match-id="${matchId}"]`)!);

  it.each(['single', 'double'] as const)('shows its content in the match view that opens (%s elimination)', async format => {
    const renderMatchActions = vi.fn((id: string) => <p>Scoring for {id}</p>);
    const { container } = render(
      <Bracket teams={make(4)} eliminationFormat={format} renderMatchActions={renderMatchActions} />
    );
    // Nothing is rendered until a match is opened.
    expect(screen.queryByText(/Scoring for/)).toBeNull();
    expect(renderMatchActions).not.toHaveBeenCalled();

    await open(container, 'r1-m2');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Scoring for r1-m2')).toBeTruthy();
    expect(renderMatchActions).toHaveBeenLastCalledWith('r1-m2');
  });

  it('follows the match that is open', async () => {
    const { container } = render(
      <Bracket teams={make(4)} renderMatchActions={id => <p>Scoring for {id}</p>} />
    );
    await open(container, 'r1-m1');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await open(container, 'r1-m2');
    expect(within(screen.getByRole('dialog')).getByText('Scoring for r1-m2')).toBeTruthy();
  });

  it('adds nothing to the match view when it is not given', async () => {
    const { container } = render(<Bracket teams={make(4)} />);
    await open(container, 'r1-m1');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/Scoring for/)).toBeNull();
  });

  it('lets the content update with the bracket, so scores show as they are recorded', async () => {
    const matchData: BracketMatchData[] = [{ matchId: 'r1-m1', status: 'live', team1Score: { setScores: [12], totalSets: 0 }, team2Score: { setScores: [10], totalSets: 0 } }];
    const { container, rerender } = render(
      <Bracket teams={make(4)} matchData={matchData} renderMatchActions={() => <p>controls</p>} />
    );
    await open(container, 'r1-m1');
    expect(within(screen.getByRole('dialog')).getByText('12')).toBeTruthy();

    rerender(
      <Bracket
        teams={make(4)}
        matchData={[{ ...matchData[0]!, team1Score: { setScores: [13], totalSets: 0 } }]}
        renderMatchActions={() => <p>controls</p>}
      />
    );
    expect(within(screen.getByRole('dialog')).getByText('13')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText('controls')).toBeTruthy();
  });
});

describe('Bracket keyboard access', () => {
  const slot = (container: HTMLElement, matchId: string) =>
    container.querySelector<HTMLElement>(`[data-match-id="${matchId}"]`)!;

  it('makes every match a button in the tab order that opens a dialog', () => {
    const { container } = render(<Bracket teams={make(4)} />);
    const slots = container.querySelectorAll('[data-match-id]');
    expect(slots).toHaveLength(3);
    slots.forEach(el => {
      expect(el.getAttribute('role')).toBe('button');
      expect(el.getAttribute('tabindex')).toBe('0');
      expect(el.getAttribute('aria-haspopup')).toBe('dialog');
    });
  });

  it('names each match by its round, the teams, and how it stands', () => {
    const matchData: BracketMatchData[] = [
      { matchId: 'r1-m1', status: 'completed', winnerId: 'team-1', team1Score: { setScores: [25, 25], totalSets: 2 }, team2Score: { setScores: [18, 20], totalSets: 0 } },
      { matchId: 'r1-m2', status: 'live' },
    ];
    render(<Bracket teams={make(4)} matchData={matchData} />);
    expect(screen.getByRole('button', { name: 'Semifinal - W1: Team 1 versus Team 4, completed, 2 to 0 in sets, won by Team 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Semifinal - W2: Team 2 versus Team 3, live' })).toBeTruthy();
    // Matches that depend on earlier results say so rather than reading as blank teams.
    expect(screen.getByRole('button', { name: /^Final - W3: Team 1 versus Winner of Semifinal - W2, upcoming$/ })).toBeTruthy();
  });

  it('is reached with Tab, in bracket order', async () => {
    const { container } = render(<Bracket teams={make(4)} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(slot(container, 'r1-m1'));
    await userEvent.tab();
    expect(document.activeElement).toBe(slot(container, 'r1-m2'));
  });

  it.each([['Enter', '{Enter}'], ['Space', ' ']])('opens the match with %s', async (_name, key) => {
    const { container } = render(<Bracket teams={make(4)} />);
    slot(container, 'r1-m2').focus();
    await userEvent.keyboard(key);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Semifinal - W2')).toBeTruthy();
  });

  it('moves focus into the dialog when it opens, onto the dialog itself', async () => {
    const { container } = render(<Bracket teams={make(4)} />);
    slot(container, 'r1-m1').focus();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('does not press a button in the dialog when it was opened with Space', async () => {
    // Space activates a button on key release, so landing focus on one would click it.
    const onAdd = vi.fn();
    const { container } = render(
      <Bracket teams={make(4)} renderMatchActions={() => <button type="button" onClick={onAdd}>+1</button>} />
    );
    slot(container, 'r1-m1').focus();
    await userEvent.keyboard(' ');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('closes with Escape and puts focus back on the match', async () => {
    const { container } = render(<Bracket teams={make(4)} />);
    slot(container, 'r1-m2').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(slot(container, 'r1-m2'));
  });

  it('puts focus back on the match when closed with the Close button too', async () => {
    const { container } = render(<Bracket teams={make(4)} />);
    await userEvent.click(slot(container, 'r1-m1'));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(slot(container, 'r1-m1'));
  });

  it('keeps Tab and Shift+Tab inside the open dialog', async () => {
    const { container } = render(
      <Bracket teams={make(4)} renderMatchActions={() => <button type="button">Scoring control</button>} />
    );
    slot(container, 'r1-m1').focus();
    await userEvent.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 12; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 12; i++) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});
