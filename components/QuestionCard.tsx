"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export type QuestionType =
  | "single_select"
  | "multi_select"
  | "open_text"
  | "rating_scale"
  | "image_choice"

export interface AnswerOption {
  id: string
  question_id: string
  position: number
  text: string | null
  image_url: string | null
  is_correct: boolean
  created_at: string
}

export interface Question {
  id: string
  event_id: string
  position: number
  question_type: QuestionType
  text: string
  image_url: string | null
  time_limit: number
  rating_min: number | null
  rating_max: number | null
  created_at: string
  updated_at: string
  answer_options: AnswerOption[]
}

interface QuestionCardProps {
  question: Question
  eventId: string
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_select: "Single Select",
  multi_select: "Multi Select",
  open_text: "Open Text",
  rating_scale: "Rating Scale",
  image_choice: "Image Choice",
}

const QUESTION_TYPE_COLORS: Record<QuestionType, string> = {
  single_select: "bg-blue-100 text-blue-800",
  multi_select: "bg-purple-100 text-purple-800",
  open_text: "bg-amber-100 text-amber-800",
  rating_scale: "bg-green-100 text-green-800",
  image_choice: "bg-pink-100 text-pink-800",
}

/**
 * QuestionCard — displays question text, type badge, time limit, and
 * edit/delete actions.
 *
 * Edit → /events/[eventId]/questions/[questionId]
 * Delete → DELETE /api/v1/events/[eventId]/questions/[questionId]
 *
 * Requirements: 2.3, 3.1–3.8
 */
export function QuestionCard({ question, eventId }: QuestionCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete this question? This cannot be undone.`)) return

    setDeleting(true)

    try {
      const res = await fetch(
        `/api/v1/events/${eventId}/questions/${question.id}`,
        { method: "DELETE" }
      )

      if (res.status === 204) {
        toast.success("Question deleted")
        router.refresh()
        return
      }

      const body = await res.json()
      toast.error(body?.error?.message ?? "Failed to delete question.")
    } catch {
      toast.error("An unexpected error occurred.")
    } finally {
      setDeleting(false)
    }
  }

  const typeLabel = QUESTION_TYPE_LABELS[question.question_type]
  const typeColor = QUESTION_TYPE_COLORS[question.question_type]

  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Position indicator */}
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground mt-0.5"
            aria-label={`Question ${question.position}`}
          >
            {question.position}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">
              {question.text}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {/* Type badge */}
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColor}`}
              >
                {typeLabel}
              </span>

              {/* Time limit */}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {question.time_limit}s
              </span>

              {/* Answer options count for choice types */}
              {question.answer_options.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {question.answer_options.length} option
                  {question.answer_options.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href={`/events/${eventId}/questions/${question.id}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label={`Edit question: ${question.text}`}
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
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={deleting}
              aria-label={`Delete question: ${question.text}`}
            >
              {deleting ? (
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
                  className="animate-spin"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
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
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
