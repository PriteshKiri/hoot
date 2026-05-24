/**
 * Property 1: Event title validation is length-bounded
 *
 * The event creation route enforces:
 *   - title must be a non-empty string
 *   - title.trim().length must be in [1, 100]
 *
 * Validates: Requirements 2.1
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// Pure validation logic extracted from the API route for unit testing
function validateEventTitle(title: unknown): { valid: boolean; error?: string } {
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return { valid: false, error: "Title is required." }
  }
  const trimmed = title.trim()
  if (trimmed.length > 100) {
    return { valid: false, error: "Title must be 100 characters or fewer." }
  }
  return { valid: true }
}

describe("Property 1: Event title validation is length-bounded", () => {
  it("accepts any non-empty title up to 100 characters after trimming", () => {
    fc.assert(
      fc.property(
        // Generate strings of length 1–100 (no leading/trailing whitespace to keep it simple)
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (title) => {
          const result = validateEventTitle(title)
          expect(result.valid).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("rejects any title whose trimmed length exceeds 100 characters", () => {
    fc.assert(
      fc.property(
        // Generate strings longer than 100 chars with no whitespace padding
        fc.string({ minLength: 101, maxLength: 300 }).map((s) => s.replace(/\s/g, "x")),
        (title) => {
          const result = validateEventTitle(title)
          expect(result.valid).toBe(false)
          expect(result.error).toContain("100 characters")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("rejects empty strings and whitespace-only strings", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(""),
          fc.stringOf(fc.constantFrom(" ", "\t", "\n"), { minLength: 1, maxLength: 20 })
        ),
        (title) => {
          const result = validateEventTitle(title)
          expect(result.valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rejects non-string values", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
        (title) => {
          const result = validateEventTitle(title)
          expect(result.valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
