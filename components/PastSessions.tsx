"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"

export interface PastSession {
  id: string
  ended_at: string | null
}

interface PastSessionsProps {
  eventId: string
  sessions: PastSession[]
}

/**
 * PastSessions — Client Component
 *
 * Lists a few of the most recent ended sessions for an event with links to
 * their analytics and a delete action.
 *
 * Date/time is formatted on the client so it uses the viewer's local timezone.
 * (A Server Component would format using the server's timezone — typically UTC
 * on the host — which made the displayed time wrong even though the date looked
 * right.)
 */
export function PastSessions({ eventId, sessions }: PastSessionsProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(sessionId: string) {
    if (
      !confirm(
        "Delete this session and its analytics? This cannot be undone."
      )
    ) {
      return
    }
    setDeletingId(sessionId)
    try {
      const res = await fetch(`/api/v1/analytics/${sessionId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error?.message ?? "Failed to delete session.")
        return
      }
      toast.success("Session deleted")
      router.refresh()
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  if (sessions.length === 0) return null

  return (
    <div className="rounded-lg border divide-y bg-card">
      {sessions.map((session, i) => {
        const endedAt = session.ended_at
          ? new Date(session.ended_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "Unknown"
        const deleting = deletingId === session.id
        return (
          <div
            key={session.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">Session {sessions.length - i}</p>
              <p className="text-xs text-muted-foreground">Ended {endedAt}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/events/${eventId}/analytics/${session.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                View Analytics
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(session.id)}
                disabled={deleting}
                aria-label={`Delete session ${sessions.length - i}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
              >
                {deleting ? (
                  <Spinner size="sm" className="text-destructive" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                )}
                Delete
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
