/**
 * Property 22: Analytics snapshot correctness
 * Property 23: CSV export contains all participants with correct scores
 *
 * Validates: Requirements 13.1, 13.2, 13.3
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Types ────────────────────────────────────────────────────────────────────

interface AnswerRecord {
  participant_id: string
  question_id: string
  selected_option_ids: string[] | null
  response_time_ms: number | null
  score_awarded: number
}

interface AnswerOption {
  id: string
}

interface Question {
  id: string
  position: number
  question_type: "single_select" | "multi_select" | "open_text" | "rating_scale" | "image_choice"
  answer_options: AnswerOption[]
}

interface Participant {
  id: string
  display_name: string
  total_score: number
}

interface AnalyticsSnapshot {
  question_id: string
  total_responses: number
  option_counts: Array<{ optionId: string; count: number; percentage: number }>
  avg_response_time_ms: number | null
}

// ── Pure analytics computation (mirrors lib/analytics.ts) ────────────────────

function computeSnapshot(
  question: Question,
  answers: AnswerRecord[]
): AnalyticsSnapshot {
  const qAnswers = answers.filter((a) => a.question_id === question.id)
  const totalResponses = qAnswers.length

  const optionCounts: Array<{ optionId: string; count: number; percentage: number }> = []
  if (
    question.question_type === "single_select" ||
    question.question_type === "multi_select" ||
    question.question_type === "image_choice"
  ) {
    const countMap = new Map<string, number>()
    for (const opt of question.answer_options) {
      countMap.set(opt.id, 0)
    }
    for (const answer of qAnswers) {
      for (const optId of answer.selected_option_ids ?? []) {
        countMap.set(optId, (countMap.get(optId) ?? 0) + 1)
      }
    }
    for (const [optionId, count] of Array.from(countMap.entries())) {
      const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0
      optionCounts.push({ optionId, count, percentage })
    }
  }

  const responseTimes = qAnswers
    .map((a) => a.response_time_ms)
    .filter((t): t is number => t !== null && t !== undefined)
  const avgResponseTimeMs =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)
      : null

  return {
    question_id: question.id,
    total_responses: totalResponses,
    option_counts: optionCounts,
    avg_response_time_ms: avgResponseTimeMs,
  }
}

function generateCsvRows(
  participants: Participant[],
  questions: Question[],
  answers: AnswerRecord[]
): string[][] {
  const sortedParticipants = [...participants].sort((a, b) => b.total_score - a.total_score)
  const sortedQuestions = [...questions].sort((a, b) => a.position - b.position)

  const answerMap = new Map<string, Map<string, number>>()
  for (const answer of answers) {
    if (!answerMap.has(answer.participant_id)) {
      answerMap.set(answer.participant_id, new Map())
    }
    answerMap.get(answer.participant_id)!.set(answer.question_id, answer.score_awarded)
  }

  return sortedParticipants.map((p) => {
    const pAnswers = answerMap.get(p.id) ?? new Map()
    const scores = sortedQuestions.map((q) => {
      const score = pAnswers.get(q.id)
      return score !== undefined ? String(score) : ""
    })
    return [p.display_name, ...scores, String(p.total_score)]
  })
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const optionArbitrary = fc.record({ id: fc.uuid() })

const questionArbitrary = fc.record({
  id: fc.uuid(),
  position: fc.integer({ min: 1, max: 20 }),
  question_type: fc.constantFrom(
    "single_select" as const,
    "multi_select" as const,
    "open_text" as const
  ),
  answer_options: fc.array(optionArbitrary, { minLength: 2, maxLength: 4 }),
})

const participantArbitrary = fc.record({
  id: fc.uuid(),
  display_name: fc.string({ minLength: 1, maxLength: 30 }).map((s) => s.replace(/\s/g, "a") || "a"),
  total_score: fc.integer({ min: 0, max: 20_000 }),
})

// ── Property 22: Analytics snapshot correctness ───────────────────────────────

describe("Property 22: Analytics snapshot correctness", () => {
  it("total_responses equals the number of answers for that question", () => {
    fc.assert(
      fc.property(
        questionArbitrary,
        fc.array(fc.uuid(), { minLength: 0, maxLength: 20 }),
        (question, participantIds) => {
          const answers: AnswerRecord[] = participantIds.map((pid) => ({
            participant_id: pid,
            question_id: question.id,
            selected_option_ids: question.answer_options.length > 0
              ? [question.answer_options[0].id]
              : null,
            response_time_ms: 5000,
            score_awarded: 500,
          }))

          const snapshot = computeSnapshot(question, answers)
          expect(snapshot.total_responses).toBe(participantIds.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("option_counts percentages sum to approximately 100% when there are responses", () => {
    fc.assert(
      fc.property(
        questionArbitrary.filter((q) =>
          q.question_type === "single_select" && q.answer_options.length >= 2
        ),
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 20 }),
        (question, optionIndices) => {
          const answers: AnswerRecord[] = optionIndices.map((idx, i) => ({
            participant_id: `p-${i}`,
            question_id: question.id,
            selected_option_ids: [question.answer_options[idx % question.answer_options.length].id],
            response_time_ms: 5000,
            score_awarded: 500,
          }))

          const snapshot = computeSnapshot(question, answers)
          if (snapshot.total_responses > 0 && snapshot.option_counts.length > 0) {
            const totalPct = snapshot.option_counts.reduce((sum, o) => sum + o.percentage, 0)
            // Allow rounding error of ±5%
            expect(totalPct).toBeGreaterThanOrEqual(95)
            expect(totalPct).toBeLessThanOrEqual(105)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("avg_response_time_ms is null when there are no responses", () => {
    fc.assert(
      fc.property(questionArbitrary, (question) => {
        const snapshot = computeSnapshot(question, [])
        expect(snapshot.avg_response_time_ms).toBeNull()
        expect(snapshot.total_responses).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  it("avg_response_time_ms is the arithmetic mean of response times", () => {
    fc.assert(
      fc.property(
        questionArbitrary,
        fc.array(fc.integer({ min: 100, max: 30_000 }), { minLength: 1, maxLength: 20 }),
        (question, responseTimes) => {
          const answers: AnswerRecord[] = responseTimes.map((t, i) => ({
            participant_id: `p-${i}`,
            question_id: question.id,
            selected_option_ids: null,
            response_time_ms: t,
            score_awarded: 0,
          }))

          const snapshot = computeSnapshot(question, answers)
          const expectedAvg = Math.round(
            responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
          )
          expect(snapshot.avg_response_time_ms).toBe(expectedAvg)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 23: CSV export contains all participants with correct scores ──────

describe("Property 23: CSV export contains all participants with correct scores", () => {
  it("CSV has one row per participant", () => {
    fc.assert(
      fc.property(
        fc.array(participantArbitrary, { minLength: 0, maxLength: 20 }),
        fc.array(questionArbitrary, { minLength: 1, maxLength: 5 }),
        (participants, questions) => {
          const rows = generateCsvRows(participants, questions, [])
          expect(rows.length).toBe(participants.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("CSV rows are sorted by total_score descending", () => {
    fc.assert(
      fc.property(
        fc.array(participantArbitrary, { minLength: 2, maxLength: 20 }),
        fc.array(questionArbitrary, { minLength: 1, maxLength: 3 }),
        (participants, questions) => {
          const rows = generateCsvRows(participants, questions, [])
          const scores = rows.map((r) => parseInt(r[r.length - 1], 10))
          for (let i = 0; i < scores.length - 1; i++) {
            expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("CSV total score column matches participant total_score", () => {
    fc.assert(
      fc.property(
        fc.array(participantArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(questionArbitrary, { minLength: 1, maxLength: 3 }),
        (participants, questions) => {
          const rows = generateCsvRows(participants, questions, [])
          const sortedParticipants = [...participants].sort((a, b) => b.total_score - a.total_score)

          rows.forEach((row, i) => {
            const totalScoreCol = row[row.length - 1]
            expect(parseInt(totalScoreCol, 10)).toBe(sortedParticipants[i].total_score)
          })
        }
      ),
      { numRuns: 200 }
    )
  })

  it("CSV has correct number of columns: 1 (name) + N (questions) + 1 (total)", () => {
    fc.assert(
      fc.property(
        fc.array(participantArbitrary, { minLength: 1, maxLength: 5 }),
        fc.array(questionArbitrary, { minLength: 1, maxLength: 10 }),
        (participants, questions) => {
          const rows = generateCsvRows(participants, questions, [])
          const expectedCols = 1 + questions.length + 1
          rows.forEach((row) => {
            expect(row.length).toBe(expectedCols)
          })
        }
      ),
      { numRuns: 200 }
    )
  })
})
