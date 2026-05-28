import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { QuestionList } from "@/components/QuestionList"
import { PublishPanel } from "@/components/PublishPanel"
import type { Question } from "@/components/QuestionCard"
import { buildThemeStyle, resolveGradient, type CustomTheme } from "@/lib/themes"

type PageProps = { params: Promise<{ eventId: string }> }

/**
 * Event editor page — Server Component.
 *
 * Fetches the event and its questions (with answer_options) from Supabase.
 *
 * Layout: a themed hero spans the top, then a two-column grid on lg+ screens
 * with a sticky PublishPanel (join code, QR, share URL, publish/session
 * controls) on the left and the question list + past sessions on the right.
 * Below `lg` the columns stack so the publish panel appears first on mobile.
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

  const themeInput = {
    themeId: event.theme_id as string | null,
    customTheme: event.custom_theme as CustomTheme | null,
  }
  const themeStyle = buildThemeStyle(themeInput)
  const gradient = resolveGradient(themeInput)

  return (
    <div style={themeStyle} className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Themed hero header */}
      <div
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{ background: gradient }}
      >
        <div className="px-6 sm:px-8 py-7 flex items-start justify-between gap-4 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate drop-shadow-sm">
                {event.title}
              </h1>
              <StatusBadge status={event.status} />
            </div>
            {event.description && (
              <p className="text-white/90 text-sm sm:text-base line-clamp-2 drop-shadow-sm">
                {event.description}
              </p>
            )}
          </div>
          <Link
            href={`/events/${eventId}/edit`}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-white/15 backdrop-blur-sm border border-white/30 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            Theme &amp; Branding
          </Link>
        </div>
      </div>

      {/* Two-column layout: sticky publish panel on the left, questions on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Left column — share / publish / session controls */}
        <aside className="lg:sticky lg:top-6">
          <PublishPanel
            eventId={eventId}
            status={event.status}
            joinCode={event.join_code ?? null}
            activeSessionId={activeSessionId}
          />
        </aside>

        {/* Right column — questions and past sessions */}
        <div className="space-y-8 min-w-0">
          {/* Questions section */}
          <section className="space-y-4">
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
          </section>

          {/* Past sessions / analytics */}
          {endedSessions && endedSessions.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Past Sessions</h2>
              <div className="rounded-lg border divide-y bg-card">
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
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-green-800 shrink-0 shadow-sm">
        ● Published
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-gray-700 shrink-0 shadow-sm">
      Draft
    </span>
  )
}
