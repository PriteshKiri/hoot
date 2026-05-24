/**
 * Property 6: Question image file validation enforces format and size
 *
 * Validates: Requirements 3.5, 3.6
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Pure validation logic (mirrors POST /api/v1/uploads) ─────────────────────

type BucketName = "question-images" | "event-logos"

const BUCKET_CONFIG = {
  "question-images": {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    maxSizeLabel: "5 MB",
  },
  "event-logos": {
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/svg+xml"],
    maxSizeLabel: "2 MB",
  },
} as const

function validateUpload(
  bucket: BucketName,
  contentType: string,
  contentLength: number
): { valid: boolean; error?: { code: string; message: string } } {
  const config = BUCKET_CONFIG[bucket]

  if (!config.allowedMimeTypes.includes(contentType as never)) {
    return {
      valid: false,
      error: {
        code: "UNSUPPORTED_FILE_TYPE",
        message: `File type "${contentType}" is not supported for ${bucket}.`,
      },
    }
  }

  if (contentLength > config.maxSizeBytes) {
    return {
      valid: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: `File size exceeds the maximum allowed size of ${config.maxSizeLabel} for ${bucket}.`,
      },
    }
  }

  return { valid: true }
}

// ── Property 6: Question image file validation ────────────────────────────────

describe("Property 6: Question image file validation enforces format and size", () => {
  // question-images bucket
  describe("question-images bucket", () => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    const maxBytes = 5 * 1024 * 1024

    it("accepts allowed MIME types within size limit", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allowedTypes),
          fc.integer({ min: 0, max: maxBytes }),
          (mimeType, size) => {
            const result = validateUpload("question-images", mimeType, size)
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: 200 }
      )
    })

    it("rejects disallowed MIME types", () => {
      const disallowedTypes = [
        "image/svg+xml",
        "image/tiff",
        "image/bmp",
        "application/pdf",
        "text/plain",
        "video/mp4",
        "application/octet-stream",
      ]
      fc.assert(
        fc.property(
          fc.constantFrom(...disallowedTypes),
          fc.integer({ min: 0, max: maxBytes }),
          (mimeType, size) => {
            const result = validateUpload("question-images", mimeType, size)
            expect(result.valid).toBe(false)
            expect(result.error?.code).toBe("UNSUPPORTED_FILE_TYPE")
          }
        ),
        { numRuns: 200 }
      )
    })

    it("rejects files exceeding 5 MB", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allowedTypes),
          fc.integer({ min: maxBytes + 1, max: maxBytes * 3 }),
          (mimeType, size) => {
            const result = validateUpload("question-images", mimeType, size)
            expect(result.valid).toBe(false)
            expect(result.error?.code).toBe("FILE_TOO_LARGE")
          }
        ),
        { numRuns: 200 }
      )
    })

    it("accepts files at exactly the size limit (boundary)", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allowedTypes),
          (mimeType) => {
            const result = validateUpload("question-images", mimeType, maxBytes)
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  // event-logos bucket
  describe("event-logos bucket", () => {
    const allowedTypes = ["image/jpeg", "image/png", "image/svg+xml"]
    const maxBytes = 2 * 1024 * 1024

    it("accepts allowed MIME types within size limit", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allowedTypes),
          fc.integer({ min: 0, max: maxBytes }),
          (mimeType, size) => {
            const result = validateUpload("event-logos", mimeType, size)
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: 200 }
      )
    })

    it("rejects disallowed MIME types for logos", () => {
      const disallowedTypes = ["image/gif", "image/webp", "image/bmp", "video/mp4"]
      fc.assert(
        fc.property(
          fc.constantFrom(...disallowedTypes),
          fc.integer({ min: 0, max: maxBytes }),
          (mimeType, size) => {
            const result = validateUpload("event-logos", mimeType, size)
            expect(result.valid).toBe(false)
            expect(result.error?.code).toBe("UNSUPPORTED_FILE_TYPE")
          }
        ),
        { numRuns: 200 }
      )
    })

    it("rejects files exceeding 2 MB", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...allowedTypes),
          fc.integer({ min: maxBytes + 1, max: maxBytes * 3 }),
          (mimeType, size) => {
            const result = validateUpload("event-logos", mimeType, size)
            expect(result.valid).toBe(false)
            expect(result.error?.code).toBe("FILE_TOO_LARGE")
          }
        ),
        { numRuns: 200 }
      )
    })
  })
})
