import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { LogoutButton } from "@/components/LogoutButton"
import { SidebarNav } from "@/components/SidebarNav"

/** Maximum number of recent events to show in the sidebar before truncating. */
const SIDEBAR_EVENT_LIMIT = 6

/**
 * Dashboard layout — Server Component auth guard + sidebar nav.
 *
 * Redirects unauthenticated users to /login. Loads the admin's most recent
 * events and hands them to the client-side {@link SidebarNav}, which renders
 * the navigation links with active-state highlighting via `usePathname()`.
 *
 * Requirements: 2.7
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch the most recent events for the sidebar's quick-switcher.
  // We also grab the total count so we can render a "Show all (N)" link when
  // the user has more events than fit in the sidebar.
  const [{ data: recentEvents }, { count: totalEventCount }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, status, theme_id, custom_theme")
      .eq("admin_id", user.id)
      .order("created_at", { ascending: false })
      .limit(SIDEBAR_EVENT_LIMIT),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("admin_id", user.id),
  ])

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col shrink-0 sticky top-0 h-screen">
        {/* Logo / brand */}
        <div className="h-16 flex items-center px-6 border-b shrink-0">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-primary"
          >
            🦉 Hoot
          </Link>
        </div>

        <SidebarNav
          events={recentEvents ?? []}
          totalEventCount={totalEventCount ?? 0}
        />

        {/* User menu */}
        <div className="border-t px-4 py-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0"
              aria-hidden="true"
            >
              {user.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <p className="text-sm text-muted-foreground truncate" title={user.email ?? ""}>
              {user.email}
            </p>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
