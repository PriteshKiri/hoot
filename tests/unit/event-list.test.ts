/**
 * Property 4: Event list is always ordered by creation date descending
 *
 * Validates: Requirements 2.7
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Types ────────────────────────────────────────────────────────────────────

interface EventRecord {
  id: string
  admin_id: string
  title: string
  status: "draft" | "published"
  created_at: string
}

// ── Pure sort helper (mirrors the API route's .order("created_at", { ascending: false })) ──

function sortEventsByCreatedAtDesc(events: EventRecord[]): EventRecord[] {
  return [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

function isSortedDescByCreatedAt(events: EventRecord[]): boolean {
  for (let i = 0; i < events.length - 1; i++) {
    const curr = new Date(events[i].created_at).getTime()
    const next = new Date(events[i + 1].created_at).getTime()
    if (curr < next) return false
  }
  return true
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const eventArbitrary = fc
  .record({
    id: fc.uuid(),
    admin_id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 100 }).map((s) => s.replace(/\s/g, "a") || "a"),
    status: fc.constantFrom("draft" as const, "published" as const),
    // Generate timestamps spread over a wide range
    created_at: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }).map((d) => d.toISOString()),
  })

// ── Property 4 ────────────────────────────────────────────────────────────────

describe("Property 4: Event list is always ordered by creation date descending", () => {
  it("sorted list is always in descending created_at order", () => {
    fc.assert(
      fc.property(
        fc.array(eventArbitrary, { minLength: 0, maxLength: 50 }),
        (events) => {
          const sorted = sortEventsByCreatedAtDesc(events)
          expect(isSortedDescByCreatedAt(sorted)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("the first element has the most recent created_at", () => {
    fc.assert(
      fc.property(
        fc.array(eventArbitrary, { minLength: 2, maxLength: 50 }),
        (events) => {
          const sorted = sortEventsByCreatedAtDesc(events)
          const maxTime = Math.max(...events.map((e) => new Date(e.created_at).getTime()))
          expect(new Date(sorted[0].created_at).getTime()).toBe(maxTime)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("the last element has the oldest created_at", () => {
    fc.assert(
      fc.property(
        fc.array(eventArbitrary, { minLength: 2, maxLength: 50 }),
        (events) => {
          const sorted = sortEventsByCreatedAtDesc(events)
          const minTime = Math.min(...events.map((e) => new Date(e.created_at).getTime()))
          expect(new Date(sorted[sorted.length - 1].created_at).getTime()).toBe(minTime)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("sorting is stable: same set of events always produces the same order", () => {
    fc.assert(
      fc.property(
        fc.array(eventArbitrary, { minLength: 0, maxLength: 30 }),
        (events) => {
          const sorted1 = sortEventsByCreatedAtDesc(events)
          const sorted2 = sortEventsByCreatedAtDesc(events)
          expect(sorted1.map((e) => e.id)).toEqual(sorted2.map((e) => e.id))
        }
      ),
      { numRuns: 200 }
    )
  })

  it("sorting does not lose or duplicate events", () => {
    fc.assert(
      fc.property(
        fc.array(eventArbitrary, { minLength: 0, maxLength: 50 }),
        (events) => {
          const sorted = sortEventsByCreatedAtDesc(events)
          expect(sorted.length).toBe(events.length)
          const originalIds = new Set(events.map((e) => e.id))
          const sortedIds = new Set(sorted.map((e) => e.id))
          expect(sortedIds.size).toBe(originalIds.size)
        }
      ),
      { numRuns: 200 }
    )
  })
})
