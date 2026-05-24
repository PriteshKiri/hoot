import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

type RouteContext = { params: Promise<{ sessionId: string }> }

/**
 * GET /api/v1/sessions/[sessionId]
 *
 * Returns the current session state including questions and current state.
 * Uses the service client because participants are unauthenticated.
 * Used for reconnection recovery.
 *
 * Returns: { session } with nested event, current question, and questions
 *
 * Requirements: 6.1, 6.4, 6.5
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params
  const supabase = createServiceClient()

  // Fetch session with event info
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(`
      id,
      status,
      current_question_id,
      current_question_index,
      question_started_at,
      participant_count,
      started_at,
      ended_at,
      created_at,
      event_id,
      events (
        id,
        title,
        join_code,
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
            image_url
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

  return NextResponse.json({ session })
}

/**
 * DELETE /api/v1/sessions/[sessionId]
 *
 * Ends a session. Authenticated admin only.
 *
 * Logic:
 *   1. Verify session belongs to the authenticated admin
 *   2. Update session: status = 'ended', ended_at = now()
 *   3. Broadcast session_state_changed { status: 'ended' } to disconnect all participants
 *   4. Return 204
 *
 * Requirements: 12.3
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params

  // Authenticate admin
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

  const supabase = createServiceClient()

  // Step 1: Verify session belongs to admin
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, admin_id, status")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json(
      { error: { code: "SESSION_NOT_FOUND", message: "Session not found." } },
      { status: 404 }
    )
  }

  if (session.admin_id !== user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not the admin of this session." } },
      { status: 403 }
    )
  }

  // Step 2: Update session to ended
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId)

  if (updateError) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to end session." } },
      { status: 500 }
    )
  }

  // Step 3: Broadcast session_state_changed to disconnect all participants
  await supabase.channel(`session:${sessionId}`).send({
    type: "broadcast",
    event: "session_state_changed",
    payload: {
      status: "ended",
      currentQuestionIndex: null,
      currentQuestion: null,
      questionStartedAt: null,
    },
  })

  // Step 4: Return 204 No Content
  return new NextResponse(null, { status: 204 })
}
