// Hex mirror of the dark palette in app/globals.css. CSS variables and oklch() do not exist where
// these are read — Satori (the link-preview card), the <meta name="theme-color"> tag and the
// manifest JSON all need literal hex — so this is the one swap point for them. Converted from
// the oklch values on 2026-09-28 (OKLab → linear sRGB → gamma, rounded); when a token in
// globals.css changes, change the matching line here.
export const THEME_COLORS = {
  /** --background: oklch(0.07 0 0) */
  background: '#010101',
  /** --card: oklch(0.11 0 0) */
  card: '#040404',
  /** --muted: oklch(0.15 0 0) */
  muted: '#0b0b0b',
  /** --foreground: oklch(0.93 0.01 75) */
  foreground: '#ece7e1',
  /** --muted-foreground: oklch(0.52 0.02 75) */
  mutedForeground: '#70685c',
  /** --primary / --accent / --ring: oklch(0.72 0.12 75), the brass */
  primary: '#d09945',
  /** --border: oklch(1 0 0 / 8%) composited over --background */
  border: '#151515',
} as const;
