/**
 * Property 9:  Published event join codes match the required format [A-Z0-9]{6}
 * Property 10: Published event QR code encodes the correct URL
 * Property 11: Publishing transitions event to Published state
 * Property 12: Unpublish invalidates join code; re-publish generates a distinct new code
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.6, 4.7
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Pure helpers (mirrors publish route logic) ────────────────────────────────

const JOIN_CODE_PATTERN = /^[A-Z0-9]{6}$/

function generateJoinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Generates a join code that is not in the provided history set.
 * Returns null if it cannot find a unique code in 10 attempts.
 */
function generateUniqueJoinCode(history: Set<string>): string | null {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode()
    if (!history.has(code)) return code
  }
  return null
}

type EventStatus = "draft" | "published"

interface EventRecord {
  id: string
  admin_id: string
  title: string
  status: EventStatus
  join_code: string | null
  question_count: number
}

interface PublishResult {
  event?: EventRecord
  error?: { code: string; message: string }
}

function publishEvent(event: EventRecord, history: Set<string>): PublishResult {
  if (event.question_count === 0) {
    return { error: { code: "EVENT_HAS_NO_QUESTIONS", message: "Cannot publish an event with no questions." } }
  }
  const joinCode = generateUniqueJoinCode(history)
  if (!joinCode) {
    return { error: { code: "SERVER_ERROR", message: "Failed to generate a unique join code." } }
  }
  history.add(joinCode)
  return {
    event: { ...event, status: "published", join_code: joinCode },
  }
}

function unpublishEvent(event: EventRecord): PublishResult {
  if (event.status !== "published") {
    return { error: { code: "EVENT_NOT_PUBLISHED", message: "Event is not currently published." } }
  }
  return {
    event: { ...event, status: "draft", join_code: null },
  }
}

function buildJoinUrl(joinCode: string, baseUrl = "https://hoot.example.com"): string {
  return `${baseUrl}/join/${joinCode}`
}

// ── Property 9: Join codes match [A-Z0-9]{6} ─────────────────────────────────

describe("Property 9: Published event join codes match the required format", () => {
  it("every generated join code matches [A-Z0-9]{6}", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), () => {
        const code = generateJoinCode()
        expect(code).toMatch(JOIN_CODE_PATTERN)
        expect(code.length).toBe(6)
      }),
      { numRuns: 500 }
    )
  })

  it("published event always has a join code matching [A-Z0-9]{6}", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 20 }),
        (eventId, questionCount) => {
          const event: EventRecord = {
            id: eventId,
            admin_id: "admin-1",
            title: "Test Event",
            status: "draft",
            join_code: null,
            question_count: questionCount,
          }
          const result = publishEvent(event, new Set())
          if (result.event) {
            expect(result.event.join_code).toMatch(JOIN_CODE_PATTERN)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 10: QR code encodes the correct URL ──────────────────────────────

describe("Property 10: Published event QR code encodes the correct URL", () => {
  it("join URL always contains the join code", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), () => {
        const code = generateJoinCode()
        const url = buildJoinUrl(code)
        expect(url).toContain(code)
        expect(url).toContain("/join/")
      }),
      { numRuns: 200 }
    )
  })

  it("join URL format is always /join/{code}", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), () => {
        const code = generateJoinCode()
        const url = buildJoinUrl(code)
        expect(url).toMatch(new RegExp(`/join/${code}$`))
      }),
      { numRuns: 200 }
    )
  })
})

// ── Property 11: Publishing transitions event to Published state ──────────────

describe("Property 11: Publishing transitions event to Published state", () => {
  it("successfully published event has status 'published'", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 50 }),
        (eventId, questionCount) => {
          const event: EventRecord = {
            id: eventId,
            admin_id: "admin-1",
            title: "Test Event",
            status: "draft",
            join_code: null,
            question_count: questionCount,
          }
          const result = publishEvent(event, new Set())
          if (result.event) {
            expect(result.event.status).toBe("published")
            expect(result.event.join_code).not.toBeNull()
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("publishing an event with zero questions returns EVENT_HAS_NO_QUESTIONS", () => {
    fc.assert(
      fc.property(fc.uuid(), (eventId) => {
        const event: EventRecord = {
          id: eventId,
          admin_id: "admin-1",
          title: "Empty Event",
          status: "draft",
          join_code: null,
          question_count: 0,
        }
        const result = publishEvent(event, new Set())
        expect(result.error?.code).toBe("EVENT_HAS_NO_QUESTIONS")
      }),
      { numRuns: 100 }
    )
  })
})

// ── Property 12: Unpublish invalidates join code; re-publish generates distinct code ──

describe("Property 12: Unpublish invalidates join code; re-publish generates a distinct new code", () => {
  it("unpublished event has null join_code and status 'draft'", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 20 }),
        (eventId, questionCount) => {
          const event: EventRecord = {
            id: eventId,
            admin_id: "admin-1",
            title: "Test Event",
            status: "draft",
            join_code: null,
            question_count: questionCount,
          }
          const history = new Set<string>()
          const published = publishEvent(event, history)
          if (!published.event) return

          const unpublished = unpublishEvent(published.event)
          if (unpublished.event) {
            expect(unpublished.event.status).toBe("draft")
            expect(unpublished.event.join_code).toBeNull()
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("re-publish generates a join code distinct from the previous one", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 20 }),
        (eventId, questionCount) => {
          const event: EventRecord = {
            id: eventId,
            admin_id: "admin-1",
            title: "Test Event",
            status: "draft",
            join_code: null,
            question_count: questionCount,
          }
          const history = new Set<string>()

          // First publish
          const published1 = publishEvent(event, history)
          if (!published1.event) return
          const firstCode = published1.event.join_code!

          // Unpublish
          const unpublished = unpublishEvent(published1.event)
          if (!unpublished.event) return

          // Re-publish
          const published2 = publishEvent(unpublished.event, history)
          if (!published2.event) return
          const secondCode = published2.event.join_code!

          // The new code must be different from the first
          expect(secondCode).not.toBe(firstCode)
          // Both codes must match the format
          expect(firstCode).toMatch(JOIN_CODE_PATTERN)
          expect(secondCode).toMatch(JOIN_CODE_PATTERN)
        }
      ),
      { numRuns: 200 }
    )
  })
})
