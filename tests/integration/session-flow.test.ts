/**
 * Integration tests: Session flow against a real Supabase test project.
 *
 * These tests require:
 *   - NEXT_PUBLIC_SUPABASE_URL pointing to a test Supabase project
 *   - SUPABASE_SERVICE_ROLE_KEY for that test project
 *   - HOOT_INTEGRATION_ENABLED=true to run
 *
 * Tests:
 *   19.1 participant join → answer → score persisted
 *   19.3 session end → analytics snapshot generated
 *
 * Requirements: 5.1, 10.1–10.6, 13.1
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient } from "@supabase/supabase-js"

const ENABLED = process.env.HOOT_INTEGRATION_ENABLED === "true"

const supabase = ENABLED
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  : null

// Test data IDs — cleaned up in afterAll
let testAdminId: string
let testEventId: string
let testQuestionId: string
let testOptionId: string
let testSessionId: string
let testParticipantId: string
const testParticipantToken = crypto.randomUUID()

describe.skipIf(!ENABLED)("Integration: participant join → answer → score persisted", () => {
  beforeAll(async () => {
    if (!supabase) return

    // Create a test admin profile (use service role to bypass auth)
    testAdminId = crypto.randomUUID()

    // Create test event
    const { data: event } = await supabase
      .from("events")
      .insert({
        id: crypto.randomUUID(),
        admin_id: testAdminId,
        title: `Integration Test Event ${Date.now()}`,
        status: "published",
        join_code: "INTGR1",
      })
      .select()
      .single()
    testEventId = event!.id

    // Create test question
    const { data: question } = await supabase
      .from("questions")
      .insert({
        event_id: testEventId,
        position: 1,
        question_type: "single_select",
        text: "Integration test question?",
        time_limit: 30,
      })
      .select()
      .single()
    testQuestionId = question!.id

    // Create test answer option (correct)
    const { data: option } = await supabase
      .from("answer_options")
      .insert({
        question_id: testQuestionId,
        position: 1,
        text: "Correct answer",
        is_correct: true,
      })
      .select()
      .single()
    testOptionId = option!.id

    // Create test session in 'question' state
    const { data: session } = await supabase
      .from("sessions")
      .insert({
        event_id: testEventId,
        admin_id: testAdminId,
        status: "question",
        current_question_id: testQuestionId,
        current_question_index: 0,
        question_started_at: new Date().toISOString(),
      })
      .select()
      .single()
    testSessionId = session!.id

    // Create test participant
    const { data: participant } = await supabase
      .from("session_participants")
      .insert({
        session_id: testSessionId,
        display_name: "IntegrationTestPlayer",
        avatar: "🦉",
        participant_token: testParticipantToken,
        total_score: 0,
      })
      .select()
      .single()
    testParticipantId = participant!.id
  })

  afterAll(async () => {
    if (!supabase || !testEventId) return
    // Clean up test data
    await supabase.from("participant_answers").delete().eq("session_id", testSessionId)
    await supabase.from("session_participants").delete().eq("session_id", testSessionId)
    await supabase.from("analytics_snapshots").delete().eq("session_id", testSessionId)
    await supabase.from("sessions").delete().eq("id", testSessionId)
    await supabase.from("answer_options").delete().eq("question_id", testQuestionId)
    await supabase.from("questions").delete().eq("id", testQuestionId)
    await supabase.from("events").delete().eq("id", testEventId)
  })

  it("19.1: participant answer is persisted with correct score", async () => {
    if (!supabase) return

    // Insert answer directly (simulating the API route logic)
    const remainingTimeMs = 20_000
    const timeLimitMs = 30_000
    const score = Math.max(1, Math.floor(1000 * (remainingTimeMs / timeLimitMs)))

    const { error: insertError } = await supabase.from("participant_answers").insert({
      session_id: testSessionId,
      participant_id: testParticipantId,
      question_id: testQuestionId,
      selected_option_ids: [testOptionId],
      is_correct: true,
      score_awarded: score,
      response_time_ms: timeLimitMs - remainingTimeMs,
    })

    expect(insertError).toBeNull()

    // Update total_score
    await supabase
      .from("session_participants")
      .update({ total_score: score })
      .eq("id", testParticipantId)

    // Verify answer was persisted
    const { data: answer } = await supabase
      .from("participant_answers")
      .select("*")
      .eq("participant_id", testParticipantId)
      .eq("question_id", testQuestionId)
      .single()

    expect(answer).not.toBeNull()
    expect(answer!.is_correct).toBe(true)
    expect(answer!.score_awarded).toBe(score)

    // Verify total_score was updated
    const { data: participant } = await supabase
      .from("session_participants")
      .select("total_score")
      .eq("id", testParticipantId)
      .single()

    expect(participant!.total_score).toBe(score)
  })

  it("19.3: session end triggers analytics snapshot generation", async () => {
    if (!supabase) return

    // Import and call generateAnalyticsSnapshots directly
    const { generateAnalyticsSnapshots } = await import("@/lib/analytics")
    await generateAnalyticsSnapshots(testSessionId)

    // Verify snapshot was created
    const { data: snapshots } = await supabase
      .from("analytics_snapshots")
      .select("*")
      .eq("session_id", testSessionId)

    expect(snapshots).not.toBeNull()
    expect(snapshots!.length).toBeGreaterThan(0)

    const snapshot = snapshots![0]
    expect(snapshot.question_id).toBe(testQuestionId)
    expect(snapshot.total_responses).toBeGreaterThanOrEqual(1)
  })
})
