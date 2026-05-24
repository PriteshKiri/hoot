"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Event = {
  id: string
  title: string
  description: string | null
  status: "draft" | "published"
  created_at: string
}

interface EventCardProps {
  event: Event
}

/**
 * EventCard — displays event title, status badge, created date, and an
 * action menu with "Edit Questions" and "Delete" options.
 *
 * Requirements: 2.5, 2.6, 2.7
 */
export function EventCard({ event }: EventCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formattedDate = new Date(event.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  async function handleDelete() {
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return

    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/v1/events/${event.id}`, {
        method: "DELETE",
      })

      if (res.status === 204) {
        router.refresh()
        return
      }

      const body = await res.json()

      if (body?.error?.code === "SESSION_ACTIVE") {
        setError("Cannot delete: an active session is running for this event.")
      } else {
        setError(body?.error?.message ?? "Failed to delete event.")
      }
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug line-clamp-2">
            {event.title}
          </CardTitle>
          <StatusBadge status={event.status} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        <p className="text-xs text-muted-foreground">Created {formattedDate}</p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        <Link
          href={`/events/${event.id}`}
          className="flex-1 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors h-9"
        >
          Edit Questions
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          aria-label={`Delete event: ${event.title}`}
        >
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </CardFooter>
    </Card>
  )
}

function StatusBadge({ status }: { status: "draft" | "published" }) {
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
