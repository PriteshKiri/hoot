/**
 * Property 5: Multiple-choice option count is bounded to [2, 4]
 * Property 7: Question text length is bounded to [1, 255]
 * Property 8: Rating scale min/max validation
 * Property 24: Open-text response length is bounded to 200 characters
 *
 * Validates: Requirements 3.2, 3.7, 3.8, 14.5
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Pure validation helpers (mirrors the API route logic) ────────────────────

type QuestionType = "single_select" | "multi_select" | "open_text" | "rating_scale" | "image_choice"
const CHOICE_TYPES: QuestionType[] = ["single_select", "multi_select", "image_choice"]

interface AnswerOption {
  text?: string | null
  is_correct?: boolean
}

interface QuestionInput {
  question_type: QuestionType
  text: string
  time_limit?: number
  rating_min?: number | null
  rating_max?: number | null
  answer_options?: AnswerOption[]
}

function validateQuestion(input: QuestionInput): { valid: boolean; error?: string; field?: string } {
  // text validation
  if (!input.text || input.text.trim().length === 0) {
    return { valid: false, error: "Question text is required.", field: "text" }
  }
  if (input.text.trim().length > 255) {
    return { valid: false, error: "Question text must be 255 characters or fewer.", field: "text" }
  }

  // time_limit validation
  if (input.time_limit !== undefined && input.time_limit !== null) {
    if (!Number.isInteger(input.time_limit) || input.time_limit < 5 || input.time_limit > 120) {
      return { valid: false, error: "time_limit must be between 5 and 120 seconds.", field: "time_limit" }
    }
  }

  // rating_scale validation
  if (input.question_type === "rating_scale") {
    const min = input.rating_min
    const max = input.rating_max
    if (min === undefined || min === null) {
      return { valid: false, error: "rating_min is required.", field: "rating_min" }
    }
    if (max === undefined || max === null) {
      return { valid: false, error: "rating_max is required.", field: "rating_max" }
    }
    if (!Number.isInteger(min) || min < 1 || min > 10) {
      return { valid: false, error: "rating_min must be an integer between 1 and 10.", field: "rating_min" }
    }
    if (!Number.isInteger(max) || max < 1 || max > 10) {
      return { valid: false, error: "rating_max must be an integer between 1 and 10.", field: "rating_max" }
    }
    if (min >= max) {
      return { valid: false, error: "rating_min must be less than rating_max.", field: "rating_min" }
    }
  }

  // answer_options validation for choice types
  if (CHOICE_TYPES.includes(input.question_type)) {
    const opts = input.answer_options ?? []
    if (opts.length < 2 || opts.length > 4) {
      return { valid: false, error: "answer_options must have between 2 and 4 items.", field: "answer_options" }
    }
    if (input.question_type !== "image_choice") {
      const hasCorrect = opts.some((o) => o.is_correct === true)
      if (!hasCorrect) {
        return { valid: false, error: "At least one answer option must be marked as correct.", field: "answer_options" }
      }
    }
  }

  return { valid: true }
}

function validateOpenTextResponse(response: string): { valid: boolean; error?: string } {
  if (response.length > 200) {
    return { valid: false, error: "Open-text response must be 200 characters or fewer." }
  }
  return { valid: true }
}

// ── Property 5: Multiple-choice option count is bounded to [2, 4] ────────────

describe("Property 5: Multiple-choice option count is bounded to [2, 4]", () => {
  const choiceTypes: QuestionType[] = ["single_select", "multi_select", "image_choice"]

  it("accepts option counts of exactly 2, 3, or 4", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...choiceTypes),
        fc.integer({ min: 2, max: 4 }),
        (qType, count) => {
          const options: AnswerOption[] = Array.from({ length: count }, (_, i) => ({
            text: `Option ${i + 1}`,
            is_correct: i === 0, // first option is correct
          }))
          const result = validateQuestion({
            question_type: qType,
            text: "Valid question?",
            answer_options: options,
          })
          // Should not fail on option count
          expect(result.error ?? "").not.toContain("between 2 and 4")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("rejects option counts outside [2, 4]", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...choiceTypes),
        fc.oneof(fc.constant(0), fc.constant(1), fc.integer({ min: 5, max: 20 })),
        (qType, count) => {
          const options: AnswerOption[] = Array.from({ length: count }, (_, i) => ({
            text: `Option ${i + 1}`,
            is_correct: i === 0,
          }))
          const result = validateQuestion({
            question_type: qType,
            text: "Valid question?",
            answer_options: options,
          })
          expect(result.valid).toBe(false)
          expect(result.field).toBe("answer_options")
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 7: Question text length is bounded to [1, 255] ──────────────────

describe("Property 7: Question text length is bounded to [1, 255]", () => {
  it("accepts question text of length 1–255 after trimming", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
        (text) => {
          const result = validateQuestion({
            question_type: "open_text",
            text,
          })
          // Should not fail on text length
          expect(result.error ?? "").not.toContain("255 characters")
          expect(result.error ?? "").not.toContain("required")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("rejects question text longer than 255 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 256, maxLength: 600 }).map((s) => s.replace(/\s/g, "x")),
        (text) => {
          const result = validateQuestion({
            question_type: "open_text",
            text,
          })
          expect(result.valid).toBe(false)
          expect(result.field).toBe("text")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("rejects empty or whitespace-only question text", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(""),
          fc.stringOf(fc.constantFrom(" ", "\t", "\n"), { minLength: 1, maxLength: 20 })
        ),
        (text) => {
          const result = validateQuestion({
            question_type: "open_text",
            text,
          })
          expect(result.valid).toBe(false)
          expect(result.field).toBe("text")
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 8: Rating scale min/max validation ───────────────────────────────

describe("Property 8: Rating scale min/max validation", () => {
  it("accepts valid rating_min < rating_max both in [1, 10]", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.integer({ min: 1, max: 10 }),
        (min, maxOffset) => {
          const max = Math.min(10, min + maxOffset)
          fc.pre(min < max)
          const result = validateQuestion({
            question_type: "rating_scale",
            text: "Rate this",
            rating_min: min,
            rating_max: max,
          })
          expect(result.valid).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("rejects rating_min >= rating_max", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (a, b) => {
          const min = Math.max(a, b)
          const max = Math.min(a, b)
          fc.pre(min >= max) // min >= max (equal or inverted)
          const result = validateQuestion({
            question_type: "rating_scale",
            text: "Rate this",
            rating_min: min,
            rating_max: max,
          })
          expect(result.valid).toBe(false)
          expect(result.field).toBe("rating_min")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("rejects rating values outside [1, 10]", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -100, max: 0 }),
          fc.integer({ min: 11, max: 100 })
        ),
        (outOfRange) => {
          // Test with out-of-range min
          const result = validateQuestion({
            question_type: "rating_scale",
            text: "Rate this",
            rating_min: outOfRange,
            rating_max: 5,
          })
          expect(result.valid).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 24: Open-text response length is bounded to 200 characters ──────

describe("Property 24: Open-text response length is bounded to 200 characters", () => {
  it("accepts open-text responses up to 200 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (response) => {
          const result = validateOpenTextResponse(response)
          expect(result.valid).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("rejects open-text responses longer than 200 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 201, maxLength: 500 }),
        (response) => {
          const result = validateOpenTextResponse(response)
          expect(result.valid).toBe(false)
          expect(result.error).toContain("200 characters")
        }
      ),
      { numRuns: 200 }
    )
  })
})
