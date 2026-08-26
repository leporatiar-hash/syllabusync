/**
 * Shared course color system.
 * By default colors are assigned by hashing the course ID so every course always gets
 * the same color regardless of fetch order or page context. Users can override this
 * with their own hex color (Course.color, set via PATCH /courses/{id}) — see
 * `customStyle` below for how that's applied.
 * Used by both the Courses page (card gradients) and Calendar page (event badges).
 */

import type { CSSProperties } from 'react'

export interface CourseColorStyle {
  bg?: CSSProperties
  text?: CSSProperties
  light?: CSSProperties
  border?: CSSProperties
  gradient?: CSSProperties
}

export interface CourseColorEntry {
  /** Solid accent color class for calendar event badges */
  bg: string
  /** Text color class matching the accent */
  text: string
  /** Light background for day-view cards */
  light: string
  /** Border color for Class-type dashed borders */
  border: string
  /** Gradient for course cards on the Courses page */
  gradient: string
  /**
   * Inline-style equivalents of bg/text/light/border/gradient, set only when this
   * entry comes from a user-picked custom color. Tailwind's build-time compiler can't
   * generate CSS for a `bg-[#hex]` class built from a runtime value it never saw in
   * source, so consumers must also spread the matching `customStyle.*` field as a
   * `style` prop alongside the className — inline styles win on specificity, so this
   * is a no-op (undefined) for the default hash-based palette below.
   */
  customStyle?: CourseColorStyle
}

/**
 * 10 hand-picked colors that are visually distinct from each other.
 * Mix of soft pastels and vibrant accents that read well on white backgrounds.
 * Ordered to maximize contrast between adjacent assignments.
 */
const palette: CourseColorEntry[] = [
  // Cornflower blue
  { bg: 'bg-[#5B8DEF]', text: 'text-[#5B8DEF]', light: 'bg-[#E0EAFF]', border: 'border-[#5B8DEF]', gradient: 'from-[#E0EAFF] to-[#F5F7FF]' },
  // Coral
  { bg: 'bg-[#F87171]', text: 'text-[#F87171]', light: 'bg-[#FEE2E2]', border: 'border-[#F87171]', gradient: 'from-[#FEE2E2] to-[#FFF1F2]' },
  // Sage green
  { bg: 'bg-[#4ADE80]', text: 'text-[#4ADE80]', light: 'bg-[#DCFCE7]', border: 'border-[#4ADE80]', gradient: 'from-[#ECFDF5] to-[#DCFCE7]' },
  // Lavender
  { bg: 'bg-[#A78BFA]', text: 'text-[#A78BFA]', light: 'bg-[#F3E8FF]', border: 'border-[#A78BFA]', gradient: 'from-[#F5E9FF] to-[#FDF2F8]' },
  // Amber
  { bg: 'bg-[#FBBF24]', text: 'text-[#D97706]', light: 'bg-[#FEF3C7]', border: 'border-[#FBBF24]', gradient: 'from-[#FEF9C3] to-[#FEF3C7]' },
  // Teal
  { bg: 'bg-[#2DD4BF]', text: 'text-[#0D9488]', light: 'bg-[#CCFBF1]', border: 'border-[#2DD4BF]', gradient: 'from-[#CCFBF1] to-[#F0FDFA]' },
  // Rose pink
  { bg: 'bg-[#F472B6]', text: 'text-[#EC4899]', light: 'bg-[#FCE7F3]', border: 'border-[#F472B6]', gradient: 'from-[#FCE7F3] to-[#FDF2F8]' },
  // Slate blue
  { bg: 'bg-[#6366F1]', text: 'text-[#6366F1]', light: 'bg-[#E0E7FF]', border: 'border-[#6366F1]', gradient: 'from-[#E0E7FF] to-[#EEF2FF]' },
  // Tangerine
  { bg: 'bg-[#FB923C]', text: 'text-[#EA580C]', light: 'bg-[#FFEDD5]', border: 'border-[#FB923C]', gradient: 'from-[#FFF7ED] to-[#FFEDD5]' },
  // Cyan
  { bg: 'bg-[#22D3EE]', text: 'text-[#0891B2]', light: 'bg-[#CFFAFE]', border: 'border-[#22D3EE]', gradient: 'from-[#CFFAFE] to-[#ECFEFF]' },
]

/**
 * A curated set of swatches offered in the color picker UI. Users aren't limited to
 * these — the picker also accepts any hex via a native color input — but these give
 * a quick, on-brand starting point.
 */
export const COLOR_PICKER_SWATCHES: string[] = [
  '#5B8DEF', '#F87171', '#4ADE80', '#A78BFA', '#FBBF24',
  '#2DD4BF', '#F472B6', '#6366F1', '#FB923C', '#22D3EE',
  '#EF4444', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899',
]

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')
}

/** Mix a color toward white. ratio 0 = original color, 1 = pure white. */
function mixWithWhite(hex: string, ratio: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * ratio, g + (255 - g) * ratio, b + (255 - b) * ratio)
}

function buildCustomColorEntry(hex: string): CourseColorEntry {
  const normalized = hex.toUpperCase()
  const light = mixWithWhite(normalized, 0.88)
  const gradientFrom = mixWithWhite(normalized, 0.82)
  const gradientTo = mixWithWhite(normalized, 0.95)
  return {
    bg: `bg-[${normalized}]`,
    text: `text-[${normalized}]`,
    light: `bg-[${light}]`,
    border: `border-[${normalized}]`,
    gradient: `from-[${gradientFrom}] to-[${gradientTo}]`,
    customStyle: {
      bg: { backgroundColor: normalized },
      text: { color: normalized },
      light: { backgroundColor: light },
      border: { borderColor: normalized },
      gradient: { backgroundImage: `linear-gradient(to bottom right, ${gradientFrom}, ${gradientTo})` },
    },
  }
}

/** Deterministic hash of a course ID → palette index. */
function hashCourseId(courseId: string): number {
  let hash = 0
  for (let i = 0; i < courseId.length; i++) {
    hash = ((hash << 5) - hash + courseId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % palette.length
}

/**
 * Get the color entry for a course. If `customColor` is a valid hex string, it's
 * used (and rendered via `customStyle`, see above). Otherwise falls back to the
 * hash-based default so the color stays stable across pages and re-renders.
 */
export function getCourseColor(courseId: string, customColor?: string | null): CourseColorEntry {
  if (customColor && HEX_COLOR_RE.test(customColor)) {
    return buildCustomColorEntry(customColor)
  }
  return palette[hashCourseId(courseId)]
}

/**
 * Build a color map for an array of courses. Each course's own `color` (if set)
 * takes priority; otherwise falls back to the hash-based default.
 */
export function buildCourseColorMap(courses: { id: string; color?: string | null }[]): Record<string, CourseColorEntry> {
  const map: Record<string, CourseColorEntry> = {}
  for (const course of courses) {
    map[course.id] = getCourseColor(course.id, course.color)
  }
  return map
}
