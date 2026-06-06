import * as React from "react"

import { cn } from "@/lib/utils"

export interface LoadingScreenProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Message shown beneath the animated owl. */
  label?: string
  /** Optional secondary line of helper text. */
  hint?: string
  /**
   * Layout mode:
   * - `page` (default): fills the viewport height, for route/page level loads.
   * - `section`: fills its container, for in-card / partial loads.
   * - `overlay`: fixed full-screen layer above all content (e.g. redirecting).
   */
  variant?: "page" | "section" | "overlay"
  /** Emoji shown inside the spinner ring. Defaults to the Hoot owl. */
  emoji?: string
}

/**
 * Branded, full-area loading state: a gently bobbing owl framed by a spinning
 * ring, with an optional message and hint. Use anywhere the app is waiting on
 * data or a navigation so users always see motion instead of a blank screen.
 */
export function LoadingScreen({
  label = "Loading…",
  hint,
  variant = "page",
  emoji = "🦉",
  className,
  ...props
}: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-5 bg-background px-4 text-center",
        variant === "page" && "min-h-[100dvh] w-full",
        variant === "section" && "min-h-[50vh] w-full",
        variant === "overlay" && "fixed inset-0 z-50",
        className
      )}
      {...props}
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
        />
        <span aria-hidden="true" className="animate-bob text-3xl">
          {emoji}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}
