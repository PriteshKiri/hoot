"use client"

import { useEffect, useMemo, useState, FormEvent } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  BUILT_IN_THEMES,
  GRADIENT_PRESETS,
  buildThemeStyle,
  getThemeById,
  resolveGradient,
  resolvePrimaryHex,
  type CustomTheme,
} from "@/lib/themes"

interface EventData {
  id: string
  title: string
  description: string | null
  theme_id: string | null
  custom_theme: CustomTheme | null
}

/**
 * Event edit page — theme & branding settings.
 *
 * Admins can:
 *   - Pick a built-in colour theme
 *   - Override the primary colour with a custom hex
 *   - Pick a gradient preset (used for headers, hero areas, and event cards)
 *
 * The selected theme is previewed live within the form using
 * {@link buildThemeStyle}, which sets `--primary`, `--primary-foreground`,
 * `--ring`, and `--event-gradient` CSS variables on the wrapping element.
 *
 * Requirements: 15.1–15.6
 */
export default function EventEditPage() {
  const params = useParams<{ eventId: string }>()
  const { eventId } = params
  const router = useRouter()

  const [event, setEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [selectedThemeId, setSelectedThemeId] = useState<string>("violet")
  const [customPrimary, setCustomPrimary] = useState("")
  const [selectedGradient, setSelectedGradient] = useState<string>("")

  useEffect(() => {
    fetch(`/api/v1/events/${eventId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load event")
        const data = await res.json()
        const ev: EventData = data.event
        setEvent(ev)
        setSelectedThemeId(ev.theme_id ?? "violet")
        setCustomPrimary(ev.custom_theme?.primaryColor ?? "")
        setSelectedGradient(ev.custom_theme?.gradient ?? "")
      })
      .catch(() => setError("Failed to load event."))
      .finally(() => setLoading(false))
  }, [eventId])

  // Build the CustomTheme that will be sent on save (and used for the live preview).
  const customTheme = useMemo<CustomTheme | null>(() => {
    const ct: CustomTheme = {}
    if (customPrimary) ct.primaryColor = customPrimary
    if (selectedGradient) ct.gradient = selectedGradient
    return Object.keys(ct).length > 0 ? ct : null
  }, [customPrimary, selectedGradient])

  const previewStyle = useMemo(
    () => buildThemeStyle({ themeId: selectedThemeId, customTheme }),
    [selectedThemeId, customTheme]
  )

  const effectivePrimary = resolvePrimaryHex({ themeId: selectedThemeId, customTheme })
  const effectiveGradient = resolveGradient({ themeId: selectedThemeId, customTheme })

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const body: Record<string, unknown> = {
        theme_id: selectedThemeId,
        custom_theme: customTheme,
      }

      const res = await fetch(`/api/v1/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error?.message ?? "Failed to save theme.")
        return
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      // Refresh server-rendered pages (dashboard, event page) so cards show the
      // newly saved theme without the user manually reloading.
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div style={previewStyle} className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/events/${eventId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Theme & Branding</h1>
          <p className="text-sm text-muted-foreground">{event?.title}</p>
        </div>
      </div>

      {/* Live preview */}
      <Card className="overflow-hidden">
        <div
          className="px-6 py-8 text-white"
          style={{ background: effectiveGradient }}
        >
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-90 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Live Preview
          </div>
          <h2 className="text-2xl font-bold drop-shadow-sm">{event?.title}</h2>
          <p className="text-sm opacity-90 mt-1">
            This is how your event header and cards will appear.
          </p>
        </div>
        <CardContent className="pt-6 flex flex-wrap items-center gap-3">
          <Button>Primary Action</Button>
          <Button variant="outline">Secondary</Button>
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ background: effectiveGradient }}
          >
            Live Badge
          </span>
        </CardContent>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Theme picker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colour Theme</CardTitle>
            <p className="text-xs text-muted-foreground">
              Pick a base colour theme. Primary buttons, links and accents will
              use this colour throughout the event.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {BUILT_IN_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setSelectedThemeId(theme.id)
                    // Reset overrides so the chosen theme's defaults are used.
                    setCustomPrimary("")
                    setSelectedGradient("")
                  }}
                  className={`relative rounded-xl border-2 p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-ring overflow-hidden ${
                    selectedThemeId === theme.id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-muted-foreground"
                  }`}
                  aria-pressed={selectedThemeId === theme.id}
                  aria-label={`Select ${theme.name} theme`}
                >
                  <div
                    className="h-12 w-full rounded-md mb-2 shadow-inner"
                    style={{ background: theme.gradient }}
                    aria-hidden="true"
                  />
                  <p className="text-xs font-semibold truncate">{theme.name}</p>
                  {selectedThemeId === theme.id && (
                    <Check className="absolute top-2 right-2 h-4 w-4 text-white drop-shadow" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom primary colour */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Primary Colour</CardTitle>
            <p className="text-xs text-muted-foreground">
              Optionally override the theme's primary colour. Affects buttons,
              links, and focus rings.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label htmlFor="custom-primary">Custom primary colour</Label>
              <div className="flex items-center gap-3">
                <input
                  id="custom-primary"
                  type="color"
                  value={customPrimary || (getThemeById(selectedThemeId)?.primaryColor ?? "#7c3aed")}
                  onChange={(e) => setCustomPrimary(e.target.value)}
                  className="h-10 w-16 rounded border border-input cursor-pointer"
                  aria-label="Custom primary colour"
                />
                <span className="text-sm text-muted-foreground font-mono">
                  {effectivePrimary}
                </span>
                {customPrimary && (
                  <button
                    type="button"
                    onClick={() => setCustomPrimary("")}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Reset to theme default
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gradient picker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gradient</CardTitle>
            <p className="text-xs text-muted-foreground">
              Choose a gradient for event headers, hero sections, and dashboard
              cards. Each theme comes with a default gradient — pick one below
              to override it.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Theme default gradient option */}
              <button
                type="button"
                onClick={() => setSelectedGradient("")}
                className={`relative rounded-xl border-2 p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-ring ${
                  !selectedGradient
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-muted-foreground"
                }`}
                aria-pressed={!selectedGradient}
                aria-label="Use theme default gradient"
              >
                <div
                  className="h-14 w-full rounded-md shadow-inner"
                  style={{ background: getThemeById(selectedThemeId)?.gradient }}
                  aria-hidden="true"
                />
                <p className="text-xs font-medium mt-2 truncate">Theme default</p>
                {!selectedGradient && (
                  <Check className="absolute top-3 right-3 h-4 w-4 text-white drop-shadow" aria-hidden="true" />
                )}
              </button>
              {GRADIENT_PRESETS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGradient(g.value)}
                  className={`relative rounded-xl border-2 p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-ring ${
                    selectedGradient === g.value
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-muted-foreground"
                  }`}
                  aria-pressed={selectedGradient === g.value}
                  aria-label={`Select ${g.name} gradient`}
                >
                  <div
                    className="h-14 w-full rounded-md shadow-inner"
                    style={{ background: g.value }}
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium mt-2 truncate">{g.name}</p>
                  {selectedGradient === g.value && (
                    <Check className="absolute top-3 right-3 h-4 w-4 text-white drop-shadow" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {success && (
          <p role="status" className="text-sm text-green-600 flex items-center gap-1">
            <Check className="h-4 w-4" /> Theme saved successfully.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/events/${eventId}`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Theme"}
          </Button>
        </div>
      </form>
    </div>
  )
}
