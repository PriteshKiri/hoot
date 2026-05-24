import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

type RouteContext = { params: Promise<{ sessionId: string }> }

/**
 * Validates a display name against the rules:
 *   - 1–30 characters
 *   - Matches ^[\p{L}\p{N} \-_]+$ (Unicode letters, digits, spaces, hyphens, underscores)
 *
 * Uses a RegExp constructor with the 'u' flag so TypeScript doesn't complain
 * about the ES6 target requirement for regex literal unicode flags.
 */
function validateDisplayName(name: string): boolean {
  if (name.length < 1 || name.length > 30) return false
  // eslint-disable-next-line prefer-regex-literals
  const pattern = new RegExp("^[\\p{L}\\p{N} \\-_]+$", "u")
  return pattern.test(name)
}

/**
 * POST /api/v1/sessions/[sessionId]/join
 *
 * Uses the Supabase service role key (bypasses RLS) because participants
 * are unauthenticated.
 *
 * Body: { joinCode: string, displayName: string, avatar: string }
 *
 * Logic:
 *   1. Find the session by sessionId — join with events to get join_code
 *   2. Validate joinCode matches event.join_code (case-insensitive) → 404 JOIN_CODE_NOT_FOUND
 *   3. Check session status must be 'lobby' → 409 SESSION_ALREADY_STARTED
 *   4. Check participant count < 150 → 409 SESSION_AT_CAPACITY
 *   5. Validate displayName: 1–30 chars, ^[\p{L}\p{N} \-_]+$ → 400 VALIDATION_ERROR
 *   6. Check display name uniqueness in session → 409 DISPLAY_NAME_TAKEN
 *   7. Create session_participants row with participant_token = crypto.randomUUID()
 *   8. Return { participantToken, sessionId, displayName, avatar }
 *
 * Requirements: 5.1–5.8
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params
  const supabase = createServiceClient()

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

  const { joinCode, displayName, avatar } = body as {
    joinCode?: unknown
    displayName?: unknown
    avatar?: unknown
  }

  // Basic presence checks
  if (typeof joinCode !== "string" || joinCode.trim() === "") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "joinCode is required.",
          field: "joinCode",
        },
      },
      { status: 400 }
    )
  }

  if (typeof displayName !== "string") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "displayName is required.",
          field: "displayName",
        },
      },
      { status: 400 }
    )
  }

  if (typeof avatar !== "string" || avatar.trim() === "") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "avatar is required.",
          field: "avatar",
        },
      },
      { status: 400 }
    )
  }

  // Step 1: Fetch session joined with event to get join_code
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status, participant_count, event_id, events(join_code)")
    .eq("id", sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json(
      { error: { code: "SESSION_NOT_FOUND", message: "Session not found." } },
      { status: 404 }
    )
  }

  // Step 2: Validate join code (case-insensitive)
  // Supabase returns the joined relation as an object or array depending on the relation type.
  // We cast through unknown to handle the inferred type safely.
  const eventsRelation = session.events as unknown as { join_code: string | null } | null
  const eventJoinCode = eventsRelation?.join_code
  if (
    !eventJoinCode ||
    eventJoinCode.toUpperCase() !== joinCode.trim().toUpperCase()
  ) {
    return NextResponse.json(
      {
        error: {
          code: "JOIN_CODE_NOT_FOUND",
          message: "The join code is invalid or the event is not published.",
        },
      },
      { status: 404 }
    )
  }

  // Step 3: Check session status — must be 'lobby'
  if (session.status !== "lobby") {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_ALREADY_STARTED",
          message:
            session.status === "ended"
              ? "This session has already ended."
              : "This session has already started. You can no longer join.",
        },
      },
      { status: 409 }
    )
  }

  // Step 4: Check capacity (≤ 150 participants)
  const { count: participantCount, error: countError } = await supabase
    .from("session_participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)

  if (countError) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to check session capacity." } },
      { status: 500 }
    )
  }

  if (participantCount !== null && participantCount >= 150) {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_AT_CAPACITY",
          message: "This session has reached its maximum capacity of 150 participants.",
        },
      },
      { status: 409 }
    )
  }

  // Step 5: Validate display name
  if (!validateDisplayName(displayName)) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Display name must be 1–30 characters and may only contain letters, digits, spaces, hyphens, or underscores.",
          field: "displayName",
        },
      },
      { status: 400 }
    )
  }

  // Step 6: Check display name uniqueness within this session
  const { data: existingParticipant, error: nameCheckError } = await supabase
    .from("session_participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("display_name", displayName)
    .limit(1)

  if (nameCheckError) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to check display name availability." } },
      { status: 500 }
    )
  }

  if (existingParticipant && existingParticipant.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "DISPLAY_NAME_TAKEN",
          message: "This display name is already taken in this session. Please choose a different name.",
          field: "displayName",
        },
      },
      { status: 409 }
    )
  }

  // Step 7: Create session_participants row
  const participantToken = crypto.randomUUID()

  const { data: participant, error: insertError } = await supabase
    .from("session_participants")
    .insert({
      session_id: sessionId,
      display_name: displayName,
      avatar: avatar,
      participant_token: participantToken,
    })
    .select()
    .single()

  if (insertError || !participant) {
    // Handle unique constraint violation on display_name (race condition)
    if (
      insertError?.code === "23505" ||
      insertError?.message?.toLowerCase().includes("unique")
    ) {
      return NextResponse.json(
        {
          error: {
            code: "DISPLAY_NAME_TAKEN",
            message: "This display name is already taken in this session. Please choose a different name.",
            field: "displayName",
          },
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to join session. Please try again." } },
      { status: 500 }
    )
  }

  // Step 8: Return participant token and session info
  return NextResponse.json(
    {
      participantToken,
      sessionId,
      displayName,
      avatar,
    },
    { status: 201 }
  )
}
