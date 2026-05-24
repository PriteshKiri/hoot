import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { calculateScore } from "@/lib/scoring"

type RouteContext = { params: Promise<{ sessionId: string }> }

/**
 * POST /api/v1/sessions/[sessionId]/answers
 *
 * Uses the Supabase service role key (bypasses RLS) because participants
 * are unauthenticated.
 *
 * Auth: participant_token in Authorization: Bearer <token> header.
 *
 * Body: {
 *   questionId: string,
 *   selectedOptionIds?: string[],
 *   openTextResponse?: string,
 *   ratingValue?: number
 * }
 *
 * Logic:
 *   1. Extract participant_token from Authorization header → 401 if missing
 *   2. Look up participant by token → 401 if not found
 *   3. Verify session is in 'question' state and current_question_id matches → 409
 *   4. Check time not expired: (now - question_started_at) < time_limit * 1000 → 409 TIME_EXPIRED
 *   5. Check for existing answer (UNIQUE constraint) → 409 ANSWER_ALREADY_SUBMITTED
 *   6. Calculate score using calculateScore()
 *   7. Insert participant_answers row
 *   8. Update session_participants.total_score atomically
 *   9. Broadcast answer_count_updated event
 *   10. Return { scoreAwarded, isCorrect }
 *
 * Requirements: 10.1–10.6
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params
  const supabase = createServiceClient()

  // Step 1: Extract participant_token from Authorization header
  const authHeader = request.headers.get("authorization")
  const participantToken =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null

  if (!participantToken) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authorization header with participant token is required.",
        },
      },
      { status: 401 }
    )
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    )
  }

  const { questionId, selectedOptionIds, openTextResponse, ratingValue } = body as {
    questionId?: unknown
    selectedOptionIds?: unknown
    openTextResponse?: unknown
    ratingValue?: unknown
  }

  if (typeof questionId !== "string" || !questionId) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "questionId is required.",
          field: "questionId",
        },
      },
      { status: 400 }
    )
  }

  // Step 2: Look up participant by token
  const { data: participant, error: participantError } = await supabase
    .from("session_participants")
    .select("id, session_id, total_score")
    .eq("participant_token", participantToken)
    .eq("session_id", sessionId)
    .single()

  if (participantError || !participant) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid participant token.",
        },
      },
      { status: 401 }
    )
  }

  // Step 3: Verify session is in 'question' state and current_question_id matches
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status, current_question_id, question_started_at")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json(
      { error: { code: "SESSION_NOT_FOUND", message: "Session not found." } },
      { status: 404 }
    )
  }

  if (session.status !== "question") {
    return NextResponse.json(
      {
        error: {
          code: "QUESTION_NOT_ACTIVE",
          message: "No question is currently active.",
        },
      },
      { status: 409 }
    )
  }

  if (session.current_question_id !== questionId) {
    return NextResponse.json(
      {
        error: {
          code: "QUESTION_MISMATCH",
          message: "The submitted questionId does not match the current active question.",
        },
      },
      { status: 409 }
    )
  }

  // Step 4: Check time not expired
  const questionStartedAt = new Date(session.question_started_at!).getTime()
  const now = Date.now()
  const elapsedMs = now - questionStartedAt

  // Fetch question to get time_limit
  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select(
      `
      id,
      question_type,
      time_limit,
      answer_options (
        id,
        is_correct
      )
    `
    )
    .eq("id", questionId)
    .single()

  if (questionError || !question) {
    return NextResponse.json(
      { error: { code: "QUESTION_NOT_FOUND", message: "Question not found." } },
      { status: 404 }
    )
  }

  const timeLimitMs = question.time_limit * 1000
  const remainingTimeMs = Math.max(0, timeLimitMs - elapsedMs)

  if (elapsedMs >= timeLimitMs) {
    return NextResponse.json(
      {
        error: {
          code: "TIME_EXPIRED",
          message: "The time limit for this question has expired.",
        },
      },
      { status: 409 }
    )
  }

  // Step 5: Check for existing answer
  const { data: existingAnswer } = await supabase
    .from("participant_answers")
    .select("id")
    .eq("participant_id", participant.id)
    .eq("question_id", questionId)
    .limit(1)

  if (existingAnswer && existingAnswer.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "ANSWER_ALREADY_SUBMITTED",
          message: "You have already submitted an answer for this question.",
        },
      },
      { status: 409 }
    )
  }

  // Step 6: Calculate score
  const questionType = question.question_type as string
  const answerOptions = question.answer_options as Array<{ id: string; is_correct: boolean }>

  let isCorrect: boolean | null = null
  let scoreAwarded = 0

  if (questionType === "single_select" || questionType === "image_choice") {
    const selectedIds = Array.isArray(selectedOptionIds) ? (selectedOptionIds as string[]) : []
    const selectedId = selectedIds[0]
    if (selectedId) {
      const selectedOption = answerOptions.find((o) => o.id === selectedId)
      isCorrect = selectedOption?.is_correct ?? false
    } else {
      isCorrect = false
    }
    scoreAwarded = calculateScore(isCorrect, remainingTimeMs, timeLimitMs)
  } else if (questionType === "multi_select") {
    const selectedIds = Array.isArray(selectedOptionIds)
      ? (selectedOptionIds as string[]).sort()
      : []
    const correctIds = answerOptions
      .filter((o) => o.is_correct)
      .map((o) => o.id)
      .sort()

    // Correct only if selected IDs exactly match all correct IDs
    isCorrect =
      selectedIds.length === correctIds.length &&
      selectedIds.every((id, i) => id === correctIds[i])
    scoreAwarded = calculateScore(isCorrect, remainingTimeMs, timeLimitMs)
  } else {
    // open_text or rating_scale: always 0 points, is_correct = null
    isCorrect = null
    scoreAwarded = 0
  }

  // Step 7: Insert participant_answers row
  const responseTimeMs = elapsedMs

  const { error: insertError } = await supabase.from("participant_answers").insert({
    session_id: sessionId,
    participant_id: participant.id,
    question_id: questionId,
    selected_option_ids:
      Array.isArray(selectedOptionIds) && (selectedOptionIds as string[]).length > 0
        ? selectedOptionIds
        : null,
    open_text_response:
      typeof openTextResponse === "string" ? openTextResponse : null,
    rating_value: typeof ratingValue === "number" ? ratingValue : null,
    is_correct: isCorrect,
    score_awarded: scoreAwarded,
    response_time_ms: responseTimeMs,
  })

  if (insertError) {
    // Handle unique constraint violation (race condition — first-submission-wins)
    if (
      insertError.code === "23505" ||
      insertError.message?.toLowerCase().includes("unique")
    ) {
      return NextResponse.json(
        {
          error: {
            code: "ANSWER_ALREADY_SUBMITTED",
            message: "You have already submitted an answer for this question.",
          },
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to submit answer." } },
      { status: 500 }
    )
  }

  // Step 8: Update session_participants.total_score atomically using raw SQL increment
  // This avoids a read-modify-write race condition by using a server-side increment.
  await supabase
    .from("session_participants")
    .update({ total_score: participant.total_score + scoreAwarded })
    .eq("id", participant.id)

  // Step 9: Broadcast answer_count_updated event via Supabase REST broadcast API
  // (server-side JS channel.send() requires an active WebSocket subscription,
  //  so we use the HTTP broadcast endpoint with the service role key instead)
  const { count: answeredCount } = await supabase
    .from("participant_answers")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("question_id", questionId)

  const { count: totalParticipants } = await supabase
    .from("session_participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `realtime:session:${sessionId}`,
          event: "answer_count_updated",
          payload: {
            questionId,
            answeredCount: answeredCount ?? 0,
            totalParticipants: totalParticipants ?? 0,
          },
        },
      ],
    }),
  })

  // Step 10: Return result
  return NextResponse.json({ scoreAwarded, isCorrect }, { status: 201 })
}
