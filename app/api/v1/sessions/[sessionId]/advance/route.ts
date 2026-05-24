import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

type RouteContext = { params: Promise<{ sessionId: string }> }

/**
 * Broadcasts a Realtime event via the Supabase REST broadcast API.
 * Server-side JS channel.send() requires an active WebSocket subscription,
 * so we use the HTTP endpoint with the service role key instead.
 */
async function broadcastEvent(
  sessionId: string,
  event: string,
  payload: Record<string, unknown>
) {
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
          event,
          payload,
        },
      ],
    }),
  })
}

type SessionStatus =
  | "lobby"
  | "countdown"
  | "question"
  | "results"
  | "leaderboard"
  | "final_leaderboard"
  | "ended"

/**
 * POST /api/v1/sessions/[sessionId]/advance
 *
 * Drives the session state machine. Authenticated admin only.
 *
 * Body: { action: 'start' | 'advance' }
 *
 * State transitions:
 *   lobby            → countdown
 *   countdown        → question
 *   question         → results
 *   results          → leaderboard
 *   leaderboard      → countdown (more questions) | final_leaderboard (last question)
 *   final_leaderboard → ended
 *
 * When entering 'question' state:
 *   - Sets current_question_id, current_question_index, question_started_at = now()
 *
 * When entering 'results' state:
 *   - Computes response distribution from participant_answers
 *   - Broadcasts results_revealed event with correctOptionIds and distribution
 *
 * When entering 'leaderboard' or 'final_leaderboard' state:
 *   - Computes ranked list from session_participants.total_score
 *   - Computes scoreDelta per participant from last question answers
 *   - Updates session_participants.rank
 *   - Broadcasts leaderboard_updated event
 *
 * Broadcasts 'session_state_changed' to channel 'session:{sessionId}' via service client.
 * NOTE: is_correct is NOT included in options payload.
 *
 * Requirements: 7.1, 7.2, 9.1, 9.2, 11.1, 11.2, 11.3, 11.4, 11.5
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params

  // Authenticate admin via server client
  const authClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
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

  const { action } = body as { action?: unknown }

  if (action !== "start" && action !== "advance") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: 'Action must be "start" or "advance".',
          field: "action",
        },
      },
      { status: 400 }
    )
  }

  // Use service client for DB operations (bypasses RLS for session data)
  const supabase = createServiceClient()

  // Fetch session with event questions
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(`
      id,
      status,
      admin_id,
      event_id,
      current_question_id,
      current_question_index,
      question_started_at,
      events (
        id,
        title,
        questions (
          id,
          position,
          question_type,
          text,
          image_url,
          time_limit,
          rating_min,
          rating_max,
          answer_options (
            id,
            position,
            text,
            image_url,
            is_correct
          )
        )
      )
    `)
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json(
      { error: { code: "SESSION_NOT_FOUND", message: "Session not found." } },
      { status: 404 }
    )
  }

  // Verify the authenticated user is the session admin
  if (session.admin_id !== user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not the admin of this session." } },
      { status: 403 }
    )
  }

  const currentStatus = session.status as SessionStatus

  // Get sorted questions
  const eventsRelation = session.events as unknown as {
    id: string
    title: string
    questions: Array<{
      id: string
      position: number
      question_type: string
      text: string
      image_url: string | null
      time_limit: number
      rating_min: number | null
      rating_max: number | null
      answer_options: Array<{
        id: string
        position: number
        text: string | null
        image_url: string | null
        is_correct: boolean
      }>
    }>
  } | null

  const questions = (eventsRelation?.questions ?? []).sort(
    (a, b) => a.position - b.position
  )

  const totalQuestions = questions.length
  const currentIndex = session.current_question_index ?? -1

  // Determine next state and updates
  let nextStatus: SessionStatus
  const updates: Record<string, unknown> = {}

  switch (currentStatus) {
    case "lobby":
      nextStatus = "countdown"
      updates.started_at = new Date().toISOString()
      break

    case "countdown":
      nextStatus = "question"
      break

    case "question":
      nextStatus = "results"
      break

    case "results":
      nextStatus = "leaderboard"
      break

    case "leaderboard": {
      const nextIndex = currentIndex + 1
      if (nextIndex < totalQuestions) {
        nextStatus = "countdown"
      } else {
        nextStatus = "final_leaderboard"
      }
      break
    }

    case "final_leaderboard":
      nextStatus = "ended"
      updates.ended_at = new Date().toISOString()
      break

    default:
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: `Cannot advance from state '${currentStatus}'.`,
          },
        },
        { status: 409 }
      )
  }

  // When entering 'question' state, set the current question
  if (nextStatus === "question") {
    const nextQuestionIndex = currentIndex + 1

    if (nextQuestionIndex >= totalQuestions) {
      return NextResponse.json(
        {
          error: {
            code: "NO_MORE_QUESTIONS",
            message: "No more questions available.",
          },
        },
        { status: 409 }
      )
    }

    const nextQuestion = questions[nextQuestionIndex]
    updates.current_question_id = nextQuestion.id
    updates.current_question_index = nextQuestionIndex
    updates.question_started_at = new Date().toISOString()
  }

  updates.status = nextStatus

  // Update session in DB
  const { data: updatedSession, error: updateError } = await supabase
    .from("sessions")
    .update(updates)
    .eq("id", sessionId)
    .select()
    .single()

  if (updateError || !updatedSession) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to advance session state." } },
      { status: 500 }
    )
  }

  // Build the current question payload (without is_correct)
  let currentQuestionPayload: {
    id: string
    text: string
    questionType: string
    imageUrl: string | null
    timeLimitSeconds: number
    options: Array<{
      id: string
      text: string | null
      imageUrl: string | null
      position: number
    }>
  } | null = null

  const newQuestionIndex = updatedSession.current_question_index
  if (
    nextStatus === "question" &&
    newQuestionIndex !== null &&
    newQuestionIndex !== undefined &&
    questions[newQuestionIndex]
  ) {
    const q = questions[newQuestionIndex]
    currentQuestionPayload = {
      id: q.id,
      text: q.text,
      questionType: q.question_type,
      imageUrl: q.image_url,
      timeLimitSeconds: q.time_limit,
      options: q.answer_options
        .sort((a, b) => a.position - b.position)
        .map((opt) => ({
          id: opt.id,
          text: opt.text,
          imageUrl: opt.image_url,
          position: opt.position,
          // NOTE: is_correct intentionally excluded
        })),
    }
  }

  // Broadcast session_state_changed via service client
  const broadcastPayload = {
    status: nextStatus,
    currentQuestionIndex: updatedSession.current_question_index ?? null,
    currentQuestion: currentQuestionPayload,
    questionStartedAt: updatedSession.question_started_at ?? null,
  }

  await broadcastEvent(sessionId, "session_state_changed", broadcastPayload as unknown as Record<string, unknown>)

  // ─── Task 12.1: Results reveal ───────────────────────────────────────────
  // When transitioning to 'results', compute and broadcast response distribution
  if (nextStatus === "results" && session.current_question_id) {
    await broadcastResultsRevealed(supabase, sessionId, session.current_question_id, questions)
  }

  // ─── Task 12.2: Leaderboard computation ──────────────────────────────────
  // When transitioning to 'leaderboard' or 'final_leaderboard', compute and broadcast
  if (nextStatus === "leaderboard" || nextStatus === "final_leaderboard") {
    await broadcastLeaderboard(
      supabase,
      sessionId,
      session.current_question_id,
      nextStatus === "final_leaderboard"
    )
  }

  return NextResponse.json({ session: updatedSession })
}

/**
 * Computes response distribution for the current question and broadcasts
 * the results_revealed event.
 *
 * Requirements: 11.1, 11.2
 */
