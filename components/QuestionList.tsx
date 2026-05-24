"use client"

import Link from "next/link"
import { QuestionCard, type Question } from "@/components/QuestionCard"

interface QuestionListProps {
  questions: Question[]
  eventId: string
}

/**
 * QuestionList — renders a list of QuestionCard components.
 * Shows an empty state when there are no questions.
 *
 * Requirements: 2.3, 3.1–3.8
 */
export function QuestionList({ questions, eventId }: QuestionListProps) {
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">❓</div>
        <h2 className="text-lg font-semibold mb-2">No questions yet</h2>
        <p className="text-muted-foreground mb-6 max-w-sm text-sm">
          Add your first question to get started. You can choose from multiple
          question types including single-select, multi-select, open text, rating
          scale, and image-based.
        </p>
        <Link
          href={`/events/${eventId}/questions/new`}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Add your first question
        </Link>
      </div>
    )
  }

  return (
    <ol className="space-y-3" aria-label="Questions">
      {questions.map((question) => (
        <li key={question.id}>
          <QuestionCard question={question} eventId={eventId} />
        </li>
      ))}
    </ol>
  )
}
