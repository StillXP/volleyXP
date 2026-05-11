import { type NextRequest, NextResponse } from 'next/server'
import type { BracketTeam, BracketMatchData, BracketMatchScore } from '@design-system/components'

// ─── Constants ────────────────────────────────────────────────────────────────

const LAST_NAMES = [
  'Anderson', 'Bailey', 'Chen', 'Davis', 'Evans', 'Foster', 'Garcia', 'Harris',
  'Ingram', 'Jones', 'Kim', 'Lopez', 'Martin', 'Nelson', 'Okafor', 'Patel',
  'Quinn', 'Roberts', 'Santos', 'Taylor', 'Upton', 'Vega', 'Wilson', 'Xavier',
  'Young', 'Zhang', 'Brooks', 'Campbell', 'Dixon', 'Edwards', 'Fleming', 'Gomez',
  'Hayes', 'Iyer', 'Jensen', 'Knight', 'Lewis', 'Murphy', 'Nash', 'Owens',
  'Porter', 'Reid', 'Shaw', 'Turner', 'Underwood', 'Vargas', 'Walker', 'Yates',
  'Avery', 'Blake', 'Cruz', 'Dunn', 'Ellis', 'Flynn', 'Grant', 'Hart',
  'Irwin', 'James', 'Knox', 'Lane', 'Mills', 'Norman', 'Ortiz', 'Park',
  'Abbas', 'Bauer', 'Carvalho', 'Delgado', 'Espinoza', 'Ferreira', 'Gupta', 'Hernandez',
  'Ibrahim', 'Johansson', 'Kaur', 'Lindqvist', 'Moreau', 'Nguyen', 'Osei', 'Petrov',
  'Quiroga', 'Russo', 'Silva', 'Tanaka', 'Ullah', 'Vasquez', 'Watanabe', 'Xu',
  'Yamamoto', 'Zhu', 'Adeyemi', 'Bergman', 'Castillo', 'Dubois', 'Elias', 'Fahim',
  'Guerrero', 'Hakobyan', 'Ismail', 'Joao', 'Kovacs', 'Larsson', 'Mendez', 'Nkosi',
  'Ochoa', 'Padilla', 'Qureshi', 'Reyes', 'Sousa', 'Tran', 'Uzun', 'Vieira',
  'Wong', 'Yilmaz', 'Zamora', 'Abebe', 'Brandt', 'Choudhury', 'Das', 'Eriksson',
  'Fonseca', 'Gomes', 'Haugen', 'Ito', 'Jain', 'Kuznetsov', 'Lima', 'Madsen',
]

const COURTS = ['Court 1', 'Court 2', 'Court 3', 'Court 4']
const TIMES = ['9:00 AM', '10:30 AM', '12:00 PM', '1:30 PM', '3:00 PM', '4:30 PM']
const STREAM_BASE = 'https://stream.volley.tv'

// ─── Bracket helpers ──────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function getSeedOrder(n: number): number[] {
  if (n === 1) return [1]
  const prev = getSeedOrder(n / 2)
  const result: number[] = []
  for (const s of prev) {
    result.push(s)
    result.push(n + 1 - s)
  }
  return result
}

