"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { resolveGradient, type CustomTheme } from "@/lib/themes"

type SidebarEvent = {
  id: string
  title: string
  status: "draft" | "published" | string
  theme_id: string | null
  custom_theme: CustomTheme | null
}

interface SidebarNavProps {
  events: SidebarEvent[]
  /** Total number of events the user has, used to render a "Show all" link when truncated. */
  totalEventCount: number
}

/**
 * SidebarNav — client component for the dashboard layout sidebar.
 *
 * Renders the Dashboard link plus a recent-events list, highlighting whichever
 * route is currently active. Uses `usePathname()` for active state so it stays
 * a thin client island around the otherwise-server layout.
 */
export function SidebarNav({ events, totalEventCount }: SidebarNavProps) {
  const pathname = usePathname() ?? ""
  const isDashboardActive = pathname === "/dashboard"

  return (
    <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto" aria-label="Main navigation">
      {/* Top-level nav */}
      <div className="space-y-1">
        <Link
          href="/dashboard"
          aria-current={isDashboardActive ? "page" : undefined}
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isDashboardActive
              ? "bg-accent text-accent-foreground"
              : "text-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
          Dashboard
        </Link>
      </div>

      {/* Events section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Events
          </h2>
          <Link
            href="/events/new"
            aria-label="Create new event"
            title="Create new event"
            className="text-muted-foreground hover:text-foreground transition-colors -mr-1 rounded p-0.5 hover:bg-accent"
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
          </Link>
        </div>

        {events.length === 0 ? (
          <p className="px-3 text-xs text-muted-foreground">
            No events yet.{" "}
            <Link href="/events/new" className="text-primary hover:underline">
              Create one
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-0.5">
            {events.map((event) => {
              const href = `/events/${event.id}`
              const isActive = pathname.startsWith(href)
              const gradient = resolveGradient({
                themeId: event.theme_id,
                customTheme: event.custom_theme,
              })
              return (
                <li key={event.id}>
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    title={event.title}
                    className={`group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-black/5"
                      style={{ background: gradient }}
                    />
                    <span className="truncate flex-1">{event.title}</span>
                    {event.status === "published" && (
                      <span
                        aria-label="Published"
                        title="Published"
                        className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0"
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {totalEventCount > events.length && (
          <Link
            href="/dashboard"
            className="block px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Show all ({totalEventCount}) →
          </Link>
        )}
      </div>
    </nav>
  )
}
