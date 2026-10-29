"use client";

import { useRef, useState } from "react";
import { Button, InputField, RadioGroup } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { trpc } from "../lib/trpc";
import { gameWinner, targetFor, type ScoringRules, type Side } from "../lib/matchRules";
import { adjustScore, deriveScorer, undoWinningPoint, type CurrentGame, type ScorerMatch } from "../lib/scorer";
import { useSerialSender } from "../lib/useSerialSender";

export interface ScorerMatchData extends ScorerMatch {
  id: string;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
}

interface Props {
  match: ScorerMatchData;
  rules: ScoringRules;
  /** Called after a change is saved, so the caller can refetch. */
  onChanged: () => Promise<unknown> | void;
}

interface GameScore {
  gameNumber: number;
  team1Score: number;
  team2Score: number;
}

const muted: React.CSSProperties = { font: cssVars.typography.body.sm, color: cssVars.color.text.secondary, margin: 0 };
const srOnly: React.CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };
const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

/**
 * Courtside scorekeeping for one match: tap a team to give it a point. The score shown
 * updates at once, and saves go out one at a time with only the latest score, so a
 * quick run of taps is never lost or reordered.
 */
export function MatchScorer({ match, rules, onChanged }: Props) {
  const state = deriveScorer(match, rules);
  const names: Record<Side, string> = { 1: match.team1?.name ?? "Team 1", 2: match.team2?.name ?? "Team 2" };

  // What the scorekeeper has tapped but the server hasn't confirmed yet.
  const [override, setOverride] = useState<GameScore | null>(null);
  const version = useRef(0); // counts taps, so settling only clears what it has seen
  const [error, setError] = useState<string | null>(null);

  const recordGame = trpc.match.recordGame.useMutation();
  const complete = trpc.match.complete.useMutation();
  const reopen = trpc.match.reopen.useMutation();

  const sender = useSerialSender<GameScore>((score) => recordGame.mutateAsync({ matchId: match.id, ...score }), {
    onIdle: async () => {
      const seen = version.current;
      await onChanged();
      if (version.current === seen) setOverride(null);
    },
    onError: async (e) => {
      setError(messageOf(e));
      await onChanged();
      setOverride(null);
    },
  });

  const game: CurrentGame | null = override
    ? { ...override, target: targetFor(override.gameNumber, rules), stored: true }
    : state.game;
  const finishedNow = !!game && gameWinner(game.team1Score, game.team2Score, game.target) !== null;
  const playable = state.phase === "scoring" || state.phase === "decided";
  // Undoing the point that decided a match reopens it, so don't wait for the save to say so.
  const decidedNow = state.phase === "decided" && !(override && !finishedNow);
  const canAdd = playable && !decidedNow && !finishedNow;

  const save = (score: GameScore) => {
    version.current += 1;
    setError(null);
    setOverride(score);
    sender.push(score);
  };
  const tap = (side: Side, delta: 1 | -1) => {
    if (game) save({ gameNumber: game.gameNumber, ...adjustScore(game, side, delta) });
  };

  const [entry, setEntry] = useState({ team1: "", team2: "" });
  const [entryError, setEntryError] = useState<string | undefined>();
  const submitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const parse = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN);
    const team1Score = parse(entry.team1);
    const team2Score = parse(entry.team2);
    if (!game || Number.isNaN(team1Score) || Number.isNaN(team2Score)) {
      setEntryError("Enter whole numbers, 0 or more");
      return;
    }
    setEntryError(undefined);
    setEntry({ team1: "", team2: "" });
    save({ gameNumber: game.gameNumber, team1Score, team2Score });
  };

  const [forfeitWinner, setForfeitWinner] = useState("");
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const announcement = game
    ? `Game ${game.gameNumber}: ${names[1]} ${game.team1Score}, ${names[2]} ${game.team2Score}` +
      (decidedNow && state.winner ? `. ${names[state.winner]} won the match` : finishedNow ? ". Game finished" : "")
    : "";

  return (
    <section aria-label="Scoring" style={{ display: "flex", flexDirection: "column", gap: cssVars.space.md, padding: `${cssVars.space.sm} ${cssVars.space.lg}` }}>
      <h3 style={{ font: cssVars.typography.label.lg, color: cssVars.color.text.primary, margin: 0 }}>Score this match</h3>

      {state.phase === "waiting" && <p style={muted}>Scoring opens once both teams are known.</p>}
      {state.phase === "cancelled" && <p style={muted}>This match was cancelled.</p>}

      {state.phase === "forfeit" && (
        <>
          <p role="status" style={muted}>
            Completed by forfeit{state.winner ? `. ${names[state.winner]} advanced.` : "."}
          </p>
          <div>
            <Button variant="secondary" size="sm" loading={reopen.isPending} loadingLabel="Reopening match" onClick={() => run(() => reopen.mutateAsync({ id: match.id }))}>
              Reopen match
            </Button>
          </div>
        </>
      )}

      {playable && game && (
        <>
          <p style={muted}>
            Game {game.gameNumber} · first to {game.target}, win by 2 · Games won {state.wins[1]}–{state.wins[2]}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: cssVars.space.sm }}>
            {([1, 2] as const).map((side) => {
              const score = side === 1 ? game.team1Score : game.team2Score;
              return (
                <div
                  key={side}
                  role="group"
                  aria-label={names[side]}
                  style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: cssVars.space.xs, minWidth: 0 }}
                >
                  <span style={{ font: cssVars.typography.label.lg, color: cssVars.color.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                    {names[side]}
                  </span>
                  <span aria-hidden="true" style={{ font: cssVars.typography.display, color: cssVars.color.text.primary, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                    {score}
                  </span>
                  <Button size="lg" style={{ minHeight: 56 }} disabled={!canAdd} aria-label={`Point for ${names[side]}`} onClick={() => tap(side, 1)}>
                    +1
                  </Button>
                  <Button variant="secondary" size="sm" disabled={!playable || score === 0} aria-label={`Take a point off ${names[side]}`} onClick={() => tap(side, -1)}>
                    −1
                  </Button>
                </div>
              );
            })}
          </div>

          <p role="status" aria-live="polite" style={srOnly}>{announcement}</p>

          {decidedNow && state.winner ? (
            <p style={muted}>
              {names[state.winner]} won {state.wins[state.winner]}–{state.wins[state.winner === 1 ? 2 : 1]}. Use −1 to undo the last point.
            </p>
          ) : finishedNow ? (
            <p style={muted}>Game {game.gameNumber} finished.</p>
          ) : null}

          {state.previous && !override ? (
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => save({ gameNumber: state.previous!.gameNumber, ...undoWinningPoint(state.previous!) })}
              >
                Undo last point of game {state.previous.gameNumber}
              </Button>
            </div>
          ) : null}

          <details>
            <summary style={{ font: cssVars.typography.label.md, color: cssVars.color.text.secondary, cursor: "pointer" }}>Enter a score</summary>
            <form onSubmit={submitEntry} noValidate style={{ display: "flex", flexDirection: "column", gap: cssVars.space.sm, marginTop: cssVars.space.sm }}>
              <p style={muted}>Sets game {game.gameNumber} to these scores.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: cssVars.space.sm }}>
                <InputField label={names[1]} type="number" inputMode="numeric" min={0} value={entry.team1} onChange={(e) => setEntry({ ...entry, team1: e.target.value })} />
                <InputField label={names[2]} type="number" inputMode="numeric" min={0} value={entry.team2} onChange={(e) => setEntry({ ...entry, team2: e.target.value })} />
              </div>
              {entryError ? <p role="alert" style={{ ...muted, color: cssVars.color.text.danger }}>{entryError}</p> : null}
              <div><Button type="submit" variant="secondary" size="sm">Save score</Button></div>
            </form>
          </details>

          {state.phase === "scoring" && (
            <details>
              <summary style={{ font: cssVars.typography.label.md, color: cssVars.color.text.secondary, cursor: "pointer" }}>Record a forfeit</summary>
              <div style={{ display: "flex", flexDirection: "column", gap: cssVars.space.sm, marginTop: cssVars.space.sm }}>
                <RadioGroup
                  legend="Who wins by forfeit?"
                  options={[{ value: match.team1!.id, label: names[1] }, { value: match.team2!.id, label: names[2] }]}
                  value={forfeitWinner}
                  onValueChange={setForfeitWinner}
                />
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!forfeitWinner}
                    loading={complete.isPending}
                    loadingLabel="Recording forfeit"
                    onClick={() => run(() => complete.mutateAsync({ id: match.id, winnerId: forfeitWinner }))}
                  >
                    Record forfeit
                  </Button>
                </div>
              </div>
            </details>
          )}
        </>
      )}

      {sender.pending ? <p aria-live="polite" style={muted}>Saving…</p> : null}
      {error ? <p role="alert" style={{ ...muted, color: cssVars.color.text.danger }}>{error}</p> : null}
    </section>
  );
}
