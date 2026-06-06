import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

type RouteContext = { params: Promise<{ sessionId: string }> }

/**
 * GET /api/v1/analytics/[sessionId]
 *
 * Returns per-question analytics summary from analytics_snapshots.
 * Authenticated admin only.
 *
 * Requirements: 13.2
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params

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

  // Verify session belongs to this admin
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, admin_id, event_id")
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
      { error: { code: "FORBIDDEN", message: "You do not have access to this session." } },
      { status: 403 }
    )
  }

  // Fetch analytics snapshots with question info
  const { data: snapshots, error: snapshotsError } = await supabase
    .from("analytics_snapshots")
    .select(`
      id,
      question_id,
      total_responses,
      option_counts,
      avg_response_time_ms,
      questions (
        id,
        position,
        text,
        question_type,
        answer_options (
          id,
          position,
          text,
          is_correct
        )
      )
    `)
    .eq("session_id", sessionId)
    .order("question_id")

  if (snapshotsError) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: "Failed to fetch analytics." } },
      { status: 500 }
    )
  }

  // Fetch participant count for this session
  const { count: participantCount } = await supabase
    .from("session_participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)

  return NextResponse.json({
    sessionId,
    participantCount: participantCount ?? 0,
    snapshots: snapshots ?? [],
  })
}

/**
 * DELETE /api/v1/analytics/[sessionId]
 *
 * Permanently deletes a past session along with its analytics. Deleting the
 * session row cascades to analytics_snapshots, participant_answers, and
 * session_participants (see migrations 20240101000004 / 000006).
 *
 * Authenticated admin only; the session must belong to the admin.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params

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

  // Verify session belongs to this admin
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, admin_id")
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
      { error: { code: "FORBIDDEN", message: "You do not have access to this session." } },
      { status: 403 }
    )
  }

  const { error: deleteError } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)

  if (deleteError) {
    return NextResponse.json(
      { error: { code: "DELETE_FAILED", message: "Failed to delete session." } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
