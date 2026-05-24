/**
 * Built-in colour themes for Hoot events.
 *
 * Each theme defines CSS variable values that are applied to the presenter
 * screen, participant screen, and join pages.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.6
 */

export interface HootTheme {
  id: string
  name: string
  primaryColor: string
  backgroundColor: string
  foregroundColor: string
  fontFamily: string
  /** Tailwind CSS class names to apply to the root element */
  cssVars: Record<string, string>
}

export const BUILT_IN_THEMES: HootTheme[] = [
  {
    id: "violet",
    name: "Violet (Default)",
    primaryColor: "#7c3aed",
    backgroundColor: "#ffffff",
    foregroundColor: "#09090b",
    fontFamily: "Inter, sans-serif",
    cssVars: {
      "--primary": "262.1 83.3% 57.8%",
      "--background": "0 0% 100%",
      "--foreground": "240 10% 3.9%",
    },
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    primaryColor: "#0ea5e9",
    backgroundColor: "#f0f9ff",
    foregroundColor: "#0c4a6e",
    fontFamily: "Inter, sans-serif",
    cssVars: {
      "--primary": "199 89% 48%",
      "--background": "204 100% 97%",
      "--foreground": "201 96% 24%",
    },
  },
  {
    id: "forest",
    name: "Forest Green",
    primaryColor: "#16a34a",
    backgroundColor: "#f0fdf4",
    foregroundColor: "#14532d",
    fontFamily: "Georgia, serif",
    cssVars: {
      "--primary": "142 71% 45%",
      "--background": "138 76% 97%",
      "--foreground": "140 84% 17%",
    },
  },
  {
    id: "sunset",
    name: "Sunset Orange",
    primaryColor: "#ea580c",
    backgroundColor: "#fff7ed",
    foregroundColor: "#431407",
    fontFamily: "Inter, sans-serif",
    cssVars: {
      "--primary": "24 95% 48%",
      "--background": "34 100% 97%",
      "--foreground": "20 91% 14%",
    },
  },
  {
    id: "midnight",
    name: "Midnight Dark",
    primaryColor: "#a78bfa",
    backgroundColor: "#0f0f23",
    foregroundColor: "#e2e8f0",
    fontFamily: "JetBrains Mono, monospace",
    cssVars: {
      "--primary": "258 90% 74%",
      "--background": "240 43% 10%",
      "--foreground": "214 32% 91%",
    },
  },
  {
    id: "rose",
    name: "Rose Pink",
    primaryColor: "#e11d48",
    backgroundColor: "#fff1f2",
    foregroundColor: "#4c0519",
    fontFamily: "Inter, sans-serif",
    cssVars: {
      "--primary": "347 77% 50%",
      "--background": "356 100% 97%",
      "--foreground": "343 88% 16%",
    },
  },
]

export const AVAILABLE_FONTS = [
  { id: "inter", label: "Inter (Sans-serif)", value: "Inter, sans-serif" },
  { id: "georgia", label: "Georgia (Serif)", value: "Georgia, serif" },
  { id: "mono", label: "JetBrains Mono (Monospace)", value: "JetBrains Mono, monospace" },
] as const

export type FontId = (typeof AVAILABLE_FONTS)[number]["id"]

export function getThemeById(id: string): HootTheme | undefined {
  return BUILT_IN_THEMES.find((t) => t.id === id)
}

export function getDefaultTheme(): HootTheme {
  return BUILT_IN_THEMES[0]
}
