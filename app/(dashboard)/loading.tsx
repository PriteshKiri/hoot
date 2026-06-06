import { LoadingScreen } from "@/components/ui/loading-screen"

/**
 * Route-level loading UI for all dashboard pages. Rendered inside the dashboard
 * layout (sidebar stays visible) while a page's server data is being fetched.
 */
export default function DashboardLoading() {
  return <LoadingScreen variant="section" label="Loading your dashboard…" />
}
