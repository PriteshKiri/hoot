"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  buildThemeStyle,
  resolveGradient,
  type CustomTheme,
} from "@/lib/themes"

type Event = {
  id: string
  title: string
  description: string | null
  status: "draft" | "published"
  created_at: string
  theme_id: string | null
  custom_theme: CustomTheme | null
}

interface EventCardProps {
  event: Event
}

/**
 * EventCard — dashboard tile for an event.
 *
 * Renders the event's saved theme (gradient header + primary colour) so each
 * card on the dashboard is visually branded. Inside the card we wrap content
 * in a div whose `style` sets `--primary` etc., so the action button picks up
 * the event's primary colour automatically via Tailwind's `bg-primary` class.
 *
 * Requirements: 2.5, 2.6, 2.7, 15.1, 15.6
 */
export function EventCard({ event }: EventCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const formattedDate = new Date(event.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  const themeInput = {
    themeId: event.theme_id,
    customTheme: event.custom_theme,
  }
  const themeStyle = buildThemeStyle(themeInput)
  const gradient = resolveGradient(themeInput)

  async function handleDelete() {
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return

    setDeleting(true)

    try {
      const res = await fetch(`/api/v1/events/${event.id}`, {
        method: "DELETE",
      })

      if (res.status === 204) {
        toast.success(`"${event.title}" deleted`)
        router.refresh()
        return
      }

      const body = await res.json()

      if (body?.error?.code === "SESSION_ACTIVE") {
        toast.error("Cannot delete event", {
          description:
            "An active session is running for this event. End it first.",
        })
      } else {
        toast.error(body?.error?.message ?? "Failed to delete event.")
      }
    } catch {
      toast.error("An unexpected error occurred.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card
      style={themeStyle}
      className="flex flex-col overflow-hidden group transition-shadow hover:shadow-lg"
    >
      {/* Themed gradient header */}
      <div
        className="relative h-24 px-4 py-3 flex items-start justify-between"
        style={{ background: gradient }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />
        <h3 className="relative text-base font-bold text-white leading-snug line-clamp-2 drop-shadow-sm pr-2">
          {event.title}
        </h3>
        <StatusBadge status={event.status} />
      </div>

      <CardContent className="flex-1 pt-4 pb-3">
        {event.description ? (
          <p className="text-sm text-foreground/80 line-clamp-2 mb-2">
            {event.description}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">Created {formattedDate}</p>
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        <Link
          href={`/events/${event.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors h-9"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          aria-label={`Delete event: ${event.title}`}
        >
          {deleting ? (
            <>
              <Spinner size="sm" />
              Deleting…
            </>
          ) : (
            <>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Delete</span>
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

function StatusBadge({ status }: { status: "draft" | "published" }) {
  if (status === "published") {
    return (
      <span className="relative inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-green-800 shrink-0 shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
        Published
      </span>
    )
  }
  return (
    <span className="relative inline-flex items-center rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-gray-700 shrink-0 shadow-sm">
      Draft
    </span>
  )
}
