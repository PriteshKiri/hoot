import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateSessionCsv } from "@/lib/analytics"

type RouteContext = { params: Promise<{ sessionId: string }> }

/**
 * GET /api/v1/analytics/[sessionId]/export
 *
 * Streams a CSV export of the session results.
 * Columns: Participant, Q1 score, Q2 score, ..., Total Score
 * Rows sorted by total score descending.
 * Authenticated admin only.
 *
 * Requirements: 13.3
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { sessionId } = await params

  const authClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    )
  }

  const csv = await generateSessionCsv(sessionId)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="session-${sessionId}-results.csv"`,
    },
  })
}