// Lower seed wins most of the time; upset probability shrinks as seed gap widens.
function pickWinner(s1: number, s2: number): number {
  const diff = Math.abs(s1 - s2)
  const upsetProb = Math.max(0.08, 0.35 - diff * 0.03)
  const [fav, dog] = s1 < s2 ? [s1, s2] : [s2, s1]
  return Math.random() < upsetProb ? dog : fav
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchSimResult {
  team1Seed: number
  team2Seed: number
  winnerSeed: number
  loserSeed: number
}

// ─── Simulators ───────────────────────────────────────────────────────────────

function simulateSingleElim(teamCount: number): {
  simResults: Map<string, MatchSimResult>
  numRounds: number
  slots: number
} {
  const slots = nextPowerOf2(teamCount)
  const numRounds = Math.log2(slots)
  const seedOrder = getSeedOrder(slots)
  const simResults = new Map<string, MatchSimResult>()

  let advancing: Array<number | null> = seedOrder.map(s => (s <= teamCount ? s : null))

  for (let r = 0; r < numRounds; r++) {
    const next: Array<number | null> = []
    for (let i = 0; i < advancing.length; i += 2) {
      const s1 = advancing[i]
      const s2 = advancing[i + 1]
      const matchId = `r${r + 1}-m${i / 2 + 1}`
      if (s1 !== null && s2 !== null) {
        const winnerSeed = pickWinner(s1, s2)
        simResults.set(matchId, { team1Seed: s1, team2Seed: s2, winnerSeed, loserSeed: s1 === winnerSeed ? s2 : s1 })
        next.push(winnerSeed)
      } else {
        next.push(s1 ?? s2) // bye — no result entry
      }
    }
    advancing = next
  }

  return { simResults, numRounds, slots }
}

function simulateDoubleElim(teamCount: number): {
  simResults: Map<string, MatchSimResult>
  numWBRounds: number
  totalLBRounds: number
  slots: number
} {
  const slots = nextPowerOf2(teamCount)
  const numWBRounds = Math.log2(slots)
  const totalLBRounds = 2 * (numWBRounds - 1)
  const simResults = new Map<string, MatchSimResult>()

  // WB: simulate and collect per-round losers for LB drop-ins
  let wbAdvancing: Array<number | null> = getSeedOrder(slots).map(s => (s <= teamCount ? s : null))
  const wbLosersPerRound: Array<Array<number | null>> = []

  for (let r = 0; r < numWBRounds; r++) {
    const next: Array<number | null> = []
    const roundLosers: Array<number | null> = []
    for (let i = 0; i < wbAdvancing.length; i += 2) {
      const s1 = wbAdvancing[i]
      const s2 = wbAdvancing[i + 1]
      const matchId = `r${r + 1}-m${i / 2 + 1}`
      if (s1 !== null && s2 !== null) {
        const winnerSeed = pickWinner(s1, s2)
        const loserSeed = s1 === winnerSeed ? s2 : s1
        simResults.set(matchId, { team1Seed: s1, team2Seed: s2, winnerSeed, loserSeed })
        next.push(winnerSeed)
        roundLosers.push(loserSeed)
      } else {
        next.push(s1 ?? s2)
        roundLosers.push(null)
      }
    }
    wbAdvancing = next
    wbLosersPerRound.push(roundLosers)
  }

  // LB: mirrors the bracket component's pairing logic
  let lbAdvancing: Array<number | null> = []

  for (let lbR = 0; lbR < totalLBRounds; lbR++) {
    const lbRoundNum = lbR + 1
    const matchPairs: Array<[number | null, number | null]> = []

    if (lbRoundNum === 1) {
      const r1Losers = wbLosersPerRound[0]
      for (let i = 0; i < r1Losers.length; i += 2) {
        matchPairs.push([r1Losers[i] ?? null, r1Losers[i + 1] ?? null])
      }
    } else if (lbRoundNum % 2 === 0) {
      // Even: LB survivor vs WB round loser (wbLosersPerRound is 0-indexed)
      const wbDropLosers = wbLosersPerRound[lbRoundNum / 2] ?? []
      for (let i = 0; i < lbAdvancing.length; i++) {
        matchPairs.push([lbAdvancing[i] ?? null, wbDropLosers[i] ?? null])
      }
    } else {
      // Odd > 1: LB survivors play each other
      for (let i = 0; i < lbAdvancing.length; i += 2) {
        matchPairs.push([lbAdvancing[i] ?? null, lbAdvancing[i + 1] ?? null])
      }
    }

    const nextLB: Array<number | null> = []
    matchPairs.forEach(([s1, s2], i) => {
      const matchId = `lb-r${lbRoundNum}-m${i + 1}`
      if (s1 !== null && s2 !== null) {
        const winnerSeed = pickWinner(s1, s2)
        simResults.set(matchId, { team1Seed: s1, team2Seed: s2, winnerSeed, loserSeed: s1 === winnerSeed ? s2 : s1 })
        nextLB.push(winnerSeed)
      } else {
        nextLB.push(s1 ?? s2)
      }
    })
    lbAdvancing = nextLB
  }

  // Grand Final
  const gfS1 = wbAdvancing[0]
  const gfS2 = lbAdvancing[0]
  if (gfS1 !== null && gfS2 !== null) {
    const winnerSeed = pickWinner(gfS1, gfS2)
    simResults.set('gf-m1', { team1Seed: gfS1, team2Seed: gfS2, winnerSeed, loserSeed: gfS1 === winnerSeed ? gfS2 : gfS1 })
  }

  return { simResults, numWBRounds, totalLBRounds, slots }
}

// ─── Match data builders ──────────────────────────────────────────────────────

function buildCompleted(matchId: string, sim: MatchSimResult, matchFormat: 3 | 5, matchIndex: number): BracketMatchData {
  const scores = generateCompletedScores(matchFormat)
  const t1Wins = sim.team1Seed === sim.winnerSeed
  const hasReplay = Math.random() < 0.65
  return {
    matchId,
    status: 'completed',
    winnerId: `team-${sim.winnerSeed}`,
    team1Score: t1Wins ? scores.winner : scores.loser,
    team2Score: t1Wins ? scores.loser : scores.winner,
    location: COURTS[(matchIndex - 1) % COURTS.length],
    ...(hasReplay && { videoUrl: `${STREAM_BASE}/replay/${matchId}` }),
  }
}

function buildLive(matchId: string): BracketMatchData {
  const { team1Score, team2Score } = generateLiveScores()
  return {
    matchId,
    status: 'live',
    team1Score,
    team2Score,
    location: COURTS[0],
    videoUrl: `${STREAM_BASE}/live/${matchId}`,
  }
}

function buildUpcoming(matchId: string, matchIndex: number): BracketMatchData {
  return {
    matchId,
    status: 'upcoming',
    location: COURTS[(matchIndex - 1) % COURTS.length],
    startTime: TIMES[(matchIndex - 1) % TIMES.length],
  }
}

// ─── Score generation ─────────────────────────────────────────────────────────

function generateCompletedScores(matchFormat: 3 | 5): { winner: BracketMatchScore; loser: BracketMatchScore } {
  const setsToWin = Math.ceil(matchFormat / 2)
  const loserSets = randomInt(0, setsToWin - 1)
  const totalSets = setsToWin + loserSets

  // Build non-clinching sets (all but the last), then always append the
  // clinching set at the end — prevents impossible orderings like W-W-L in a 2-1.
  const nonFinal: boolean[] = [
    ...Array(setsToWin - 1).fill(true),
    ...Array(loserSets).fill(false),
  ]
  for (let i = nonFinal.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[nonFinal[i], nonFinal[j]] = [nonFinal[j], nonFinal[i]]
  }
  const setResults = [...nonFinal, true] // clinching set is always last

  const winnerScores: number[] = []
  const loserScores: number[] = []

  for (let i = 0; i < totalSets; i++) {
    const isTiebreaker = i === totalSets - 1 && totalSets === matchFormat
    const winScore = isTiebreaker ? 15 : 21
    const loseScore = isTiebreaker ? randomInt(0, 13) : randomInt(10, 19)

    if (setResults[i]) {
      winnerScores.push(winScore)
      loserScores.push(loseScore)
    } else {
      winnerScores.push(loseScore)
      loserScores.push(winScore)
    }
  }

  return {
    winner: { setScores: winnerScores, totalSets: setsToWin },
    loser: { setScores: loserScores, totalSets: loserSets },
  }
}

function generateLiveScores(): { team1Score: BracketMatchScore; team2Score: BracketMatchScore } {
  return {
    team1Score: { setScores: [21, randomInt(10, 19)], totalSets: 1 },
    team2Score: { setScores: [randomInt(10, 19), 21], totalSets: 1 },
  }
}

// ─── Match data generators ────────────────────────────────────────────────────

// Number of matches in a given LB round for a bracket of `slots` teams.
// Even rounds maintain the same count; odd rounds halve it.
function lbMatchCount(lbRound: number, slots: number): number {
  return Math.max(1, (slots / 4) / Math.pow(2, Math.floor((lbRound - 1) / 2)))
}

function generateSingleElimMatchData(teamCount: number, matchFormat: 3 | 5): BracketMatchData[] {
  const { simResults, numRounds, slots } = simulateSingleElim(teamCount)

  // Pick how many rounds are fully completed (numRounds = tournament over)
  const completedRounds = randomInt(1, numRounds)
  const matchData: BracketMatchData[] = []

  for (let r = 1; r <= numRounds; r++) {
    const count = slots / Math.pow(2, r)
    const isCurrent = r === completedRounds + 1
    const liveCount = isCurrent ? randomInt(1, Math.min(count, COURTS.length)) : 0
    for (let m = 1; m <= count; m++) {
      const matchId = `r${r}-m${m}`
      const sim = simResults.get(matchId)
      if (!sim) continue // bye match

      if (r <= completedRounds) {
        matchData.push(buildCompleted(matchId, sim, matchFormat, m))
      } else if (isCurrent) {
        matchData.push(m <= liveCount ? buildLive(matchId) : buildUpcoming(matchId, m))
      }
      // Future rounds: no entry — bracket defaults to upcoming
    }
  }

  return matchData
}

function generateDoubleElimMatchData(teamCount: number, matchFormat: 3 | 5): BracketMatchData[] {
  const { simResults, numWBRounds, totalLBRounds, slots } = simulateDoubleElim(teamCount)

  // Stage: 1..numWBRounds (all WB + all LB done) + 1 extra for GF completed
  const stage = randomInt(1, numWBRounds + 1)
  const completedWBRounds = Math.min(stage, numWBRounds)
  const gfCompleted = stage > numWBRounds
  const allWBDone = completedWBRounds === numWBRounds

  // LB completes at a rate of 2*(completedWBRounds-1)+1 rounds
  const completedLBRounds = Math.min(2 * completedWBRounds - 1, totalLBRounds)
  const allLBDone = completedLBRounds === totalLBRounds

  const matchData: BracketMatchData[] = []

  // WB rounds
  for (let r = 1; r <= numWBRounds; r++) {
    const count = slots / Math.pow(2, r)
    const isCurrent = r === completedWBRounds + 1 && !allWBDone
    const liveCount = isCurrent ? randomInt(1, Math.min(count, COURTS.length)) : 0
    for (let m = 1; m <= count; m++) {
      const matchId = `r${r}-m${m}`
      const sim = simResults.get(matchId)
      if (!sim) continue
      if (r <= completedWBRounds) matchData.push(buildCompleted(matchId, sim, matchFormat, m))
      else if (isCurrent) matchData.push(m <= liveCount ? buildLive(matchId) : buildUpcoming(matchId, m))
    }
  }

  // LB rounds
  for (let lbR = 1; lbR <= totalLBRounds; lbR++) {
    const count = lbMatchCount(lbR, slots)
    for (let m = 1; m <= count; m++) {
      const matchId = `lb-r${lbR}-m${m}`
      const sim = simResults.get(matchId)
      if (!sim) continue
      if (lbR <= completedLBRounds) matchData.push(buildCompleted(matchId, sim, matchFormat, m))
      // Current LB round is always an even (drop-in) round whose teams depend on the
      // current WB round's losers — unresolvable until WB finishes, so no entry here.
    }
  }

  // Grand Final
  const gfSim = simResults.get('gf-m1')
  if (gfSim) {
    if (gfCompleted) matchData.push(buildCompleted('gf-m1', gfSim, matchFormat, 1))
    else if (allWBDone && allLBDone) matchData.push(buildLive('gf-m1'))
  }

  return matchData
}

// ─── Team generation ──────────────────────────────────────────────────────────

function generateTeams(teamCount: number): BracketTeam[] {
  const pool = [...LAST_NAMES].sort(() => Math.random() - 0.5)
  return Array.from({ length: teamCount }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `${pool[i * 2]} / ${pool[i * 2 + 1]}`,
    seed: i + 1,
  }))
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const teamCount = Math.min(64, Math.max(2, parseInt(searchParams.get('teamCount') ?? '8', 10)))
  const elimFormat = searchParams.get('elimFormat') === 'double' ? 'double' : 'single'
  const matchFormat = searchParams.get('matchFormat') === '5' ? 5 : 3

  const teams = generateTeams(teamCount)
  const matchData =
    elimFormat === 'double'
      ? generateDoubleElimMatchData(teamCount, matchFormat as 3 | 5)
      : generateSingleElimMatchData(teamCount, matchFormat as 3 | 5)

  return NextResponse.json({ teams, matchData })
}
