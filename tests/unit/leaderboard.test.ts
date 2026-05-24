/**
 * Property 20: Leaderboard ordering by score then name
 *
 * Validates: Requirements 11.3, 11.5
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: string
  display_name: string
  total_score: number
}

interface LeaderboardEntry extends Participant {
  rank: number
  scoreDelta: number
}

// ── Pure leaderboard computation (mirrors advance route logic) ────────────────

function computeLeaderboard(
  participants: Participant[],
  previousScores: Map<string, number> = new Map()
): LeaderboardEntry[] {
  const sorted = [...participants].sort((a, b) => {
    if (b.total_score !== a.total_score) {
      return b.total_score - a.total_score // descending score
    }
    return a.display_name.localeCompare(b.display_name) // ascending name (tie-break)
  })

  return sorted.map((p, index) => ({
    ...p,
    rank: index + 1,
    scoreDelta: p.total_score - (previousScores.get(p.id) ?? 0),
  }))
}

// ── Property 20: Leaderboard ordering ────────────────────────────────────────

describe("Property 20: Leaderboard ordering by score then name", () => {
  const participantArbitrary = fc.record({
    id: fc.uuid(),
    display_name: fc.string({ minLength: 1, maxLength: 30 }).map((s) => s.replace(/\s/g, "a") || "a"),
    total_score: fc.integer({ min: 0, max: 20_000 }),
  })

  it("leaderboard is sorted by total_score descending", () => {
    fc.assert(
      fc.property(
        fc.array(participantArbitrary, { minLength: 1, maxLength: 50 }),
        (participants) => {
          const leaderboard = computeLeaderboard(participants)
          for (let i = 0; i < leaderboard.length - 1; i++) {
            expect(leaderboard[i].total_score).toBeGreaterThanOrEqual(leaderboard[i + 1].total_score)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("ties are broken by display_name ascending (alphabetical)", () => {
    fc.assert(
      fc.property(
        fc.array(participantArbitrary, { minLength: 2, maxLength: 50 }),
        (participants) => {
          const leaderboard = computeLeaderboard(participants)
          for (let i = 0; i < leaderboard.length - 1; i++) {
            const curr = leaderboard[i]
            const next = leaderboard[i + 1]
            if (curr.total_score === next.total_score) {
              expect(curr.display_name.localeCompare(next.display_name)).toBeLessThanOrEqual(0)
            }
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("ranks are assigned 1-based and sequential", () => {
    fc.assert(
      fc.property(
        fc.array(participantArbitrary, { minLength: 1, maxLength: 50 }),
        (participants) => {
          const leaderboard = computeLeaderboard(participants)
          leaderboard.forEach((entry, index) => {
            expect(entry.rank).toBe(index + 1)
          })
        }
      ),
      { numRuns: 200 }
    )
  })

  it("leaderboard contains all participants (no loss or duplication)", () => {
    fc.assert(
      fc.property(
        fc.array(participantArbitrary, { minLength: 0, maxLength: 50 }),
        (participants) => {
          const leaderboard = computeLeaderboard(participants)
          expect(leaderboard.length).toBe(participants.length)
          const originalIds = new Set(participants.map((p) => p.id))
          const leaderboardIds = new Set(leaderboard.map((e) => e.id))
          expect(leaderboardIds.size).toBe(originalIds.size)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("scoreDelta is correctly computed as current score minus previous score", () => {
    fc.assert(
      fc.property(
        fc.array(participantArbitrary, { minLength: 1, maxLength: 20 }),
        fc.array(fc.integer({ min: 0, max: 5_000 }), { minLength: 1, maxLength: 20 }),
        (participants, prevScoreValues) => {
          const previousScores = new Map<string, number>()
          participants.forEach((p, i) => {
            previousScores.set(p.id, prevScoreValues[i % prevScoreValues.length])
          })

          const leaderboard = computeLeaderboard(participants, previousScores)
          leaderboard.forEach((entry) => {
            const prev = previousScores.get(entry.id) ?? 0
            expect(entry.scoreDelta).toBe(entry.total_score - prev)
          })
        }
      ),
      { numRuns: 200 }
    )
  })

  it("participant with highest score is always ranked 1st", () => {
    fc.assert(
      fc.property(
        fc.array(participantArbitrary, { minLength: 1, maxLength: 50 }),
        (participants) => {
          const maxScore = Math.max(...participants.map((p) => p.total_score))
          const leaderboard = computeLeaderboard(participants)
          expect(leaderboard[0].total_score).toBe(maxScore)
        }
      ),
      { numRuns: 200 }
    )
  })
})
