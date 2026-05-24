"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface AnswerOptionDraft {
  text: string
  is_correct: boolean
}

interface AnswerOptionEditorProps {
  options: AnswerOptionDraft[]
  onChange: (options: AnswerOptionDraft[]) => void
  /** Whether to show the "correct" checkbox (false for image_choice) */
  showCorrect?: boolean
  error?: string
}

/**
 * AnswerOptionEditor — add/remove answer options (2–4), mark correct.
 *
 * Requirements: 3.2, 3.3
 */
export function AnswerOptionEditor({
  options,
  onChange,
  showCorrect = true,
  error,
}: AnswerOptionEditorProps) {
  function addOption() {
    if (options.length >= 4) return
    onChange([...options, { text: "", is_correct: false }])
  }

  function removeOption(index: number) {
    if (options.length <= 2) return
    onChange(options.filter((_, i) => i !== index))
  }

  function updateText(index: number, text: string) {
    onChange(options.map((opt, i) => (i === index ? { ...opt, text } : opt)))
  }

  function toggleCorrect(index: number) {
    onChange(options.map((opt, i) => (i === index ? { ...opt, is_correct: !opt.is_correct } : opt)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>
          Answer Options{" "}
          <span className="text-muted-foreground font-normal text-xs">(2–4)</span>
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={options.length >= 4}
          className="h-7 text-xs"
        >
          + Add Option
        </Button>
      </div>

      <div className="space-y-2">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {/* Correct checkbox */}
            {showCorrect && (
              <label className="flex items-center gap-1.5 shrink-0" title="Mark as correct">
                <input
                  type="checkbox"
                  checked={opt.is_correct}
                  onChange={() => toggleCorrect(idx)}
                  className="h-4 w-4 rounded border-input accent-primary"
                  aria-label={`Option ${idx + 1} is correct`}
                />
                <span className="sr-only">Correct</span>
              </label>
            )}

            {/* Option text */}
            <Input
              type="text"
              placeholder={`Option ${idx + 1}`}
              value={opt.text}
              onChange={(e) => updateText(idx, e.target.value)}
              className="flex-1"
              aria-label={`Option ${idx + 1} text`}
            />

            {/* Remove button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeOption(idx)}
              disabled={options.length <= 2}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              aria-label={`Remove option ${idx + 1}`}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>
        ))}
      </div>

      {showCorrect && (
        <p className="text-xs text-muted-foreground">
          Check the box next to the correct answer(s).
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
