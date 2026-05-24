import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * GET /api/v1/sessions/by-join-code?code=XXXXXX
 *
 * Looks up an active session (status = 'lobby') by the event's join code.
 * Uses the service client because participants are unauthenticated.
 *
 * Returns: { sessionId, eventTitle }
 * Errors:  404 SESSION_NOT_FOUND if no matching published event / lobby session
 *
 * Requirements: 5.1, 5.2
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code || code.trim() === "") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Query parameter 'code' is required.",
          field: "code",
        },
      },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Find the published event with this join code (case-insensitive)
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, join_code, status")
    .ilike("join_code", code.trim())
    .eq("status", "published")
    .single()

  if (eventError || !event) {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_NOT_FOUND",
          message: "No active session found for this join code.",
        },
      },
      { status: 404 }
    )
  }

  // Find the active lobby session for this event
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("event_id", event.id)
    .eq("status", "lobby")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (sessionError || !session) {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_NOT_FOUND",
          message: "No active session found for this join code.",
        },
      },
      { status: 404 }
    )
  }

  return NextResponse.json({
    sessionId: session.id,
    eventTitle: event.title,
  })
}
