import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/v1/sessions
 *
 * Creates a new session for a published event. Authenticated admin only.
 *
 * Body: { eventId: string }
 *
 * Logic:
 *   1. Authenticate admin
 *   2. Verify event belongs to admin and is published
 *   3. Create session row: { event_id, admin_id, status: 'lobby' }
 *   4. Return { session } with 201
 *
 * Requirements: 6.1, 6.4, 6.5
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    )
  }

  const { eventId } = body as { eventId?: unknown }

  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "eventId is required.",
          field: "eventId",
        },
      },
      { status: 400 }
    )
  }

  // Verify event belongs to admin and is published
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, status, join_code")
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .single()

  if (eventError || !event) {
    return NextResponse.json(
      { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } },
      { status: 404 }
    )
  }

  if (event.status !== "published") {
    return NextResponse.json(
      {
        error: {
          code: "EVENT_NOT_PUBLISHED",
          message: "Event must be published before starting a session.",
        },
      },
      { status: 409 }
    )
  }

  // Create the session
  const { data: session, error: insertError } = await supabase
    .from("sessions")
    .insert({
      event_id: eventId,
      admin_id: user.id,
      status: "lobby",
    })
    .select()
    .single()

  if (insertError || !session) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to create session. Please try again." } },
      { status: 500 }
    )
  }

  return NextResponse.json({ session }, { status: 201 })
}
