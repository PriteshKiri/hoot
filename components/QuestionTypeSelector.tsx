"use client"

import type { QuestionType } from "@/components/QuestionCard"

interface QuestionTypeSelectorProps {
  value: QuestionType
  onChange: (type: QuestionType) => void
}

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  {
    value: "single_select",
    label: "Single Select",
    description: "One correct answer from multiple choices",
  },
  {
    value: "multi_select",
    label: "Multi Select",
    description: "One or more correct answers",
  },
  {
    value: "open_text",
    label: "Open Text",
    description: "Free-form text response",
  },
  {
    value: "rating_scale",
    label: "Rating Scale",
    description: "Numeric rating within a defined range",
  },
  {
    value: "image_choice",
    label: "Image Choice",
    description: "Multiple choice with image options",
  },
]

/**
 * QuestionTypeSelector — radio group for selecting the question type.
 *
 * Requirements: 3.1
 */
export function QuestionTypeSelector({ value, onChange }: QuestionTypeSelectorProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium mb-3">Question Type</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {QUESTION_TYPES.map((type) => {
          const isSelected = value === type.value
          return (
            <label
              key={type.value}
              className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-input hover:border-primary/50 hover:bg-accent/50"
              }`}
            >
              <input
                type="radio"
                name="question_type"
                value={type.value}
                checked={isSelected}
                onChange={() => onChange(type.value)}
                className="sr-only"
              />
              <span className="text-sm font-medium">{type.label}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{type.description}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
