/**
 * Property 21: Reconnection restores participant state
 *
 * Validates: Requirements 8.2
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Types ────────────────────────────────────────────────────────────────────

interface ParticipantRecord {
  id: string
  session_id: string
  display_name: string
  avatar: string
  total_score: number
  participant_token: string
}

interface SessionState {
  id: string
  status: string
  current_question_id: string | null
  current_question_index: number | null
  question_started_at: string | null
}

interface ReconnectionResult {
  success: boolean
  participantToken?: string
  participantId?: string
  displayName?: string
  avatar?: string
  totalScore?: number
  sessionStatus?: string
  reconnected?: boolean
  error?: string
}

// ── Pure reconnection logic (mirrors join route) ──────────────────────────────

function attemptReconnection(
  existingToken: string,
  sessionId: string,
  participants: ParticipantRecord[],
  session: SessionState | null
): ReconnectionResult {
  const participant = participants.find(
    (p) => p.participant_token === existingToken && p.session_id === sessionId
  )

  if (!participant) {
    return { success: false, error: "TOKEN_NOT_FOUND" }
  }

  return {
    success: true,
    participantToken: participant.participant_token,
    participantId: participant.id,
    displayName: participant.display_name,
    avatar: participant.avatar,
    totalScore: participant.total_score,
    sessionStatus: session?.status ?? "lobby",
    reconnected: true,
  }
}

// ── Property 21 ───────────────────────────────────────────────────────────────

describe("Property 21: Reconnection restores participant state", () => {
  const participantArbitrary = fc.record({
    id: fc.uuid(),
    session_id: fc.uuid(),
    display_name: fc.string({ minLength: 1, maxLength: 30 }).map((s) => s.replace(/\s/g, "a") || "a"),
    avatar: fc.constantFrom("🦉", "🐱", "🐶", "🦊", "🐸"),
    total_score: fc.integer({ min: 0, max: 20_000 }),
    participant_token: fc.uuid(),
  })

  const sessionArbitrary = fc.record({
    id: fc.uuid(),
    status: fc.constantFrom("lobby", "countdown", "question", "results", "leaderboard", "ended"),
    current_question_id: fc.option(fc.uuid(), { nil: null }),
    current_question_index: fc.option(fc.integer({ min: 0, max: 20 }), { nil: null }),
    question_started_at: fc.option(
      fc.date({ min: new Date("2024-01-01"), max: new Date("2030-01-01") }).map((d) => d.toISOString()),
      { nil: null }
    ),
  })

  it("reconnection with valid token restores display_name, avatar, and total_score", () => {
    fc.assert(
      fc.property(
        participantArbitrary,
        sessionArbitrary,
        (participant, session) => {
          const sessionWithId = { ...session, id: participant.session_id }
          const result = attemptReconnection(
            participant.participant_token,
            participant.session_id,
            [participant],
            sessionWithId
          )

          expect(result.success).toBe(true)
          expect(result.displayName).toBe(participant.display_name)
          expect(result.avatar).toBe(participant.avatar)
          expect(result.totalScore).toBe(participant.total_score)
          expect(result.reconnected).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("reconnection with valid token returns the same participant_token", () => {
    fc.assert(
      fc.property(
        participantArbitrary,
        sessionArbitrary,
        (participant, session) => {
          const sessionWithId = { ...session, id: participant.session_id }
          const result = attemptReconnection(
            participant.participant_token,
            participant.session_id,
            [participant],
            sessionWithId
          )

          expect(result.participantToken).toBe(participant.participant_token)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("reconnection with invalid token fails", () => {
    fc.assert(
      fc.property(
        participantArbitrary,
        fc.uuid(), // different token
        sessionArbitrary,
        (participant, wrongToken, session) => {
          fc.pre(wrongToken !== participant.participant_token)
          const sessionWithId = { ...session, id: participant.session_id }
          const result = attemptReconnection(
            wrongToken,
            participant.session_id,
            [participant],
            sessionWithId
          )

          expect(result.success).toBe(false)
          expect(result.error).toBe("TOKEN_NOT_FOUND")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("reconnection with token from different session fails", () => {
    fc.assert(
      fc.property(
        participantArbitrary,
        fc.uuid(), // different session
        sessionArbitrary,
        (participant, differentSessionId, session) => {
          fc.pre(differentSessionId !== participant.session_id)
          const sessionWithId = { ...session, id: differentSessionId }
          const result = attemptReconnection(
            participant.participant_token,
            differentSessionId,
            [participant],
            sessionWithId
          )

          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("reconnection restores current session status", () => {
    fc.assert(
      fc.property(
        participantArbitrary,
        sessionArbitrary,
        (participant, session) => {
          const sessionWithId = { ...session, id: participant.session_id }
          const result = attemptReconnection(
            participant.participant_token,
            participant.session_id,
            [participant],
            sessionWithId
          )

          if (result.success) {
            expect(result.sessionStatus).toBe(session.status)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
