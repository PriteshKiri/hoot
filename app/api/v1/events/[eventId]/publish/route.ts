import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ eventId: string }> }

/**
 * Generates a random 6-character join code from [A-Z0-9].
 */
function generateJoinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Generates a unique join code that has not been used before for this event.
 * Retries up to 10 times to avoid collisions with prior codes in join_code_history.
 */
async function generateUniqueJoinCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string
): Promise<string | null> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode()

    // Check against join_code_history for this event
    const { data: existing } = await supabase
      .from("join_code_history")
      .select("id")
      .eq("event_id", eventId)
      .eq("join_code", code)
      .limit(1)

    if (!existing || existing.length === 0) {
      return code
    }
  }
  return null
}

/**
 * POST /api/v1/events/[eventId]/publish
 *
 * Body: { action: "publish" | "unpublish" }
 *
 * Publish logic:
 *   - Verify event belongs to authenticated admin
 *   - Reject if event has zero questions → 422 EVENT_HAS_NO_QUESTIONS
 *   - Generate a unique 6-char join code distinct from all prior codes
 *   - Insert into join_code_history
 *   - Update event: status = 'published', join_code = <new_code>, updated_at = now()
 *   - Return { event }
 *
 * Unpublish logic:
 *   - Verify event belongs to authenticated admin and is currently published
 *   - Check no active session exists (status not 'ended') → 409 SESSION_ACTIVE
 *   - Update event: status = 'draft', join_code = null, updated_at = now()
 *   - Update join_code_history: set revoked_at = now() for the current join code
 *   - Return { event }
 *
 * Requirements: 4.1–4.7
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { eventId } = await params
  const supabase = await createClient()

  // Authenticate admin
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

  // Parse request body
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

  if (action !== "publish" && action !== "unpublish") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: 'Action must be "publish" or "unpublish".',
          field: "action",
        },
      },
      { status: 400 }
    )
  }

  // Fetch event — RLS ensures it belongs to this admin
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .single()

  if (eventError || !event) {
    return NextResponse.json(
      { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } },
      { status: 404 }
    )
  }

  // ── PUBLISH ──────────────────────────────────────────────────────────────
  if (action === "publish") {
    // Count questions for this event
    const { count: questionCount, error: countError } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)

    if (countError) {
      return NextResponse.json(
        { error: { code: "SERVER_ERROR", message: "Failed to count questions." } },
        { status: 500 }
      )
    }

    if (!questionCount || questionCount === 0) {
      return NextResponse.json(
        {
          error: {
            code: "EVENT_HAS_NO_QUESTIONS",
            message: "Cannot publish an event with no questions. Add at least one question first.",
          },
        },
        { status: 422 }
      )
    }

    // Generate a unique join code not previously used for this event
    const joinCode = await generateUniqueJoinCode(supabase, eventId)

    if (!joinCode) {
      return NextResponse.json(
        {
          error: {
            code: "SERVER_ERROR",
            message: "Failed to generate a unique join code. Please try again.",
          },
        },
        { status: 500 }
      )
    }

    // Insert into join_code_history
    const { error: historyError } = await supabase.from("join_code_history").insert({
      event_id: eventId,
      join_code: joinCode,
      issued_at: new Date().toISOString(),
    })

    if (historyError) {
      return NextResponse.json(
        { error: { code: "SERVER_ERROR", message: "Failed to record join code history." } },
        { status: 500 }
      )
    }

    // Update event to published
    const { data: updatedEvent, error: updateError } = await supabase
      .from("events")
      .update({
        status: "published",
        join_code: joinCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("admin_id", user.id)
      .select()
      .single()

    if (updateError || !updatedEvent) {
      return NextResponse.json(
        { error: { code: "SERVER_ERROR", message: "Failed to publish event." } },
        { status: 500 }
      )
    }

    return NextResponse.json({ event: updatedEvent })
  }

  // ── UNPUBLISH ─────────────────────────────────────────────────────────────
  if (event.status !== "published") {
    return NextResponse.json(
      {
        error: {
          code: "EVENT_NOT_PUBLISHED",
          message: "Event is not currently published.",
        },
      },
      { status: 409 }
    )
  }

  // Check for active sessions (any session that is not 'ended')
  const { data: activeSessions, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("event_id", eventId)
    .neq("status", "ended")
    .limit(1)

  if (sessionError) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to check session status." } },
      { status: 500 }
    )
  }

  if (activeSessions && activeSessions.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_ACTIVE",
          message: "Cannot unpublish an event with an active session. End the session first.",
        },
      },
      { status: 409 }
    )
  }

  const currentJoinCode = event.join_code

  // Revoke the current join code in history
  if (currentJoinCode) {
    await supabase
      .from("join_code_history")
      .update({ revoked_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .eq("join_code", currentJoinCode)
      .is("revoked_at", null)
  }

  // Update event to draft
  const { data: updatedEvent, error: updateError } = await supabase
    .from("events")
    .update({
      status: "draft",
      join_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .select()
    .single()

  if (updateError || !updatedEvent) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to unpublish event." } },
      { status: 500 }
    )
  }

  return NextResponse.json({ event: updatedEvent })
}
