"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

/**
 * Client component that calls POST /api/v1/auth/logout and redirects to /login.
 */
export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" })
    } finally {
      router.push("/login")
      router.refresh()
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  )
}
