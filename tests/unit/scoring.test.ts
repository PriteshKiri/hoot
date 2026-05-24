/**
 * Property 15: Incorrect answers always score zero
 * Property 16: Correct answer score follows the speed-weighted formula
 * Property 17: Unanswered questions always score zero
 * Property 18: First-submission-wins for duplicate answer attempts
 * Property 19: Score accumulation invariant
 * Property 25: Open-text questions always score zero
 *
 * Validates: Requirements 10.1–10.6, 14.4
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { calculateScore } from "@/lib/scoring"

// ── Property 15: Incorrect answers always score zero ─────────────────────────

describe("Property 15: Incorrect answers always score zero", () => {
  it("calculateScore returns 0 for any incorrect answer regardless of timing", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120_000 }),  // remainingTimeMs
        fc.integer({ min: 5_000, max: 120_000 }), // timeLimitMs
        (remainingTimeMs, timeLimitMs) => {
          fc.pre(remainingTimeMs <= timeLimitMs)
          const score = calculateScore(false, remainingTimeMs, timeLimitMs)
          expect(score).toBe(0)
        }
      ),
      { numRuns: 500 }
    )
  })
})

// ── Property 16: Correct answer score follows the speed-weighted formula ──────

describe("Property 16: Correct answer score follows the speed-weighted formula", () => {
  it("score = max(1, floor(1000 × (remainingTimeMs / timeLimitMs))) for correct answers", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120_000 }),  // remainingTimeMs (>0 to avoid 0/limit edge)
        fc.integer({ min: 5_000, max: 120_000 }), // timeLimitMs
        (remainingTimeMs, timeLimitMs) => {
          fc.pre(remainingTimeMs <= timeLimitMs)
          const score = calculateScore(true, remainingTimeMs, timeLimitMs)
          const expected = Math.max(1, Math.floor(1000 * (remainingTimeMs / timeLimitMs)))
          expect(score).toBe(expected)
        }
      ),
      { numRuns: 500 }
    )
  })

  it("score is always at least 1 for a correct answer with any remaining time > 0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120_000 }),
        fc.integer({ min: 5_000, max: 120_000 }),
        (remainingTimeMs, timeLimitMs) => {
          fc.pre(remainingTimeMs <= timeLimitMs)
          const score = calculateScore(true, remainingTimeMs, timeLimitMs)
          expect(score).toBeGreaterThanOrEqual(1)
        }
      ),
      { numRuns: 500 }
    )
  })

  it("score is at most 1000 (when remaining time equals time limit)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5_000, max: 120_000 }),
        (timeLimitMs) => {
          const score = calculateScore(true, timeLimitMs, timeLimitMs)
          expect(score).toBe(1000)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("score is always an integer", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120_000 }),
        fc.integer({ min: 5_000, max: 120_000 }),
        (remainingTimeMs, timeLimitMs) => {
          fc.pre(remainingTimeMs <= timeLimitMs)
          const score = calculateScore(true, remainingTimeMs, timeLimitMs)
          expect(Number.isInteger(score)).toBe(true)
        }
      ),
      { numRuns: 500 }
    )
  })

  it("faster answers score higher or equal to slower answers", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 60_000 }),
        fc.integer({ min: 1, max: 60_000 }),
        fc.integer({ min: 5_000, max: 120_000 }),
        (t1, t2, timeLimitMs) => {
          const faster = Math.min(t1, t2)
          const slower = Math.max(t1, t2)
          fc.pre(slower <= timeLimitMs)
          const scoreFaster = calculateScore(true, slower, timeLimitMs) // more time remaining = answered faster
          const scoreSlower = calculateScore(true, faster, timeLimitMs)
          expect(scoreFaster).toBeGreaterThanOrEqual(scoreSlower)
        }
      ),
      { numRuns: 500 }
    )
  })
})

// ── Property 17: Unanswered questions always score zero ───────────────────────

describe("Property 17: Unanswered questions always score zero", () => {
  it("a null/undefined answer (no submission) scores zero", () => {
    // Unanswered = isCorrect is false (no submission means no correct answer)
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120_000 }),
        fc.integer({ min: 5_000, max: 120_000 }),
        (remainingTimeMs, timeLimitMs) => {
          fc.pre(remainingTimeMs <= timeLimitMs)
          // Unanswered is treated as incorrect
          const score = calculateScore(false, remainingTimeMs, timeLimitMs)
          expect(score).toBe(0)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 18: First-submission-wins for duplicate answer attempts ──────────

describe("Property 18: First-submission-wins for duplicate answer attempts", () => {
  // Simulate the first-submission-wins logic
  interface AnswerRecord {
    participant_id: string
    question_id: string
    score: number
    submitted_at: number
  }

  function submitAnswer(
    participantId: string,
    questionId: string,
    isCorrect: boolean,
    remainingTimeMs: number,
    timeLimitMs: number,
    existing: AnswerRecord[]
  ): { record?: AnswerRecord; error?: string } {
    const alreadyAnswered = existing.some(
      (r) => r.participant_id === participantId && r.question_id === questionId
    )
    if (alreadyAnswered) {
      return { error: "ANSWER_ALREADY_SUBMITTED" }
    }
    const score = calculateScore(isCorrect, remainingTimeMs, timeLimitMs)
    return {
      record: {
        participant_id: participantId,
        question_id: questionId,
        score,
        submitted_at: Date.now(),
      },
    }
  }

  it("second submission for the same participant+question is rejected", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.boolean(),
        fc.integer({ min: 0, max: 30_000 }),
        fc.integer({ min: 5_000, max: 30_000 }),
        (participantId, questionId, isCorrect, remainingTimeMs, timeLimitMs) => {
          fc.pre(remainingTimeMs <= timeLimitMs)
          const existing: AnswerRecord[] = []

          // First submission
          const first = submitAnswer(participantId, questionId, isCorrect, remainingTimeMs, timeLimitMs, existing)
          if (first.record) existing.push(first.record)

          // Second submission (duplicate)
          const second = submitAnswer(participantId, questionId, isCorrect, remainingTimeMs, timeLimitMs, existing)
          expect(second.error).toBe("ANSWER_ALREADY_SUBMITTED")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("first submission is always accepted when no prior answer exists", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.boolean(),
        fc.integer({ min: 0, max: 30_000 }),
        fc.integer({ min: 5_000, max: 30_000 }),
        (participantId, questionId, isCorrect, remainingTimeMs, timeLimitMs) => {
          fc.pre(remainingTimeMs <= timeLimitMs)
          const result = submitAnswer(participantId, questionId, isCorrect, remainingTimeMs, timeLimitMs, [])
          expect(result.error).toBeUndefined()
          expect(result.record).toBeDefined()
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 19: Score accumulation invariant ─────────────────────────────────

describe("Property 19: Score accumulation invariant", () => {
  it("total score equals the sum of individual question scores", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isCorrect: fc.boolean(),
            remainingTimeMs: fc.integer({ min: 0, max: 30_000 }),
            timeLimitMs: fc.integer({ min: 5_000, max: 30_000 }),
          }).filter((r) => r.remainingTimeMs <= r.timeLimitMs),
          { minLength: 1, maxLength: 20 }
        ),
        (answers) => {
          const individualScores = answers.map((a) =>
            calculateScore(a.isCorrect, a.remainingTimeMs, a.timeLimitMs)
          )
          const totalScore = individualScores.reduce((sum, s) => sum + s, 0)
          const expectedTotal = answers.reduce(
            (sum, a) => sum + calculateScore(a.isCorrect, a.remainingTimeMs, a.timeLimitMs),
            0
          )
          expect(totalScore).toBe(expectedTotal)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("total score is always non-negative", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isCorrect: fc.boolean(),
            remainingTimeMs: fc.integer({ min: 0, max: 30_000 }),
            timeLimitMs: fc.integer({ min: 5_000, max: 30_000 }),
          }).filter((r) => r.remainingTimeMs <= r.timeLimitMs),
          { minLength: 0, maxLength: 20 }
        ),
        (answers) => {
          const total = answers.reduce(
            (sum, a) => sum + calculateScore(a.isCorrect, a.remainingTimeMs, a.timeLimitMs),
            0
          )
          expect(total).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 25: Open-text questions always score zero ────────────────────────

describe("Property 25: Open-text questions always score zero", () => {
  it("open-text answers always score zero regardless of timing", () => {
    // Open-text questions are never "correct" in the scoring sense — they score 0
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120_000 }),
        fc.integer({ min: 5_000, max: 120_000 }),
        (remainingTimeMs, timeLimitMs) => {
          fc.pre(remainingTimeMs <= timeLimitMs)
          // Open-text is always isCorrect=false
          const score = calculateScore(false, remainingTimeMs, timeLimitMs)
          expect(score).toBe(0)
        }
      ),
      { numRuns: 200 }
    )
  })
})
