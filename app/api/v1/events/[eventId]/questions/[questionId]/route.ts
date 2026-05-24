import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ eventId: string; questionId: string }> }

const CHOICE_TYPES = ["single_select", "multi_select", "image_choice"] as const
const CORRECT_REQUIRED_TYPES = ["single_select", "multi_select"] as const
const VALID_QUESTION_TYPES = [
  "single_select",
  "multi_select",
  "open_text",
  "rating_scale",
  "image_choice",
] as const

type QuestionType = (typeof VALID_QUESTION_TYPES)[number]

interface AnswerOptionInput {
  text?: string | null
  image_url?: string | null
  is_correct?: boolean
  position?: number
}

interface QuestionPatchBody {
  question_type?: unknown
  text?: unknown
  time_limit?: unknown
  image_url?: unknown
  rating_min?: unknown
  rating_max?: unknown
  answer_options?: unknown
}

/**
 * Validates a full question body (used for PATCH with all fields present).
 * Returns a structured error or the validated fields.
 */
function validateFullQuestionBody(body: QuestionPatchBody): {
  error?: { code: string; message: string; field?: string }
  validated?: {
    question_type: QuestionType
    text: string
    time_limit: number
    image_url: string | null
    rating_min: number | null
    rating_max: number | null
    answer_options: AnswerOptionInput[]
  }
} {
  const { question_type, text, time_limit, image_url, rating_min, rating_max, answer_options } =
    body

  // question_type
  if (!question_type || !VALID_QUESTION_TYPES.includes(question_type as QuestionType)) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: `question_type must be one of: ${VALID_QUESTION_TYPES.join(", ")}.`,
        field: "question_type",
      },
    }
  }
  const qType = question_type as QuestionType

  // text
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Question text is required.",
        field: "text",
      },
    }
  }
  const trimmedText = text.trim()
  if (trimmedText.length > 255) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Question text must be 255 characters or fewer.",
        field: "text",
      },
    }
  }

  // time_limit
  let timeLimitValue = 20
  if (time_limit !== undefined && time_limit !== null) {
    if (typeof time_limit !== "number" || !Number.isInteger(time_limit)) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "time_limit must be an integer.",
          field: "time_limit",
        },
      }
    }
    if (time_limit < 5 || time_limit > 120) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "time_limit must be between 5 and 120 seconds.",
          field: "time_limit",
        },
      }
    }
    timeLimitValue = time_limit
  }

  // image_url
  const imageUrlValue =
    image_url !== undefined && image_url !== null
      ? typeof image_url === "string"
        ? image_url
        : null
      : null

  // rating_scale validation
  let ratingMinValue: number | null = null
  let ratingMaxValue: number | null = null

  if (qType === "rating_scale") {
    if (rating_min === undefined || rating_min === null) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "rating_min is required for rating_scale questions.",
          field: "rating_min",
        },
      }
    }
    if (rating_max === undefined || rating_max === null) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "rating_max is required for rating_scale questions.",
          field: "rating_max",
        },
      }
    }
    if (
      typeof rating_min !== "number" ||
      !Number.isInteger(rating_min) ||
      rating_min < 1 ||
      rating_min > 10
    ) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "rating_min must be an integer between 1 and 10.",
          field: "rating_min",
        },
      }
    }
    if (
      typeof rating_max !== "number" ||
      !Number.isInteger(rating_max) ||
      rating_max < 1 ||
      rating_max > 10
    ) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "rating_max must be an integer between 1 and 10.",
          field: "rating_max",
        },
      }
    }
    if (rating_min >= rating_max) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "rating_min must be less than rating_max.",
          field: "rating_min",
        },
      }
    }
    ratingMinValue = rating_min
    ratingMaxValue = rating_max
  }

  // answer_options validation for choice types
  let optionsValue: AnswerOptionInput[] = []

  if (CHOICE_TYPES.includes(qType as (typeof CHOICE_TYPES)[number])) {
    if (!Array.isArray(answer_options)) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "answer_options must be an array for choice question types.",
          field: "answer_options",
        },
      }
    }
    if (answer_options.length < 2 || answer_options.length > 4) {
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "answer_options must have between 2 and 4 items.",
          field: "answer_options",
        },
      }
    }

    if (CORRECT_REQUIRED_TYPES.includes(qType as (typeof CORRECT_REQUIRED_TYPES)[number])) {
      const hasCorrect = (answer_options as AnswerOptionInput[]).some(
        (opt) => opt.is_correct === true
      )
      if (!hasCorrect) {
        return {
          error: {
            code: "VALIDATION_ERROR",
            message: "At least one answer option must be marked as correct.",
            field: "answer_options",
          },
        }
      }
    }

    optionsValue = answer_options as AnswerOptionInput[]
  }

  return {
    validated: {
      question_type: qType,
      text: trimmedText,
      time_limit: timeLimitValue,
      image_url: imageUrlValue,
      rating_min: ratingMinValue,
      rating_max: ratingMaxValue,
      answer_options: optionsValue,
    },
  }
}

