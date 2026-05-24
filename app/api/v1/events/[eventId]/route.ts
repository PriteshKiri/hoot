import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ eventId: string }> }

/**
 * GET /api/v1/events/[eventId]
 *
 * Returns a single event by ID. The event must belong to the authenticated admin.
 *
 * Requirements: 2.7
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { eventId } = await params
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

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .single()

  if (error || !event) {
    return NextResponse.json(
      { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } },
      { status: 404 }
    )
  }

  return NextResponse.json({ event })
}

/**
 * PATCH /api/v1/events/[eventId]
 *
 * Updates title and/or description of an event.
 * Same validation rules as POST /api/v1/events.
 *
 * Requirements: 2.1, 2.4
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { eventId } = await params
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

  // Verify the event exists and belongs to this admin
  const { data: existing, error: fetchError } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } },
      { status: 404 }
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

  const { title, description } = body as { title?: unknown; description?: unknown }

  const updates: Record<string, unknown> = {}

  // Validate and apply title if provided
  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Title must be a non-empty string.",
            field: "title",
          },
        },
        { status: 400 }
      )
    }

    const trimmedTitle = title.trim()

    if (trimmedTitle.length > 100) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Title must be 100 characters or fewer.",
            field: "title",
          },
        },
        { status: 400 }
      )
    }

    updates.title = trimmedTitle
  }

  // Validate and apply description if provided
  if (description !== undefined) {
    if (description !== null) {
      if (typeof description !== "string") {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Description must be a string.",
              field: "description",
            },
          },
          { status: 400 }
        )
      }
      if (description.length > 500) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Description must be 500 characters or fewer.",
              field: "description",
            },
          },
          { status: 400 }
        )
      }
    }
    updates.description = description
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "No valid fields provided for update.",
        },
      },
      { status: 400 }
    )
  }

  updates.updated_at = new Date().toISOString()

  const { data: event, error: updateError } = await supabase
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .select()
    .single()

  if (updateError) {
    // Postgres unique violation code is 23505
    if (
      updateError.code === "23505" ||
      updateError.message?.toLowerCase().includes("unique") ||
      updateError.message?.toLowerCase().includes("duplicate")
    ) {
      return NextResponse.json(
        {
          error: {
            code: "DUPLICATE_EVENT_TITLE",
            message: "An event with this title already exists.",
            field: "title",
          },
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: {
          code: "UPDATE_FAILED",
          message: "Failed to update event. Please try again.",
        },
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ event })
}

/**
 * DELETE /api/v1/events/[eventId]
 *
 * Deletes an event if no active session exists.
 * - Returns 409 SESSION_ACTIVE if an active session exists (status not 'ended')
 * - Returns 404 if not found
 *
 * Requirements: 2.5, 2.6
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { eventId } = await params
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

  // Verify the event exists and belongs to this admin
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .single()

  if (fetchError || !event) {
    return NextResponse.json(
      { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } },
      { status: 404 }
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
      {
        error: {
          code: "DELETE_FAILED",
          message: "Failed to check session status. Please try again.",
        },
      },
      { status: 500 }
    )
  }

  if (activeSessions && activeSessions.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_ACTIVE",
          message:
            "Cannot delete an event with an active session. End the session first.",
        },
      },
      { status: 409 }
    )
  }

  const { error: deleteError } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("admin_id", user.id)

  if (deleteError) {
    return NextResponse.json(
      {
        error: {
          code: "DELETE_FAILED",
          message: "Failed to delete event. Please try again.",
        },
      },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