async function broadcastResultsRevealed(
  supabase: ReturnType<typeof createServiceClient>,
  sessionId: string,
  questionId: string,
  questions: Array<{
    id: string
    answer_options: Array<{ id: string; is_correct: boolean }>
  }>
) {
  // Get all answers for this question in this session
  const { data: answers } = await supabase
    .from("participant_answers")
    .select("selected_option_ids")
    .eq("session_id", sessionId)
    .eq("question_id", questionId)

  const currentQuestion = questions.find((q) => q.id === questionId)
  if (!currentQuestion) return

  const correctOptionIds = currentQuestion.answer_options
    .filter((o) => o.is_correct)
    .map((o) => o.id)

  // Count responses per option
  const optionCounts: Record<string, number> = {}
  let totalResponses = 0

  for (const answer of answers ?? []) {
    const selectedIds = answer.selected_option_ids as string[] | null
    if (selectedIds && selectedIds.length > 0) {
      totalResponses++
      for (const optionId of selectedIds) {
        optionCounts[optionId] = (optionCounts[optionId] ?? 0) + 1
      }
    }
  }

  // Build distribution array for all options in the question
  const distribution = currentQuestion.answer_options.map((option) => {
    const count = optionCounts[option.id] ?? 0
    const percentage =
      totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0
    return { optionId: option.id, count, percentage }
  })

  await broadcastEvent(sessionId, "results_revealed", {
    questionId,
    correctOptionIds,
    distribution,
    totalResponses,
  })
}

