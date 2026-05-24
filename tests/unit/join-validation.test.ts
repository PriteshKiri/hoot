/**
 * Property 13: Display name validation enforces length and character set
 * Property 14: Duplicate display names within a session are rejected
 *
 * Validates: Requirements 5.3, 5.6
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Pure validation helpers (mirrors join API route logic) ────────────────────

function validateDisplayName(name: string): boolean {
  if (name.length < 1 || name.length > 30) return false
  const pattern = new RegExp("^[\\p{L}\\p{N} \\-_]+$", "u")
  return pattern.test(name)
}

interface Participant {
  session_id: string
  display_name: string
}

function checkDisplayNameUniqueness(
  sessionId: string,
  displayName: string,
  existing: Participant[]
): { available: boolean; error?: string } {
  const taken = existing.some(
    (p) => p.session_id === sessionId && p.display_name === displayName
  )
  if (taken) {
    return { available: false, error: "DISPLAY_NAME_TAKEN" }
  }
  return { available: true }
}

// ── Property 13: Display name validation ─────────────────────────────────────

describe("Property 13: Display name validation enforces length and character set", () => {
  it("accepts valid display names (1–30 chars, letters/digits/spaces/hyphens/underscores)", () => {
    fc.assert(
      fc.property(
        // Generate strings of 1–30 chars using only allowed characters
        fc.stringOf(
          fc.constantFrom("a", "b", "c", "d", "e", "f", "g", "h",
            "A", "B", "C", "D", "E", "F", "G", "H",
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
            " ", "-", "_"
          ),
          { minLength: 1, maxLength: 30 }
        ).filter((s) => s.trim().length > 0 && new RegExp("^[\\p{L}\\p{N} \\-_]+$", "u").test(s)),
        (name) => {
          expect(validateDisplayName(name)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("rejects display names longer than 30 characters", () => {
    fc.assert(
      fc.property(
        fc.stringOf(
          fc.constantFrom("a", "b", "c", "d", "e"),
          { minLength: 31, maxLength: 100 }
        ),
        (name) => {
          expect(validateDisplayName(name)).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("rejects empty display names", () => {
    expect(validateDisplayName("")).toBe(false)
  })

  it("rejects display names with disallowed characters", () => {
    fc.assert(
      fc.property(
        // Generate strings containing at least one disallowed character
        fc.stringOf(
          fc.constantFrom("!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "+", "=", "[", "]", "{", "}", "|", "\\", ";", ":", "'", '"', ",", ".", "<", ">", "/", "?", "`", "~"),
          { minLength: 1, maxLength: 10 }
        ),
        (invalidChars) => {
          const name = `valid${invalidChars}`
          // Only test if the name is within length bounds
          if (name.length <= 30) {
            expect(validateDisplayName(name)).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 14: Duplicate display names within a session are rejected ────────

describe("Property 14: Duplicate display names within a session are rejected", () => {
  it("duplicate display name in the same session is rejected", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.stringOf(
          fc.constantFrom("a", "b", "c", "d", "e", "f", "g", "h"),
          { minLength: 1, maxLength: 20 }
        ),
        (sessionId, displayName) => {
          const existing: Participant[] = [
            { session_id: sessionId, display_name: displayName },
          ]
          const result = checkDisplayNameUniqueness(sessionId, displayName, existing)
          expect(result.available).toBe(false)
          expect(result.error).toBe("DISPLAY_NAME_TAKEN")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("same display name in a different session is allowed", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.stringOf(
          fc.constantFrom("a", "b", "c", "d", "e"),
          { minLength: 1, maxLength: 20 }
        ),
        (sessionId1, sessionId2, displayName) => {
          fc.pre(sessionId1 !== sessionId2)

          const existing: Participant[] = [
            { session_id: sessionId1, display_name: displayName },
          ]
          // Joining session2 with the same name should be allowed
          const result = checkDisplayNameUniqueness(sessionId2, displayName, existing)
          expect(result.available).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("unique display name in the same session is allowed", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.stringOf(fc.constantFrom("a", "b", "c"), { minLength: 1, maxLength: 10 }),
        fc.stringOf(fc.constantFrom("x", "y", "z"), { minLength: 1, maxLength: 10 }),
        (sessionId, name1, name2) => {
          fc.pre(name1 !== name2)

          const existing: Participant[] = [
            { session_id: sessionId, display_name: name1 },
          ]
          const result = checkDisplayNameUniqueness(sessionId, name2, existing)
          expect(result.available).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("empty session has no name conflicts", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.stringOf(fc.constantFrom("a", "b", "c"), { minLength: 1, maxLength: 20 }),
        (sessionId, displayName) => {
          const result = checkDisplayNameUniqueness(sessionId, displayName, [])
          expect(result.available).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })
})
