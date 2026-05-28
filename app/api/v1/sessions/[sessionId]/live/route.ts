import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

type RouteContext = { params: Promise<{ sessionId: string }> }

/**
 * GET /api/v1/sessions/[sessionId]/live
 *
 * Lightweight polling endpoint that returns the most volatile pieces of
 * session state: current status, question id, total participants, and the
 * count of participants who have submitted an answer for the current
 * question. Used as a fallback by the presenter dashboard in case a
 * `answer_count_updated` Realtime broadcast is missed.
 *
 * Uses the service role client because the presenter is authenticated
 * but the participant tables have no RLS policies (service-role only).
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params
  const supabase = createServiceClient()

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(
      "id, status, current_question_id, current_question_index, question_started_at"
    )
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json(
      { error: { code: "SESSION_NOT_FOUND", message: "Session not found." } },
      { status: 404 }
    )
  }

  const { count: totalParticipants } = await supabase
    .from("session_participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)

  let answeredCount = 0
  if (session.current_question_id) {
    const { count } = await supabase
      .from("participant_answers")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("question_id", session.current_question_id)
    answeredCount = count ?? 0
  }

  return NextResponse.json({
    status: session.status,
    currentQuestionId: session.current_question_id,
    currentQuestionIndex: session.current_question_index,
    questionStartedAt: session.question_started_at,
    answeredCount,
    totalParticipants: totalParticipants ?? 0,
  })
}
