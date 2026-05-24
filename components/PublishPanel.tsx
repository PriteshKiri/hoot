"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { QRCodeDisplay } from "@/components/QRCodeDisplay"
import { Button } from "@/components/ui/button"

interface PublishPanelProps {
  eventId: string
  status: "draft" | "published" | string
  joinCode: string | null
}

/**
 * PublishPanel — Client Component
 *
 * Shown on the event editor page. Handles publish/unpublish actions and
 * displays the join code, QR code, and shareable URL when published.
 *
 * Requirements: 4.3, 4.4
 */
export function PublishPanel({ eventId, status, joinCode }: PublishPanelProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const joinUrl = joinCode ? `https://hoot.com/join/${joinCode}` : null

  async function handlePublish() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/events/${eventId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error?.message ?? "Failed to publish event.")
      } else {
        router.refresh()
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleUnpublish() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/events/${eventId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error?.message ?? "Failed to unpublish event.")
      } else {
        router.refresh()
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleStartSession() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error?.message ?? "Failed to start session.")
      } else {
        router.push(`/sessions/${data.session.id}/present`)
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Publish</h2>

      {error && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {status !== "published" ? (
        // ── Draft state ──────────────────────────────────────────────────
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Publishing generates a join code and QR code so participants can join.
          </p>
          <Button
            onClick={handlePublish}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? "Publishing…" : "Publish Event"}
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
                  onClick={() => navigator.clipboard.writeText(joinUrl)}
                  className="shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                  aria-label="Copy shareable URL to clipboard"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              onClick={handleStartSession}
              disabled={loading}
              className="bg-primary text-primary-foreground"
            >
              {loading ? "Starting…" : "Start Session"}
            </Button>
            <Button
              variant="outline"
              onClick={handleUnpublish}
              disabled={loading}
            >
              {loading ? "Unpublishing…" : "Unpublish"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
