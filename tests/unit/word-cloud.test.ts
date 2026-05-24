/**
 * Property 26: Word cloud frequency ordering
 *
 * Validates: Requirements 14.2, 14.3
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Pure word cloud logic (mirrors answers route) ─────────────────────────────

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length >= 2)
}

function buildWordCloud(responses: string[]): Array<{ word: string; count: number }> {
  const freqMap = new Map<string, number>()
  for (const response of responses) {
    const tokens = tokenise(response)
    for (const token of tokens) {
      freqMap.set(token, (freqMap.get(token) ?? 0) + 1)
    }
  }
  return Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, count]) => ({ word, count }))
}

// ── Property 26: Word cloud frequency ordering ────────────────────────────────

describe("Property 26: Word cloud frequency ordering", () => {
  it("word cloud is sorted by frequency descending", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 200 }),
          { minLength: 1, maxLength: 30 }
        ),
        (responses) => {
          const cloud = buildWordCloud(responses)
          for (let i = 0; i < cloud.length - 1; i++) {
            expect(cloud[i].count).toBeGreaterThanOrEqual(cloud[i + 1].count)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("word cloud contains at most 50 entries", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 10, maxLength: 200 }),
          { minLength: 1, maxLength: 100 }
        ),
        (responses) => {
          const cloud = buildWordCloud(responses)
          expect(cloud.length).toBeLessThanOrEqual(50)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("all word counts are positive integers", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 100 }),
          { minLength: 1, maxLength: 20 }
        ),
        (responses) => {
          const cloud = buildWordCloud(responses)
          for (const entry of cloud) {
            expect(entry.count).toBeGreaterThan(0)
            expect(Number.isInteger(entry.count)).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("word with highest frequency is always first", () => {
    fc.assert(
      fc.property(
        // Generate responses that definitely contain a repeated word
        fc.string({ minLength: 3, maxLength: 20 }).map((w) => w.replace(/[^a-z]/g, "a") || "aaa"),
        fc.integer({ min: 3, max: 10 }),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 10 }),
        (dominantWord, repeatCount, otherResponses) => {
          fc.pre(dominantWord.length >= 2)
          const responses = [
            ...Array(repeatCount).fill(dominantWord),
            ...otherResponses,
          ]
          const cloud = buildWordCloud(responses)
          if (cloud.length > 0) {
            const maxCount = Math.max(...cloud.map((e) => e.count))
            expect(cloud[0].count).toBe(maxCount)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("word cloud words are all lowercase", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 100 }),
          { minLength: 1, maxLength: 20 }
        ),
        (responses) => {
          const cloud = buildWordCloud(responses)
          for (const entry of cloud) {
            expect(entry.word).toBe(entry.word.toLowerCase())
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it("empty responses produce an empty word cloud", () => {
    const cloud = buildWordCloud([])
    expect(cloud).toEqual([])
  })

  it("responses with only short words (< 2 chars) produce an empty word cloud", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom("a", "i", "1", " ", "!"),
          { minLength: 1, maxLength: 20 }
        ),
        (tokens) => {
          const cloud = buildWordCloud(tokens)
          expect(cloud.length).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
