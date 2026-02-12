/**
 * Shared course color system — deterministic by course ID.
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

const palette: CourseColorEntry[] = [
  { bg: 'bg-[#5B8DEF]', text: 'text-[#5B8DEF]', light: 'bg-[#E0EAFF]', border: 'border-[#5B8DEF]', gradient: 'from-[#E0EAFF] to-[#F5F7FF]' },
  { bg: 'bg-[#A78BFA]', text: 'text-[#A78BFA]', light: 'bg-[#F3E8FF]', border: 'border-[#A78BFA]', gradient: 'from-[#F5E9FF] to-[#FDF2F8]' },
  { bg: 'bg-[#FB7185]', text: 'text-[#FB7185]', light: 'bg-[#FEE2E2]', border: 'border-[#FB7185]', gradient: 'from-[#FEE2E2] to-[#FFF1F2]' },
  { bg: 'bg-[#4ADE80]', text: 'text-[#4ADE80]', light: 'bg-[#DCFCE7]', border: 'border-[#4ADE80]', gradient: 'from-[#ECFDF5] to-[#DCFCE7]' },
  { bg: 'bg-[#FB923C]', text: 'text-[#FB923C]', light: 'bg-[#FFEDD5]', border: 'border-[#FB923C]', gradient: 'from-[#FFF7ED] to-[#FEF3C7]' },
  { bg: 'bg-[#38BDF8]', text: 'text-[#38BDF8]', light: 'bg-[#E0F2FE]', border: 'border-[#38BDF8]', gradient: 'from-[#E6FFFB] to-[#ECFEFF]' },
]

/**
 * Simple hash of a string to a stable number.
 * Same course ID always produces the same index.
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Get the color entry for a course by its ID.
 * Deterministic — same ID always returns the same color.
 */
export function getCourseColor(courseId: string): CourseColorEntry {
  return palette[hashString(courseId) % palette.length]
}

/**
 * Build a color map for an array of courses.
 * Convenience wrapper for components that need all colors at once.
 */
export function buildCourseColorMap(courses: { id: string }[]): Record<string, CourseColorEntry> {
  const map: Record<string, CourseColorEntry> = {}
  for (const course of courses) {
    map[course.id] = getCourseColor(course.id)
  }
  return map
}
