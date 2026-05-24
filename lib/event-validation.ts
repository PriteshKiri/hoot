/**
 * Validates an event title.
 *
 * Requirements: 2.1
 * - Title must be a non-empty string
 * - Title length (after trimming) must be between 1 and 100 characters inclusive
 */
export function validateEventTitle(title: unknown): {
  valid: boolean
  error?: string
} {
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return { valid: false, error: "Title is required." }
  }

  const trimmed = title.trim()

  if (trimmed.length > 100) {
    return { valid: false, error: "Title must be 100 characters or fewer." }
  }

  return { valid: true }
}