/**
 * Computes the leaderboard from session_participants, updates rank column,
 * and broadcasts the leaderboard_updated event.
 *
 * Ties broken by ascending display_name (alphabetical).
 *
 * Requirements: 11.3, 11.4, 11.5
 */
async function broadcastLeaderboard(
  supabase: ReturnType<typeof createServiceClient>,
  sessionId: string,
  currentQuestionId: string | null,
  isFinal: boolean
) {
  // Fetch all participants ordered by total_score DESC, display_name ASC
  const { data: participants } = await supabase
    .from("session_participants")
    .select("id, display_name, avatar, total_score")
    .eq("session_id", sessionId)
    .order("total_score", { ascending: false })
    .order("display_name", { ascending: true })

  if (!participants || participants.length === 0) return

  // Fetch score deltas from the last question's answers
  const scoreDeltas: Record<string, number> = {}
  if (currentQuestionId) {
    const { data: lastAnswers } = await supabase
      .from("participant_answers")
      .select("participant_id, score_awarded")
      .eq("session_id", sessionId)
      .eq("question_id", currentQuestionId)

    for (const answer of lastAnswers ?? []) {
      scoreDeltas[answer.participant_id as string] = answer.score_awarded as number
    }
  }

  // Assign ranks (1-based, ties share the same rank)
  const entries: Array<{
    rank: number
    participantId: string
    displayName: string
    avatar: string
    totalScore: number
    scoreDelta: number
  }> = []

  let rank = 1
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]
    // If same score and name order as previous, same rank (ties)
    if (
      i > 0 &&
      p.total_score === participants[i - 1].total_score
    ) {
      // Same rank as previous (tie)
      entries.push({
        rank: entries[i - 1].rank,
        participantId: p.id,
        displayName: p.display_name,
        avatar: p.avatar,
        totalScore: p.total_score,
        scoreDelta: scoreDeltas[p.id] ?? 0,
      })
    } else {
      entries.push({
        rank,
        participantId: p.id,
        displayName: p.display_name,
        avatar: p.avatar,
        totalScore: p.total_score,
        scoreDelta: scoreDeltas[p.id] ?? 0,
      })
    }
    rank = i + 2 // next rank is position + 1 (1-based)
  }

  // Update rank column for each participant
  const rankUpdates = entries.map((e) =>
    supabase
      .from("session_participants")
      .update({ rank: e.rank })
      .eq("id", e.participantId)
  )
  await Promise.all(rankUpdates)

  // Broadcast leaderboard_updated
  await broadcastEvent(sessionId, "leaderboard_updated", {
    isFinal,
    entries,
  })
}
