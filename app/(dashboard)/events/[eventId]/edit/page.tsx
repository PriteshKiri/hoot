"use client"

import { useEffect, useState, FormEvent } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Upload, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { BUILT_IN_THEMES, AVAILABLE_FONTS, type HootTheme } from "@/lib/themes"

interface EventData {
  id: string
  title: string
  description: string | null
  theme_id: string | null
  custom_theme: {
    primaryColor?: string
    backgroundColor?: string
    fontFamily?: string
  } | null
  logo_url: string | null
}

/**
 * Event edit page — theme selector and logo upload.
 *
 * Allows admins to:
 *   - Pick a built-in colour theme
 *   - Customise primary/background colour and font
 *   - Upload a logo image
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
  const [customBackground, setCustomBackground] = useState("")
  const [selectedFont, setSelectedFont] = useState<string>(AVAILABLE_FONTS[0].value)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    fetch(`/api/v1/events/${eventId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load event")
        const data = await res.json()
        const ev: EventData = data.event
        setEvent(ev)
        setSelectedThemeId(ev.theme_id ?? "violet")
        setCustomPrimary(ev.custom_theme?.primaryColor ?? "")
        setCustomBackground(ev.custom_theme?.backgroundColor ?? "")
        setSelectedFont(ev.custom_theme?.fontFamily ?? AVAILABLE_FONTS[0].value)
        if (ev.logo_url) setLogoPreview(ev.logo_url)
      })
      .catch(() => setError("Failed to load event."))
      .finally(() => setLoading(false))
  }, [eventId])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return event?.logo_url ?? null
    setUploadingLogo(true)
    try {
      // Get signed upload URL
      const res = await fetch("/api/v1/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "event-logos",
          filename: logoFile.name,
          contentType: logoFile.type,
          contentLength: logoFile.size,
        }),
      })
      if (!res.ok) throw new Error("Failed to get upload URL")
      const { signedUrl, path } = await res.json()

      // Upload directly to Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": logoFile.type },
        body: logoFile,
      })
      if (!uploadRes.ok) throw new Error("Upload failed")

      // Construct public URL
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")
      return `${supabaseUrl}/storage/v1/object/public/event-logos/${path}`
    } catch {
      setError("Logo upload failed. Please try again.")
      return null
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const logoUrl = await uploadLogo()

      const customTheme =
        customPrimary || customBackground || selectedFont !== AVAILABLE_FONTS[0].value
          ? {
              ...(customPrimary ? { primaryColor: customPrimary } : {}),
              ...(customBackground ? { backgroundColor: customBackground } : {}),
              fontFamily: selectedFont,
            }
          : null

      const body: Record<string, unknown> = {
        theme_id: selectedThemeId,
        custom_theme: customTheme,
      }
      if (logoUrl !== undefined) body.logo_url = logoUrl

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

  const activeTheme: HootTheme =
    BUILT_IN_THEMES.find((t) => t.id === selectedThemeId) ?? BUILT_IN_THEMES[0]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/events/${eventId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Event Settings</h1>
          <p className="text-sm text-muted-foreground">{event?.title}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Theme picker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colour Theme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BUILT_IN_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setSelectedThemeId(theme.id)}
                  className={`relative rounded-xl border-2 p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-ring ${
                    selectedThemeId === theme.id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-muted-foreground"
                  }`}
                  aria-pressed={selectedThemeId === theme.id}
                  aria-label={`Select ${theme.name} theme`}
                >
                  {/* Colour swatch */}
                  <div className="flex gap-1.5 mb-2">
                    <div
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    <div
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{ backgroundColor: theme.backgroundColor }}
                    />
                  </div>
                  <p className="text-xs font-semibold truncate">{theme.name}</p>
                  {selectedThemeId === theme.id && (
                    <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom overrides */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custom Overrides (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="custom-primary">Primary Colour</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="custom-primary"
                    type="color"
                    value={customPrimary || activeTheme.primaryColor}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    className="h-9 w-14 rounded border border-input cursor-pointer"
                    aria-label="Custom primary colour"
                  />
                  <span className="text-sm text-muted-foreground font-mono">
                    {customPrimary || activeTheme.primaryColor}
                  </span>
                  {customPrimary && (
                    <button
                      type="button"
                      onClick={() => setCustomPrimary("")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-bg">Background Colour</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="custom-bg"
                    type="color"
                    value={customBackground || activeTheme.backgroundColor}
                    onChange={(e) => setCustomBackground(e.target.value)}
                    className="h-9 w-14 rounded border border-input cursor-pointer"
                    aria-label="Custom background colour"
                  />
                  <span className="text-sm text-muted-foreground font-mono">
                    {customBackground || activeTheme.backgroundColor}
                  </span>
                  {customBackground && (
                    <button
                      type="button"
                      onClick={() => setCustomBackground("")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="font-select">Font Family</Label>
              <select
                id="font-select"
                value={selectedFont}
                onChange={(e) => setSelectedFont(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {AVAILABLE_FONTS.map((f) => (
                  <option key={f.id} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Logo upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {logoPreview && (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="h-16 w-16 rounded-lg object-contain border bg-muted"
                />
                <button
                  type="button"
                  onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                  className="text-sm text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
            <label
              htmlFor="logo-upload"
              className="flex items-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>
                {logoFile ? logoFile.name : "Click to upload logo (JPEG, PNG, SVG — max 2 MB)"}
              </span>
              <input
                id="logo-upload"
                type="file"
                accept="image/jpeg,image/png,image/svg+xml"
                onChange={handleLogoChange}
                className="sr-only"
                aria-label="Upload event logo"
              />
            </label>
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
          <Button type="submit" disabled={saving || uploadingLogo}>
            {saving || uploadingLogo ? "Saving…" : "Save Theme"}
          </Button>
        </div>
      </form>
    </div>
  )
}
