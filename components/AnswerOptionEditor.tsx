"use client"

import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"

export interface AnswerOptionDraft {
  text: string
  is_correct: boolean
}

/** Always exactly four answer options — no add / remove. */
export const REQUIRED_OPTION_COUNT = 4

/** Max characters allowed in a single answer option. */
export const ANSWER_MAX_LENGTH = 120

/** Color accents for the four fixed answer slots (Kahoot-style). */
const SLOT_STYLES: { accent: string; chip: string; ring: string }[] = [
  { accent: "bg-rose-500", chip: "bg-rose-500 text-white", ring: "ring-rose-500" },
  { accent: "bg-sky-500", chip: "bg-sky-500 text-white", ring: "ring-sky-500" },
  { accent: "bg-amber-500", chip: "bg-amber-500 text-white", ring: "ring-amber-500" },
  { accent: "bg-emerald-500", chip: "bg-emerald-500 text-white", ring: "ring-emerald-500" },
]

interface AnswerOptionEditorProps {
  options: AnswerOptionDraft[]
  onChange: (options: AnswerOptionDraft[]) => void
  /** "single" → only one correct; "multi" → any number correct. */
  mode: "single" | "multi"
  error?: string
}

/**
 * AnswerOptionEditor — exactly four answer options. No add/remove.
 *
 * - `mode="single"`: choosing a correct option clears any other selection
 *   (radio behavior). A Reset button clears the selection so the admin can
 *   pick again.
 * - `mode="multi"`: any combination of options can be marked correct
 *   (checkbox behavior).
 *
 * Requirements: 3.2, 3.3
 */
export function AnswerOptionEditor({ options, onChange, mode, error }: AnswerOptionEditorProps) {
  // Defensive: ensure we always render exactly REQUIRED_OPTION_COUNT rows
  // even if a parent supplied fewer. Extra entries are truncated.
  const normalized: AnswerOptionDraft[] = Array.from({ length: REQUIRED_OPTION_COUNT }, (_, i) => ({
    text: options[i]?.text ?? "",
    is_correct: options[i]?.is_correct ?? false,
  }))

  const hasSelection = normalized.some((o) => o.is_correct)

  function updateText(index: number, text: string) {
    onChange(normalized.map((opt, i) => (i === index ? { ...opt, text } : opt)))
  }

  function selectCorrect(index: number) {
    if (mode === "single") {
      onChange(
        normalized.map((opt, i) => ({
          ...opt,
          is_correct: i === index,
        }))
      )
    } else {
      onChange(
        normalized.map((opt, i) => (i === index ? { ...opt, is_correct: !opt.is_correct } : opt))
      )
    }
  }

  function resetSelection() {
    onChange(normalized.map((opt) => ({ ...opt, is_correct: false })))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {mode === "single"
            ? "Pick exactly one correct answer. Use Reset to change your choice."
            : "Tick every option that is a correct answer. Use Reset to clear your selection."}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetSelection}
          disabled={!hasSelection}
          className="h-8 gap-1.5 text-xs shrink-0"
          aria-label="Reset correct answer selection"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {normalized.map((opt, idx) => {
          const slot = SLOT_STYLES[idx % SLOT_STYLES.length]
          const inputId = `answer-option-${idx}`
          const correctControlId = `answer-option-${idx}-correct`
          return (
            <div
              key={idx}
              className={`relative flex items-stretch gap-3 rounded-lg border bg-card p-3 transition ${
                opt.is_correct
                  ? `border-transparent ring-2 ${slot.ring}`
                  : "border-input hover:border-muted-foreground/40"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base font-bold ${slot.chip}`}
                aria-hidden="true"
              >
                {String.fromCharCode(65 + idx)}
              </div>

              <div className="flex flex-1 flex-col gap-2 min-w-0">
                <textarea
                  id={inputId}
                  placeholder={`Answer ${idx + 1}`}
                  value={opt.text}
                  onChange={(e) => updateText(idx, e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  aria-label={`Answer option ${idx + 1} text`}
                  maxLength={ANSWER_MAX_LENGTH}
                  required
                />

                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor={correctControlId}
                    className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none"
                  >
                    <input
                      id={correctControlId}
                      type={mode === "single" ? "radio" : "checkbox"}
                      name={mode === "single" ? "correct-answer" : `correct-answer-${idx}`}
                      checked={opt.is_correct}
                      onChange={() => selectCorrect(idx)}
                      className="h-4 w-4 accent-primary"
                      aria-label={`Mark option ${idx + 1} as correct`}
                    />
                    <span className={opt.is_correct ? "font-semibold text-foreground" : ""}>
                      {opt.is_correct ? "Correct answer" : "Mark as correct"}
                    </span>
                  </label>

                  <span
                    className={`text-xs tabular-nums ${
                      opt.text.length >= ANSWER_MAX_LENGTH
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                    aria-live="polite"
                  >
                    {opt.text.length}/{ANSWER_MAX_LENGTH}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
