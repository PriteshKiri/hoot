import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/v1/events
 *
 * Returns all events owned by the authenticated admin, ordered by
 * created_at DESC.
 *
 * Requirements: 2.7
 */
export async function GET(_request: NextRequest) {
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

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("admin_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json(
      {
        error: {
          code: "FETCH_FAILED",
          message: "Failed to fetch events. Please try again.",
        },
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ events })
}

/**
 * POST /api/v1/events
 *
 * Creates a new event in Draft state.
 * - Validates title [1–100 chars] and description [≤500 chars]
 * - Enforces unique title per admin (case-insensitive)
 * - Returns 201 on success
 * - Returns 409 DUPLICATE_EVENT_TITLE on duplicate
 * - Returns 400 on validation error
 *
 * Requirements: 2.1, 2.2, 2.4
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

  const { title, description } = body as { title?: unknown; description?: unknown }

  // Validate title
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Title is required.",
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

  // Validate description
  if (description !== undefined && description !== null) {
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

  // Insert — the unique index events_admin_title_unique (admin_id, lower(title))
  // will reject duplicates at the DB level; we also get a clean 409 from that.
  const { data: event, error: insertError } = await supabase
    .from("events")
    .insert({
      admin_id: user.id,
      title: trimmedTitle,
      description: description ?? null,
      status: "draft",
    })
    .select()
    .single()

  if (insertError) {
    // Postgres unique violation code is 23505
    if (
      insertError.code === "23505" ||
      insertError.message?.toLowerCase().includes("unique") ||
      insertError.message?.toLowerCase().includes("duplicate")
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
          code: "CREATE_FAILED",
          message: "Failed to create event. Please try again.",
        },
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ event }, { status: 201 })
}
