import { describe, expect, it } from "vitest";
import { generateBracket } from "@design-system/bracket-model";
import { planBracket } from "../../server/bracketPlan";
import { toBracketView, type StoredMatch } from "../bracketView";

const team = (n: number, seed: number | null = n) => ({ id: `t${n}`, name: `Team ${n}`, seed });

const match = (overrides: Partial<StoredMatch> = {}): StoredMatch => ({
  bracketKey: "r1-m1",
  status: "SCHEDULED",
  team1: team(1),
  team2: team(2),
  winnerId: null,
  scheduledTime: null,
  court: null,
  games: [],
  ...overrides,
});

describe("toBracketView teams", () => {
  it("collects each team once, including ones that only appear in later rounds", () => {
    const { teams } = toBracketView([
      match({ bracketKey: "r1-m1", team1: team(2), team2: team(3) }),
      match({ bracketKey: "r2-m1", team1: team(1), team2: null }), // seed 1 had a bye
    ]);
    expect(teams.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("ranks by seed, unseeded last then by name, so seeds are always 1..N", () => {
    const { teams } = toBracketView([
      match({ team1: team(1, 7), team2: team(2, null) }),
      match({ bracketKey: "r1-m2", team1: team(3, 3), team2: { id: "t4", name: "Aces", seed: null } }),
    ]);
    expect(teams.map((t) => [t.name, t.seed])).toEqual([["Team 3", 1], ["Team 1", 2], ["Aces", 3], ["Team 2", 4]]);
  });

  it("is empty when nothing is stored", () => {
    expect(toBracketView([])).toEqual({ teams: [], matchData: [] });
  });
});

describe("toBracketView match data", () => {
  it.each([
    ["SCHEDULED", "upcoming"],
    ["IN_PROGRESS", "live"],
    ["COMPLETED", "completed"],
    ["CANCELLED", "upcoming"],
  ] as const)("maps %s to %s", (status, expected) => {
    expect(toBracketView([match({ status })]).matchData[0]!.status).toBe(expected);
  });

  it("is keyed by the bracket key and skips matches that aren't part of a bracket", () => {
    const { matchData } = toBracketView([match({ bracketKey: "lb-r2-m1" }), match({ bracketKey: null })]);
    expect(matchData.map((m) => m.matchId)).toEqual(["lb-r2-m1"]);
  });

  it("carries the winner, and omits it while the match is undecided", () => {
    const decided = toBracketView([match({ status: "COMPLETED", winnerId: "t2" })]).matchData[0]!;
    const open = toBracketView([match()]).matchData[0]!;
    expect(decided.winnerId).toBe("t2");
    expect("winnerId" in open).toBe(false);
  });

  it("gives each team its own set scores and sets won, in game order", () => {
    const games = [
      { gameNumber: 2, team1Score: 18, team2Score: 25, winnerId: "t2" },
      { gameNumber: 1, team1Score: 25, team2Score: 20, winnerId: "t1" },
      { gameNumber: 3, team1Score: 12, team2Score: 15, winnerId: "t2" },
    ];
    const data = toBracketView([match({ status: "COMPLETED", winnerId: "t2", games })]).matchData[0]!;
    expect(data.team1Score).toEqual({ setScores: [25, 18, 12], totalSets: 1 });
    expect(data.team2Score).toEqual({ setScores: [20, 25, 15], totalSets: 2 });
  });

  it("has no scores before a game is played", () => {
    const data = toBracketView([match()]).matchData[0]!;
    expect("team1Score" in data || "team2Score" in data).toBe(false);
  });

  it("shows the court and a start time, from a string or a Date", () => {
    const iso = "2026-11-02T15:30:00.000Z";
    const fromString = toBracketView([match({ court: { name: "Net 2" }, scheduledTime: iso })]).matchData[0]!;
    const fromDate = toBracketView([match({ scheduledTime: new Date(iso) })]).matchData[0]!;
    expect(fromString.location).toBe("Net 2");
    expect(fromString.startTime).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/);
    expect(fromDate.startTime).toBe(fromString.startTime);
  });

  it("omits location and start time when there are none", () => {
    const data = toBracketView([match()]).matchData[0]!;
    expect("location" in data || "startTime" in data).toBe(false);
  });
});

describe("toBracketView with the generator", () => {
  it("feeds the Bracket component's own generator the same teams the bracket was built from", () => {
    // 5 teams: three have byes, so only the 4v5 match has both teams in round 1.
    const stored = [
      match({ bracketKey: "r1-m4", team1: team(4), team2: team(5) }),
      match({ bracketKey: "r2-m1", team1: team(1), team2: null }),
      match({ bracketKey: "r2-m2", team1: team(2), team2: team(3) }),
    ];
    const { teams } = toBracketView(stored);
    expect(teams).toHaveLength(5);
    const rounds = generateBracket(teams, [], false);
    expect(rounds.map((r) => r.matches.length)).toEqual([4, 2, 1]);
  });
});

describe("toBracketView with planned brackets", () => {
  const sizes = Array.from({ length: 31 }, (_, i) => i + 2);
  const named = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, seed: i + 1 }));

  // Stores a plan the way createWithBracket does: teams only where the plan names them.
  const stored = (n: number, format: "single" | "double"): StoredMatch[] => {
    const byId = new Map(named(n).map((t) => [t.id, t]));
    const side = (s: { kind: string; teamId?: string }) => (s.kind === "team" ? byId.get(s.teamId!)! : null);
    return planBracket(named(n), format).map((p) => match({ bracketKey: p.key, team1: side(p.team1), team2: side(p.team2) }));
  };

  it.each(sizes)("recovers all %i teams, bye teams included, in single and double elimination", (n) => {
    for (const format of ["single", "double"] as const) {
      const { teams, matchData } = toBracketView(stored(n, format));
      expect(teams.map((t) => t.id).sort()).toEqual(named(n).map((t) => t.id).sort());
      expect(matchData).toHaveLength(planBracket(named(n), format).length);
    }
  });
});
