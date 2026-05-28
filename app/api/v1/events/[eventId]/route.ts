import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BUILT_IN_THEMES } from "@/lib/themes"

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

  const { title, description, theme_id, custom_theme } = body as {
    title?: unknown
    description?: unknown
    theme_id?: unknown
    custom_theme?: unknown
  }

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

  // Validate and apply theme_id if provided
  if (theme_id !== undefined) {
    if (theme_id !== null) {
      const validThemeIds = BUILT_IN_THEMES.map((t) => t.id)
      if (typeof theme_id !== "string" || !validThemeIds.includes(theme_id)) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `theme_id must be one of: ${validThemeIds.join(", ")}.`,
              field: "theme_id",
            },
          },
          { status: 400 }
        )
      }
    }
    updates.theme_id = theme_id
  }

  // Validate and apply custom_theme if provided.
  // Shape: { primaryColor?: string (hex), gradient?: string (CSS background) }
  if (custom_theme !== undefined) {
    if (custom_theme !== null) {
      if (typeof custom_theme !== "object" || Array.isArray(custom_theme)) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "custom_theme must be an object.",
              field: "custom_theme",
            },
          },
          { status: 400 }
        )
      }
      const ct = custom_theme as Record<string, unknown>

      if (ct.primaryColor !== undefined && ct.primaryColor !== null) {
        if (
          typeof ct.primaryColor !== "string" ||
          !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(ct.primaryColor)
        ) {
          return NextResponse.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "custom_theme.primaryColor must be a hex colour (e.g. #7c3aed).",
                field: "custom_theme",
              },
            },
            { status: 400 }
          )
        }
      }

      if (ct.gradient !== undefined && ct.gradient !== null) {
        if (typeof ct.gradient !== "string" || ct.gradient.length > 500) {
          return NextResponse.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "custom_theme.gradient must be a CSS gradient string (max 500 chars).",
                field: "custom_theme",
              },
            },
            { status: 400 }
          )
        }
        // Basic safety: must start with linear-gradient/radial-gradient/conic-gradient
        if (!/^(linear|radial|conic)-gradient\s*\(/.test(ct.gradient)) {
          return NextResponse.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message:
                  "custom_theme.gradient must begin with linear-gradient(, radial-gradient(, or conic-gradient(.",
                field: "custom_theme",
              },
            },
            { status: 400 }
          )
        }
      }
    }
    updates.custom_theme = custom_theme
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

  // Check for truly active sessions (in-progress, not just lobby or ended)
  const activeStatuses = ["countdown", "question", "results", "leaderboard", "final_leaderboard"]
  const { data: activeSessions, error: sessionError } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("event_id", eventId)
    .in("status", activeStatuses)
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

  // End any stale lobby sessions before deleting the event
  await supabase
    .from("sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("status", "lobby")

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
