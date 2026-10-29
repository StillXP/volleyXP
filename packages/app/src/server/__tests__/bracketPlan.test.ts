import { describe, expect, it } from "vitest";
import { planBracket, type PlannedMatch } from "../bracketPlan";

const teams = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}`, seed: i + 1 }));
const sizes = Array.from({ length: 31 }, (_, i) => i + 2); // 2..32
const byKey = (plan: PlannedMatch[]) => new Map(plan.map((m) => [m.key, m]));

describe.each(["single", "double"] as const)("planBracket (%s elimination)", (format) => {
  it.each(sizes)("places every team exactly once, with %i teams", (n) => {
    const plan = planBracket(teams(n), format);
    const placed = plan.flatMap((m) => [m.team1, m.team2]).flatMap((s) => (s.kind === "team" ? [s.teamId] : []));
    expect(placed.sort()).toEqual(teams(n).map((t) => t.id).sort());
  });

  it.each(sizes)("gives every match two real sources and unique keys, with %i teams", (n) => {
    const plan = planBracket(teams(n), format);
    expect(new Set(plan.map((m) => m.key)).size).toBe(plan.length);
    const keys = byKey(plan);
    for (const m of plan) {
      for (const source of [m.team1, m.team2]) {
        if (source.kind !== "team") expect(keys.has(source.matchKey)).toBe(true);
      }
    }
  });

  it.each(sizes)("feeds each slot from one place and links both ways, with %i teams", (n) => {
    const plan = planBracket(teams(n), format);
    const keys = byKey(plan);
    const claimed = new Set<string>();
    for (const m of plan) {
      ([m.team1, m.team2] as const).forEach((source, i) => {
        if (source.kind === "team") return;
        const feeder = keys.get(source.matchKey)!;
        const link = source.kind === "winner" ? feeder.winnerTo : feeder.loserTo;
        expect(link).toEqual({ matchKey: m.key, slot: i + 1 });
        const id = `${source.kind}:${source.matchKey}`;
        expect(claimed.has(id)).toBe(false); // a result feeds one slot only
        claimed.add(id);
      });
    }
    // Every link points back at a slot that names this match as its source.
    for (const m of plan) {
      for (const [kind, link] of [["winner", m.winnerTo], ["loser", m.loserTo]] as const) {
        if (!link) continue;
        const target = keys.get(link.matchKey)!;
        expect(link.slot === 1 ? target.team1 : target.team2).toEqual({ kind, matchKey: m.key });
      }
    }
  });

  it.each(sizes)("has no cycles, with %i teams", (n) => {
    const plan = planBracket(teams(n), format);
    const keys = byKey(plan);
    const state = new Map<string, "visiting" | "done">();
    const visit = (key: string) => {
      if (state.get(key) === "done") return;
      expect(state.get(key)).not.toBe("visiting");
      state.set(key, "visiting");
      const m = keys.get(key)!;
      for (const s of [m.team1, m.team2]) if (s.kind !== "team") visit(s.matchKey);
      state.set(key, "done");
    };
    plan.forEach((m) => visit(m.key));
  });
});

describe("planBracket: single elimination", () => {
  it.each(sizes)("plays n - 1 matches and ends in one final, with %i teams", (n) => {
    const plan = planBracket(teams(n), "single");
    expect(plan).toHaveLength(n - 1);
    expect(plan.filter((m) => !m.winnerTo)).toHaveLength(1);
    expect(plan.every((m) => !m.loserTo)).toBe(true);
  });

  it("pairs an 8-team bracket by standard seeding and sends winners to the right slots", () => {
    const plan = planBracket(teams(8), "single");
    const first = plan.filter((m) => m.key.startsWith("r1-"));
    expect(first.map((m) => [m.team1, m.team2].map((s) => (s.kind === "team" ? s.teamId : "?")))).toEqual([
      ["t1", "t8"],
      ["t4", "t5"],
      ["t2", "t7"],
      ["t3", "t6"],
    ]);
    expect(first.map((m) => m.bracketRound)).toEqual(Array(4).fill("Quarterfinal"));
    expect(first.map((m) => m.winnerTo)).toEqual([
      { matchKey: "r2-m1", slot: 1 },
      { matchKey: "r2-m1", slot: 2 },
      { matchKey: "r2-m2", slot: 1 },
      { matchKey: "r2-m2", slot: 2 },
    ]);
  });

  it("puts byes straight into round 2 for 7 teams, so seed 1 skips round 1", () => {
    const plan = planBracket(teams(7), "single");
    expect(plan.some((m) => m.key === "r1-m1")).toBe(false); // seed 1 vs bye is never stored
    const semi = plan.find((m) => m.key === "r2-m1")!;
    expect(semi.team1).toEqual({ kind: "team", teamId: "t1" });
    expect(semi.team2).toEqual({ kind: "winner", matchKey: "r1-m2" });
  });

  it("is a single final for 2 teams", () => {
    const plan = planBracket(teams(2), "single");
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ key: "r1-m1", bracketRound: "Final", bracketPosition: 0 });
  });
});

describe("planBracket: double elimination", () => {
  it.each(sizes.filter((n) => n >= 3))("plays 2n - 2 matches and ends in one grand final, with %i teams", (n) => {
    const plan = planBracket(teams(n), "double");
    expect(plan).toHaveLength(2 * n - 2);
    expect(plan.filter((m) => !m.winnerTo).map((m) => m.key)).toEqual(["gf-m1"]);
  });

  it.each(sizes.filter((n) => n >= 3))("gives every winners-bracket loser somewhere to go, with %i teams", (n) => {
    const plan = planBracket(teams(n), "double");
    for (const m of plan.filter((p) => /^r\d+-m\d+$/.test(p.key))) expect(m.loserTo).toBeDefined();
    for (const m of plan.filter((p) => !/^r\d+-m\d+$/.test(p.key))) expect(m.loserTo).toBeUndefined();
  });

  it("drops the winners final's loser into the losers final, and both finalists into the grand final", () => {
    const plan = byKey(planBracket(teams(8), "double"));
    expect(plan.get("r3-m1")!.loserTo).toEqual({ matchKey: "lb-r4-m1", slot: 2 });
    expect(plan.get("r3-m1")!.winnerTo).toEqual({ matchKey: "gf-m1", slot: 1 });
    expect(plan.get("lb-r4-m1")!.winnerTo).toEqual({ matchKey: "gf-m1", slot: 2 });
  });

  it("labels rounds for the two brackets", () => {
    const rounds = new Set(planBracket(teams(8), "double").map((m) => m.bracketRound));
    expect(rounds).toEqual(
      new Set(["Winners Quarterfinal", "Winners Semifinal", "Winners Final", "Losers Round 1", "Losers Round 2", "Losers Semifinal", "Losers Final", "Grand Final"])
    );
  });

  it("sends a 3-team bracket's first loser straight to the next losers round", () => {
    const plan = byKey(planBracket(teams(3), "double"));
    // 2v3 is the only first-round match; its loser meets the winners final's loser.
    expect(plan.get("r1-m2")!.loserTo).toBeDefined();
    const target = plan.get(plan.get("r1-m2")!.loserTo!.matchKey)!;
    expect([target.team1, target.team2]).toContainEqual({ kind: "loser", matchKey: "r2-m1" });
  });

  it("is a lone final for 2 teams", () => {
    const plan = planBracket(teams(2), "double");
    expect(plan.map((m) => m.key)).toEqual(["r1-m1"]);
    expect(plan[0]!.winnerTo).toBeUndefined();
  });
});
