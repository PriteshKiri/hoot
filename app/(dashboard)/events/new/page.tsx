"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Create Event page — Client Component form.
 *
 * On submit: POST /api/v1/events, then redirect to /events/[newId].
 * Shows inline validation errors.
 *
 * Requirements: 2.1, 2.2, 2.4
 */
export default function NewEventPage() {
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  const [errors, setErrors] = useState<{
    title?: string
    description?: string
    general?: string
  }>({})

  function validate(): boolean {
    const next: typeof errors = {}

    if (!title.trim()) {
      next.title = "Title is required."
    } else if (title.trim().length > 100) {
      next.title = "Title must be 100 characters or fewer."
    }

    if (description.length > 500) {
      next.description = "Description must be 500 characters or fewer."
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)
    setErrors({})

    try {
      const res = await fetch("/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      })

      const body = await res.json()

      if (!res.ok) {
        const apiError = body?.error

        if (apiError?.code === "DUPLICATE_EVENT_TITLE") {
          setErrors({ title: "An event with this title already exists." })
        } else if (apiError?.field === "title") {
          setErrors({ title: apiError.message })
        } else if (apiError?.field === "description") {
          setErrors({ description: apiError.message })
        } else {
          const msg = apiError?.message ?? "Failed to create event."
          setErrors({ general: msg })
          toast.error(msg)
        }
        return
      }

      toast.success("Event created", {
        description: `"${body.event.title}" is ready to edit.`,
      })
      router.push(`/events/${body.event.id}`)
    } catch {
      const msg = "An unexpected error occurred. Please try again."
      setErrors({ general: msg })
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Event</CardTitle>
          <CardDescription>
            Give your quiz event a title and an optional description.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-5">
            {errors.general && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {errors.general}
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                type="text"
                placeholder="e.g. Team Trivia Night"
                maxLength={100}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-describedby={errors.title ? "title-error" : undefined}
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <p id="title-error" role="alert" className="text-sm text-destructive">
                  {errors.title}
                </p>
              )}
              <p className="text-xs text-muted-foreground text-right">
                {title.length}/100
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <textarea
                id="description"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="A short description of your event…"
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-describedby={errors.description ? "description-error" : undefined}
                aria-invalid={!!errors.description}
              />
              {errors.description && (
                <p id="description-error" role="alert" className="text-sm text-destructive">
                  {errors.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground text-right">
                {description.length}/500
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creating…" : "Create Event"}
            </Button>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Cancel
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
