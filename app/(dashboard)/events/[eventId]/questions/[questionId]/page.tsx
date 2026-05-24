"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { QuestionTypeSelector } from "@/components/QuestionTypeSelector"
import { AnswerOptionEditor, type AnswerOptionDraft } from "@/components/AnswerOptionEditor"
import type { QuestionType } from "@/components/QuestionCard"

const CHOICE_TYPES: QuestionType[] = ["single_select", "multi_select", "image_choice"]
const CORRECT_REQUIRED_TYPES: QuestionType[] = ["single_select", "multi_select"]

interface FormErrors {
  question_type?: string
  text?: string
  time_limit?: string
  answer_options?: string
  rating_min?: string
  rating_max?: string
  general?: string
}

/**
 * Edit Question page — Client Component.
 *
 * Fetches existing question data from GET /api/v1/events/[eventId]/questions/[questionId],
 * pre-populates the form, and on submit sends PATCH to the same endpoint.
 * On success: redirect to /events/[eventId]
 *
 * Requirements: 2.3, 3.1–3.8
 */
export default function EditQuestionPage() {
  const router = useRouter()
  const params = useParams<{ eventId: string; questionId: string }>()
  const { eventId, questionId } = params

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [questionType, setQuestionType] = useState<QuestionType>("single_select")
  const [text, setText] = useState("")
  const [timeLimit, setTimeLimit] = useState(20)
  const [answerOptions, setAnswerOptions] = useState<AnswerOptionDraft[]>([
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ])
  const [ratingMin, setRatingMin] = useState(1)
  const [ratingMax, setRatingMax] = useState(5)
  const [errors, setErrors] = useState<FormErrors>({})

  const isChoiceType = CHOICE_TYPES.includes(questionType)
  const isRatingScale = questionType === "rating_scale"

  // Fetch existing question data on mount
  useEffect(() => {
    async function fetchQuestion() {
      try {
        const res = await fetch(`/api/v1/events/${eventId}/questions/${questionId}`)
        if (!res.ok) {
          const body = await res.json()
          setFetchError(body?.error?.message ?? "Failed to load question.")
          return
        }

        const body = await res.json()
        const q = body.question

        setQuestionType(q.question_type as QuestionType)
        setText(q.text ?? "")
        setTimeLimit(q.time_limit ?? 20)

        if (q.rating_min != null) setRatingMin(q.rating_min)
        if (q.rating_max != null) setRatingMax(q.rating_max)

        if (Array.isArray(q.answer_options) && q.answer_options.length > 0) {
          const sorted = [...q.answer_options].sort(
            (a: { position: number }, b: { position: number }) => a.position - b.position
          )
          setAnswerOptions(
            sorted.map((opt: { text: string | null; is_correct: boolean }) => ({
              text: opt.text ?? "",
              is_correct: opt.is_correct ?? false,
            }))
          )
        }
      } catch {
        setFetchError("An unexpected error occurred while loading the question.")
      } finally {
        setFetching(false)
      }
    }

    fetchQuestion()
  }, [eventId, questionId])

  function validate(): boolean {
    const next: FormErrors = {}

    if (!text.trim()) {
      next.text = "Question text is required."
    } else if (text.trim().length > 255) {
      next.text = "Question text must be 255 characters or fewer."
    }

    if (!Number.isInteger(timeLimit) || timeLimit < 5 || timeLimit > 120) {
      next.time_limit = "Time limit must be between 5 and 120 seconds."
    }

    if (isChoiceType) {
      if (answerOptions.length < 2 || answerOptions.length > 4) {
        next.answer_options = "You must have between 2 and 4 answer options."
      } else if (CORRECT_REQUIRED_TYPES.includes(questionType)) {
        const hasCorrect = answerOptions.some((o) => o.is_correct)
        if (!hasCorrect) {
          next.answer_options = "At least one answer option must be marked as correct."
        }
      }
    }

    if (isRatingScale) {
      if (!Number.isInteger(ratingMin) || ratingMin < 1 || ratingMin > 10) {
        next.rating_min = "Rating minimum must be between 1 and 10."
      }
      if (!Number.isInteger(ratingMax) || ratingMax < 1 || ratingMax > 10) {
        next.rating_max = "Rating maximum must be between 1 and 10."
      }
      if (!next.rating_min && !next.rating_max && ratingMin >= ratingMax) {
        next.rating_min = "Rating minimum must be less than the maximum."
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleTypeChange(type: QuestionType) {
    setQuestionType(type)
    setErrors({})
    if (CHOICE_TYPES.includes(type) && answerOptions.length < 2) {
      setAnswerOptions([
        { text: "", is_correct: false },
        { text: "", is_correct: false },
      ])
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setErrors({})

    const payload: Record<string, unknown> = {
      question_type: questionType,
      text: text.trim(),
      time_limit: timeLimit,
    }

    if (isChoiceType) {
      payload.answer_options = answerOptions.map((opt, idx) => ({
        text: opt.text || null,
        is_correct: opt.is_correct,
        position: idx + 1,
      }))
    }

    if (isRatingScale) {
      payload.rating_min = ratingMin
      payload.rating_max = ratingMax
    }

    try {
      const res = await fetch(`/api/v1/events/${eventId}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const body = await res.json()

      if (!res.ok) {
        const apiError = body?.error
        if (apiError?.field) {
          setErrors({ [apiError.field]: apiError.message })
        } else {
          setErrors({ general: apiError?.message ?? "Failed to update question." })
        }
        return
      }

      router.push(`/events/${eventId}`)
    } catch {
      setErrors({ general: "An unexpected error occurred. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="mb-6">
          <Link
            href={`/events/${eventId}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Event
          </Link>
        </div>
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Loading question…
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="mb-6">
          <Link
            href={`/events/${eventId}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Event
          </Link>
        </div>
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {fetchError}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/events/${eventId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Event
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Question</CardTitle>
          <CardDescription>Update the question details below.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-6">
            {errors.general && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {errors.general}
              </div>
            )}

            {/* Question type */}
            <QuestionTypeSelector value={questionType} onChange={handleTypeChange} />
            {errors.question_type && (
              <p role="alert" className="text-sm text-destructive -mt-4">
                {errors.question_type}
              </p>
            )}

            {/* Question text */}
            <div className="space-y-2">
              <Label htmlFor="text">
                Question Text <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <textarea
                id="text"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="Enter your question…"
                maxLength={255}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-describedby={errors.text ? "text-error" : undefined}
                aria-invalid={!!errors.text}
              />
              {errors.text && (
                <p id="text-error" role="alert" className="text-sm text-destructive">
                  {errors.text}
                </p>
              )}
              <p className="text-xs text-muted-foreground text-right">{text.length}/255</p>
            </div>

            {/* Time limit */}
            <div className="space-y-2">
              <Label htmlFor="time_limit">
                Time Limit (seconds){" "}
                <span className="text-muted-foreground font-normal text-xs">(5–120)</span>
              </Label>
              <Input
                id="time_limit"
                type="number"
                min={5}
                max={120}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                aria-describedby={errors.time_limit ? "time-limit-error" : undefined}
                aria-invalid={!!errors.time_limit}
                className="w-32"
              />
              {errors.time_limit && (
                <p id="time-limit-error" role="alert" className="text-sm text-destructive">
                  {errors.time_limit}
                </p>
              )}
            </div>

            {/* Answer options — for choice types */}
            {isChoiceType && (
              <AnswerOptionEditor
                options={answerOptions}
                onChange={setAnswerOptions}
                showCorrect={CORRECT_REQUIRED_TYPES.includes(questionType)}
                error={errors.answer_options}
              />
            )}

            {/* Rating scale config */}
            {isRatingScale && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Rating Scale</p>
                <div className="flex items-start gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rating_min">
                      Minimum{" "}
                      <span className="text-muted-foreground font-normal text-xs">(1–10)</span>
                    </Label>
                    <Input
                      id="rating_min"
                      type="number"
                      min={1}
                      max={10}
                      value={ratingMin}
                      onChange={(e) => setRatingMin(Number(e.target.value))}
                      aria-describedby={errors.rating_min ? "rating-min-error" : undefined}
                      aria-invalid={!!errors.rating_min}
                      className="w-24"
                    />
                    {errors.rating_min && (
                      <p id="rating-min-error" role="alert" className="text-sm text-destructive">
                        {errors.rating_min}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rating_max">
                      Maximum{" "}
                      <span className="text-muted-foreground font-normal text-xs">(1–10)</span>
                    </Label>
                    <Input
                      id="rating_max"
                      type="number"
                      min={1}
                      max={10}
                      value={ratingMax}
                      onChange={(e) => setRatingMax(Number(e.target.value))}
                      aria-describedby={errors.rating_max ? "rating-max-error" : undefined}
                      aria-invalid={!!errors.rating_max}
                      className="w-24"
                    />
                    {errors.rating_max && (
                      <p id="rating-max-error" role="alert" className="text-sm text-destructive">
                        {errors.rating_max}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <div className="flex gap-3 px-6 pb-6">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving…" : "Save Changes"}
            </Button>
            <Link
              href={`/events/${eventId}`}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
