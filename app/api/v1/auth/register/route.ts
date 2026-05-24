import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/v1/auth/register
 *
 * Registers a new admin account.
 * - Returns 201 on success (email confirmation may be required)
 * - Returns 409 if the email is already in use (Requirement 1.6)
 * - Returns 400 for validation errors (password < 8 chars, missing fields)
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    )
  }

  const { email, password } = body as { email?: string; password?: string }

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Email is required.",
          field: "email",
        },
      },
      { status: 400 }
    )
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Password is required.",
          field: "password",
        },
      },
      { status: 400 }
    )
  }

  // Requirement 1.1: password must be at least 8 characters
  if (password.length < 8) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Password must be at least 8 characters.",
          field: "password",
        },
      },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    // Supabase returns "User already registered" for duplicate emails
    const isDuplicate =
      error.message.toLowerCase().includes("already registered") ||
      error.message.toLowerCase().includes("already exists") ||
      error.status === 422

    if (isDuplicate) {
      return NextResponse.json(
        {
          error: {
            code: "EMAIL_ALREADY_EXISTS",
            message: "An account with this email address already exists.",
          },
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: {
          code: "REGISTRATION_FAILED",
          message: "Registration failed. Please try again.",
        },
      },
      { status: 500 }
    )
  }

  // When email confirmation is enabled, data.user exists but session is null
  return NextResponse.json(
    {
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
      message:
        "Registration successful. Please check your email to confirm your account.",
    },
    { status: 201 }
  )
}
