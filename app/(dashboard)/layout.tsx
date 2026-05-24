import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { LogoutButton } from "@/components/LogoutButton"

/**
 * Dashboard layout — Server Component auth guard + sidebar nav.
 *
 * Redirects unauthenticated users to /login.
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

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        {/* Logo / brand */}
        <div className="h-16 flex items-center px-6 border-b">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-primary"
          >
            🦉 Hoot
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-4 py-6 space-y-1" aria-label="Main navigation">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
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
        </nav>

        {/* User menu */}
        <div className="border-t px-4 py-4">
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