/**
 * GET /api/v1/events/[eventId]/questions/[questionId]
 *
 * Returns a single question with its answer_options.
 *
 * Requirements: 3.1–3.8
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { eventId, questionId } = await params
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

  // Verify event belongs to this admin
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .single()

  if (eventError || !event) {
    return NextResponse.json(
      { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } },
      { status: 404 }
    )
  }

  const { data: question, error } = await supabase
    .from("questions")
    .select("*, answer_options(*)")
    .eq("id", questionId)
    .eq("event_id", eventId)
    .single()

  if (error || !question) {
    return NextResponse.json(
      { error: { code: "QUESTION_NOT_FOUND", message: "Question not found." } },
      { status: 404 }
    )
  }

  return NextResponse.json({ question })
}

/**
 * PATCH /api/v1/events/[eventId]/questions/[questionId]
 *
 * Updates a question and replaces its answer_options.
 * Applies the same validation rules as POST.
 *
 * Requirements: 3.1–3.8
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { eventId, questionId } = await params
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

  // Verify event belongs to this admin
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .single()

  if (eventError || !event) {
    return NextResponse.json(
      { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } },
      { status: 404 }
    )
  }

  // Verify question exists and belongs to this event
  const { data: existing, error: fetchError } = await supabase
    .from("questions")
    .select("id")
    .eq("id", questionId)
    .eq("event_id", eventId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: { code: "QUESTION_NOT_FOUND", message: "Question not found." } },
      { status: 404 }
    )
  }

  let body: QuestionPatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    )
  }

  const { error: validationError, validated } = validateFullQuestionBody(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const { question_type, text, time_limit, image_url, rating_min, rating_max, answer_options } =
    validated!

  // Update question
  const { data: question, error: updateError } = await supabase
    .from("questions")
    .update({
      question_type,
      text,
      time_limit,
      image_url,
      rating_min,
      rating_max,
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId)
    .eq("event_id", eventId)
    .select()
    .single()

  if (updateError || !question) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: "Failed to update question." } },
      { status: 500 }
    )
  }

  // Replace answer_options: delete existing, insert new ones
  const { error: deleteOptionsError } = await supabase
    .from("answer_options")
    .delete()
    .eq("question_id", questionId)

  if (deleteOptionsError) {
    return NextResponse.json(
      { error: { code: "UPDATE_FAILED", message: "Failed to update answer options." } },
      { status: 500 }
    )
  }

  let updatedOptions: unknown[] = []
  if (answer_options.length > 0) {
    const optionsToInsert = answer_options.map((opt, idx) => ({
      question_id: questionId,
      position: opt.position ?? idx + 1,
      text: opt.text ?? null,
      image_url: opt.image_url ?? null,
      is_correct: opt.is_correct ?? false,
    }))

    const { data: options, error: insertOptionsError } = await supabase
      .from("answer_options")
      .insert(optionsToInsert)
      .select()

    if (insertOptionsError) {
      return NextResponse.json(
        { error: { code: "UPDATE_FAILED", message: "Failed to insert updated answer options." } },
        { status: 500 }
      )
    }

    updatedOptions = options ?? []
  }

  return NextResponse.json({ question, answer_options: updatedOptions })
}

/**
 * DELETE /api/v1/events/[eventId]/questions/[questionId]
 *
 * Deletes a question. answer_options are cascade-deleted via FK.
 *
 * Requirements: 3.1–3.8
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { eventId, questionId } = await params
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

  // Verify event belongs to this admin
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .single()

  if (eventError || !event) {
    return NextResponse.json(
      { error: { code: "EVENT_NOT_FOUND", message: "Event not found." } },
      { status: 404 }
    )
  }

  // Verify question exists and belongs to this event
  const { data: question, error: fetchError } = await supabase
    .from("questions")
    .select("id")
    .eq("id", questionId)
    .eq("event_id", eventId)
    .single()

  if (fetchError || !question) {
    return NextResponse.json(
      { error: { code: "QUESTION_NOT_FOUND", message: "Question not found." } },
      { status: 404 }
    )
  }

  const { error: deleteError } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId)
    .eq("event_id", eventId)

  if (deleteError) {
    return NextResponse.json(
      { error: { code: "DELETE_FAILED", message: "Failed to delete question." } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
