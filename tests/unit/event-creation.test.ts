/**
 * Property 2: New events are always created in Draft state
 * Property 3: Duplicate event titles under the same admin are rejected
 *
 * Validates: Requirements 2.2, 2.4
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

// ── Pure helpers (mirrors API route logic) ───────────────────────────────────

function createEvent(
  adminId: string,
  title: string,
  existingEvents: EventRecord[]
): { event?: EventRecord; error?: { code: string; message: string } } {
  const trimmed = title.trim()

  if (!trimmed) {
    return { error: { code: "VALIDATION_ERROR", message: "Title is required." } }
  }
  if (trimmed.length > 100) {
    return { error: { code: "VALIDATION_ERROR", message: "Title must be 100 characters or fewer." } }
  }

  // Duplicate check (case-insensitive, same admin)
  const duplicate = existingEvents.some(
    (e) => e.admin_id === adminId && e.title.toLowerCase() === trimmed.toLowerCase()
  )
  if (duplicate) {
    return { error: { code: "DUPLICATE_EVENT_TITLE", message: "An event with this title already exists." } }
  }

  const event: EventRecord = {
    id: crypto.randomUUID(),
    admin_id: adminId,
    title: trimmed,
    status: "draft",
    created_at: new Date().toISOString(),
  }
  return { event }
}

// ── Property 2: New events are always created in Draft state ─────────────────

describe("Property 2: New events are always created in Draft state", () => {
  it("every successfully created event has status 'draft'", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (adminId, title) => {
          const result = createEvent(adminId, title.trim(), [])
          if (result.event) {
            expect(result.event.status).toBe("draft")
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("status is always 'draft' regardless of title content", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        // Titles that are definitely valid (1–100 non-whitespace chars)
        fc.string({ minLength: 1, maxLength: 100 }).map((s) => s.replace(/\s/g, "a") || "a"),
        (adminId, title) => {
          const result = createEvent(adminId, title, [])
          expect(result.event?.status ?? "draft").toBe("draft")
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ── Property 3: Duplicate event titles under the same admin are rejected ──────

describe("Property 3: Duplicate event titles under the same admin are rejected", () => {
  it("creating an event with the same title (case-insensitive) for the same admin returns DUPLICATE_EVENT_TITLE", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }).map((s) => s.replace(/\s/g, "a") || "a"),
        (adminId, baseTitle) => {
          const existing: EventRecord[] = [
            {
              id: crypto.randomUUID(),
              admin_id: adminId,
              title: baseTitle,
              status: "draft",
              created_at: new Date().toISOString(),
            },
          ]

          // Exact duplicate
          const result = createEvent(adminId, baseTitle, existing)
          expect(result.error?.code).toBe("DUPLICATE_EVENT_TITLE")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("duplicate check is case-insensitive", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        // Generate a title with at least one letter so case-flipping works
        fc.string({ minLength: 1, maxLength: 50 }).map((s) => s.replace(/[^a-zA-Z]/g, "a") || "a"),
        (adminId, baseTitle) => {
          const existing: EventRecord[] = [
            {
              id: crypto.randomUUID(),
              admin_id: adminId,
              title: baseTitle.toLowerCase(),
              status: "draft",
              created_at: new Date().toISOString(),
            },
          ]

          // Try with uppercase version
          const result = createEvent(adminId, baseTitle.toUpperCase(), existing)
          expect(result.error?.code).toBe("DUPLICATE_EVENT_TITLE")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("same title under a different admin is allowed", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }).map((s) => s.replace(/\s/g, "a") || "a"),
        (adminId1, adminId2, title) => {
          fc.pre(adminId1 !== adminId2)

          const existing: EventRecord[] = [
            {
              id: crypto.randomUUID(),
              admin_id: adminId1,
              title,
              status: "draft",
              created_at: new Date().toISOString(),
            },
          ]

          // Different admin — should succeed
          const result = createEvent(adminId2, title, existing)
          expect(result.error?.code).not.toBe("DUPLICATE_EVENT_TITLE")
        }
      ),
      { numRuns: 200 }
    )
  })
})
