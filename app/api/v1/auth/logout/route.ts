import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * POST /api/v1/auth/logout
 *
 * Signs the current admin out, invalidates the session token, and clears
 * auth cookies. Redirects to /login on success.
 *
 * Also ends all non-ended sessions belonging to this admin so participants
 * are disconnected and events can be deleted/unpublished freely.
 *
 * Requirement 1.7: invalidate session token upon explicit logout.
 */
export async function POST(_request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // End all active/lobby sessions for this admin before signing out
  if (user) {
    const serviceClient = createServiceClient()
    await serviceClient
      .from("sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("admin_id", user.id)
      .neq("status", "ended")
  }

  // Sign out — this invalidates the JWT and clears the httpOnly cookie
  // via @supabase/ssr's cookie handler
  const { error } = await supabase.auth.signOut()

  if (error) {
    return NextResponse.json(
      {
        error: {
          code: "LOGOUT_FAILED",
          message: "Failed to sign out. Please try again.",
        },
      },
      { status: 500 }
    )
  }

  // Redirect to login after successful logout
  return NextResponse.redirect(new URL("/login", _request.url))
}
