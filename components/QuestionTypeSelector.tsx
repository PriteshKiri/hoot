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
    description: "Only one correct answer. Participants pick one.",
  },
  {
    value: "multi_select",
    label: "Multi Select",
    description: "One or more correct answers. Participants pick all that apply.",
  },
]

/**
 * QuestionTypeSelector — radio group for selecting the question type.
 *
 * Only `single_select` and `multi_select` are exposed. All other legacy types
 * (open_text, rating_scale, image_choice) are intentionally hidden from the UI.
 *
 * Requirements: 3.1
 */
export function QuestionTypeSelector({ value, onChange }: QuestionTypeSelectorProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium mb-3">Question Type</legend>
      <div className="grid grid-cols-1 gap-2">
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
