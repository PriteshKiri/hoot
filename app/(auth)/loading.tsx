import { LoadingScreen } from "@/components/ui/loading-screen"

/** Route-level loading UI for the auth pages (login, register, reset). */
export default function AuthLoading() {
  return <LoadingScreen variant="section" label="Loading…" />
}
