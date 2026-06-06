"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { QRCodeDisplay } from "@/components/QRCodeDisplay"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

interface PublishPanelProps {
  eventId: string
  status: "draft" | "published" | string
  joinCode: string | null
  /** ID of an existing non-ended session, if any */
  activeSessionId?: string | null
}

/**
 * PublishPanel — Client Component
 *
 * Shown on the event editor page. Handles publish/unpublish actions and
 * displays the join code, QR code, and shareable URL when published.
 *
 * Requirements: 4.3, 4.4
 */
export function PublishPanel({ eventId, status, joinCode, activeSessionId: initialActiveSessionId }: PublishPanelProps) {
  const router = useRouter()
  const [publishLoading, setPublishLoading] = useState(false)
  const [unpublishLoading, setUnpublishLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [stopLoading, setStopLoading] = useState(false)
  // Track activeSessionId in local state so ending a session updates the UI immediately
  const [activeSessionId, setActiveSessionId] = useState<string | null | undefined>(initialActiveSessionId)

  const joinUrl = joinCode
    ? `${typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/join/${joinCode}`
    : null

  async function handlePublish() {
    setPublishLoading(true)
    try {
      const res = await fetch(`/api/v1/events/${eventId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Failed to publish event.")
      } else {
        toast.success("Event published", {
          description: "Participants can now join with the code.",
        })
        router.refresh()
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setPublishLoading(false)
    }
  }

  async function handleUnpublish() {
    setUnpublishLoading(true)
    try {
      const res = await fetch(`/api/v1/events/${eventId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Failed to unpublish event.")
      } else {
        toast.success("Event unpublished")
        router.refresh()
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setUnpublishLoading(false)
    }
  }

  async function handleStartSession() {
    setSessionLoading(true)
    try {
      const res = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Failed to start session.")
      } else {
        toast.success("Session started")
        setActiveSessionId(data.session.id)
        router.push(`/sessions/${data.session.id}/present`)
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setSessionLoading(false)
    }
  }

  function handleResumeSession() {
    if (activeSessionId) {
      router.push(`/sessions/${activeSessionId}/present`)
    }
  }

  async function handleStopSession() {
    if (!activeSessionId) return
    if (!confirm("Are you sure you want to end this session? This cannot be undone.")) return
    setStopLoading(true)
    try {
      const res = await fetch(`/api/v1/sessions/${activeSessionId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error?.message ?? "Failed to end session.")
      } else {
        toast.success("Session ended")
        // Clear local state immediately so the UI updates without waiting for a server round-trip
        setActiveSessionId(null)
        router.refresh()
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setStopLoading(false)
    }
  }

  async function handleCopyJoinUrl() {
    if (!joinUrl) return
    try {
      await navigator.clipboard.writeText(joinUrl)
      toast.success("Link copied to clipboard")
    } catch {
      toast.error("Failed to copy link.")
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Publish</h2>

      {status !== "published" ? (
        // ── Draft state ──────────────────────────────────────────────────
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Publishing generates a join code and QR code so participants can join.
          </p>
          <Button
            onClick={handlePublish}
            disabled={publishLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {publishLoading ? (
              <>
                <Spinner size="sm" className="text-white" />
                Publishing…
              </>
            ) : (
              "Publish Event"
            )}
          </Button>
        </div>
      ) : (
        // ── Published state ───────────────────────────────────────────────
        <div className="space-y-5">
          {/* Join code */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Join Code
            </p>
            <p
              className="text-3xl font-bold tracking-widest font-mono"
              aria-label={`Join code: ${joinCode}`}
            >
              {joinCode}
            </p>
          </div>

          {/* QR code */}
          {joinUrl && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                QR Code
              </p>
              <QRCodeDisplay
                url={joinUrl}
                size={200}
                alt={`QR code for joining event with code ${joinCode}`}
              />
              <a
                href={joinUrl}
                download="hoot-qr.png"
                className="inline-block text-xs text-primary hover:underline"
                aria-label="Download QR code image"
              >
                Download QR code
              </a>
            </div>
          )}

          {/* Shareable URL */}
          {joinUrl && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Shareable URL
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-1.5 text-sm font-mono break-all">
                  {joinUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopyJoinUrl}
                  className="shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                  aria-label="Copy shareable URL to clipboard"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Active session notice */}
          {activeSessionId && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              A session is already in progress.{" "}
              <button
                type="button"
                onClick={handleResumeSession}
                className="font-semibold underline hover:no-underline"
              >
                Resume session →
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-1">
            {activeSessionId ? (
              <>
                <Button
                  onClick={handleResumeSession}
                  className="bg-primary text-primary-foreground"
                >
                  Resume Session
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleStopSession}
                  disabled={stopLoading}
                >
                  {stopLoading ? (
                    <>
                      <Spinner size="sm" className="text-destructive-foreground" />
                      Ending…
                    </>
                  ) : (
                    "End Session"
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleStartSession}
                disabled={sessionLoading}
                className="bg-primary text-primary-foreground"
              >
                {sessionLoading ? (
                  <>
                    <Spinner size="sm" className="text-primary-foreground" />
                    Starting…
                  </>
                ) : (
                  "Start Session"
                )}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleUnpublish}
              disabled={unpublishLoading || !!activeSessionId}
              title={activeSessionId ? "End the active session before unpublishing" : undefined}
            >
              {unpublishLoading ? (
                <>
                  <Spinner size="sm" />
                  Unpublishing…
                </>
              ) : (
                "Unpublish"
              )}
            </Button>
          </div>

          {activeSessionId && (
            <p className="text-xs text-muted-foreground">
              End the active session to unpublish or delete this event.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
