import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { EventCard } from "@/components/EventCard"

/**
 * Dashboard page — RSC that fetches and renders the admin's event list.
 *
 * Requirements: 2.7
 */
export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Layout already guards auth; this is a safety net for type narrowing.
  if (!user) return null

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("admin_id", user.id)
    .order("created_at", { ascending: false })

  const eventList = events ?? []

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your quiz events
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Create Event
        </Link>
      </div>

      {/* Event list */}
      {eventList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <div className="text-4xl mb-4" aria-hidden="true">🦉</div>
          <h2 className="text-lg font-semibold mb-2">No events yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Create your first quiz event to get started. You can add questions,
            publish it, and run live sessions.
          </p>
          <Link
            href="/events/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create your first event
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventList.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
