/**
 * Shared course color system.
 * Colors are assigned sequentially so no two courses share a color.
 * Used by both the Courses page (card gradients) and Calendar page (event badges).
 */

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
 * Get the color entry for a course by its position in the user's course list.
 * Falls back to hash-based assignment if no index is provided.
 */
export function getCourseColor(courseId: string, index?: number): CourseColorEntry {
  if (index !== undefined) {
    return palette[index % palette.length]
  }
  // Fallback: hash-based for single-course lookups without a list
  let hash = 0
  for (let i = 0; i < courseId.length; i++) {
    hash = ((hash << 5) - hash + courseId.charCodeAt(i)) | 0
  }
  return palette[Math.abs(hash) % palette.length]
}

/**
 * Build a color map for an array of courses.
 * Assigns colors sequentially so every course gets a unique color
 * (up to 10 courses, then colors repeat with maximum spacing).
 */
export function buildCourseColorMap(courses: { id: string }[]): Record<string, CourseColorEntry> {
  const map: Record<string, CourseColorEntry> = {}
  for (let i = 0; i < courses.length; i++) {
    map[courses[i].id] = palette[i % palette.length]
  }
  return map
}
