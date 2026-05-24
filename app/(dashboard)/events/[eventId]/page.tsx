import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { QuestionList } from "@/components/QuestionList"
import { PublishPanel } from "@/components/PublishPanel"
import type { Question } from "@/components/QuestionCard"

type PageProps = { params: Promise<{ eventId: string }> }

/**
 * Event editor page — Server Component.
 *
 * Fetches the event and its questions (with answer_options) from Supabase.
 * Renders the question list, an "Add Question" button, and the PublishPanel
 * which handles publish/unpublish and session start.
 *
 * Requirements: 2.3, 3.1–3.8, 4.3, 4.4
 */
export default async function EventEditorPage({ params }: PageProps) {
  const { eventId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch event — RLS ensures it belongs to this admin
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("admin_id", user.id)
    .single()

  if (eventError || !event) {
    notFound()
  }

  // Fetch questions with answer_options, ordered by position
  const { data: questions } = await supabase
    .from("questions")
    .select("*, answer_options(*)")
    .eq("event_id", eventId)
    .order("position", { ascending: true })

  const questionList = (questions ?? []) as Question[]

  // Check for an existing non-ended session (lobby or in-progress)
  const { data: activeSession } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("event_id", eventId)
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const activeSessionId = activeSession?.id ?? null

  // Fetch ended sessions for analytics links
  const { data: endedSessions } = await supabase
    .from("sessions")
    .select("id, created_at, ended_at")
    .eq("event_id", eventId)
    .eq("status", "ended")
    .order("ended_at", { ascending: false })
    .limit(5)

  return (
    <div className="p-8 max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight truncate">{event.title}</h1>
            <StatusBadge status={event.status} />
          </div>
          {event.description && (
            <p className="text-muted-foreground text-sm line-clamp-2">{event.description}</p>
          )}
        </div>
        {/* Theme / branding settings */}
        <Link
          href={`/events/${eventId}/edit`}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
          Theme &amp; Branding
        </Link>
      </div>

      {/* Publish panel */}
      <PublishPanel
        eventId={eventId}
        status={event.status}
        joinCode={event.join_code ?? null}
        activeSessionId={activeSessionId}
      />

      {/* Questions section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Questions
            {questionList.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({questionList.length})
              </span>
            )}
          </h2>

          <Link
            href={`/events/${eventId}/questions/new`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Question
          </Link>
        </div>

        <QuestionList questions={questionList} eventId={eventId} />
      </div>

      {/* Past sessions / analytics */}
      {endedSessions && endedSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Past Sessions</h2>
          <div className="rounded-lg border divide-y">
            {endedSessions.map((session, i) => {
              const endedAt = session.ended_at
                ? new Date(session.ended_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Unknown"
              return (
                <div key={session.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Session {endedSessions.length - i}</p>
                    <p className="text-xs text-muted-foreground">Ended {endedAt}</p>
                  </div>
                  <Link
                    href={`/events/${eventId}/analytics/${session.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="20" x2="18" y2="10"/>
                      <line x1="12" y1="20" x2="12" y2="4"/>
                      <line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                    View Analytics
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 shrink-0">
        Published
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 shrink-0">
      Draft
    </span>
  )
}
