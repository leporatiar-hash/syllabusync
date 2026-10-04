// Design tokens copied from the web app (Frontend/) so the iOS app matches tryclassmate.com.
// Tailwind slate scale + the brand hexes used across Frontend/app and Frontend/components.

export const Brand = '#5B8DEF';

export const C = {
  brand: '#5B8DEF',
  brandEnd: '#7C9BF6', // gradient end for primary pills (from-[#5B8DEF] to-[#7C9BF6])
  brandDark: '#3b6ed6',
  brandText: '#7BB7FF', // "ClassMate" wordmark in the header
  lavender: '#A78BFA',
  indigo: '#5B4EE8', // logo + chat "New Chat" button
  rose: '#FB7185',
  white: '#FFFFFF',
  pageBg: '#FAFAFA',
  homeBgFrom: '#F5F7FA',
  homeBgTo: '#E8EDFB',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  green: '#22A55A',
  greenBg: '#DCFCE7',
  orange: '#FB923C',
  orangeBg: '#FFEDD5',
  emerald: '#10B981',
  red: '#EF4444',
} as const;

// Kept for older imports; the app is light-only to match the web.
export const Colors = {
  light: {
    text: C.slate900,
    textSecondary: C.slate500,
    background: C.pageBg,
    card: C.white,
    border: C.slate200,
    tint: C.brand,
    danger: C.red,
    success: C.green,
  },
} as const;
export const Colors_dark = Colors.light;
export type Theme = (typeof Colors)['light'];

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const Spacing = { one: 4, two: 8, three: 12, four: 16, five: 24, six: 32 } as const;

/** shadow-sm */
export const shadowSm = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
} as const;

// ---- Deadline type styles (Frontend/app/HomeClient.tsx + courses/[id]/page.tsx) ----
export type TypeStyle = { chipBg: string; chipFg: string; badgeBg: string; badgeFg: string; icon: string };
const TYPE_STYLES: Record<string, TypeStyle> = {
  Exam: { chipBg: '#FEE2E2', chipFg: '#FB7185', badgeBg: '#FEE2E2', badgeFg: '#FB7185', icon: 'BookOpen' },
  Quiz: { chipBg: '#FFEDD5', chipFg: '#FB923C', badgeBg: '#FFEDD5', badgeFg: '#FB923C', icon: 'HelpCircle' },
  Assignment: { chipBg: '#E0F2FE', chipFg: '#38BDF8', badgeBg: '#DBEAFE', badgeFg: '#38BDF8', icon: 'FileText' },
  Project: { chipBg: '#F3E8FF', chipFg: '#A78BFA', badgeBg: '#E9D5FF', badgeFg: '#A78BFA', icon: 'Target' },
  Homework: { chipBg: '#DCFCE7', chipFg: '#4ADE80', badgeBg: '#DCFCE7', badgeFg: '#4ADE80', icon: 'BookMarked' },
  Reading: { chipBg: '#DCFCE7', chipFg: '#4ADE80', badgeBg: '#DCFCE7', badgeFg: '#4ADE80', icon: 'BookOpenCheck' },
  Class: { chipBg: '#E0EAFF', chipFg: '#5B8DEF', badgeBg: '#E0EAFF', badgeFg: '#5B8DEF', icon: 'Clock' },
  Admin: { chipBg: '#F1F5F9', chipFg: '#475569', badgeBg: '#F1F5F9', badgeFg: '#475569', icon: 'ClipboardList' },
};

/** Types arrive in mixed case ("assignment", "Admin"); normalize like the web does. */
export function normalizeType(type: string | null | undefined): string {
  if (!type) return 'Admin';
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

export function typeStyle(type: string | null | undefined): TypeStyle {
  return TYPE_STYLES[normalizeType(type)] ?? TYPE_STYLES.Admin;
}

// ---- Course colors: exact port of Frontend/lib/courseColors.ts ----
type CourseColor = { accent: string; text: string; light: string; gradient: [string, string] };
const PALETTE: CourseColor[] = [
  { accent: '#5B8DEF', text: '#5B8DEF', light: '#E0EAFF', gradient: ['#E0EAFF', '#F5F7FF'] },
  { accent: '#F87171', text: '#F87171', light: '#FEE2E2', gradient: ['#FEE2E2', '#FFF1F2'] },
  { accent: '#4ADE80', text: '#4ADE80', light: '#DCFCE7', gradient: ['#ECFDF5', '#DCFCE7'] },
  { accent: '#A78BFA', text: '#A78BFA', light: '#F3E8FF', gradient: ['#F5E9FF', '#FDF2F8'] },
  { accent: '#FBBF24', text: '#D97706', light: '#FEF3C7', gradient: ['#FEF9C3', '#FEF3C7'] },
  { accent: '#2DD4BF', text: '#0D9488', light: '#CCFBF1', gradient: ['#CCFBF1', '#F0FDFA'] },
  { accent: '#F472B6', text: '#EC4899', light: '#FCE7F3', gradient: ['#FCE7F3', '#FDF2F8'] },
  { accent: '#6366F1', text: '#6366F1', light: '#E0E7FF', gradient: ['#E0E7FF', '#EEF2FF'] },
  { accent: '#FB923C', text: '#EA580C', light: '#FFEDD5', gradient: ['#FFF7ED', '#FFEDD5'] },
  { accent: '#22D3EE', text: '#0891B2', light: '#CFFAFE', gradient: ['#CFFAFE', '#ECFEFF'] },
];

function mixWithWhite(hex: string, ratio: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * ratio));
  return '#' + ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function hashCourseId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % PALETTE.length;
}

export function getCourseColor(id: string | null | undefined, custom?: string | null): CourseColor {
  if (custom && /^#[0-9A-Fa-f]{6}$/.test(custom)) {
    const hex = custom.toUpperCase();
    return { accent: hex, text: hex, light: mixWithWhite(hex, 0.88), gradient: [mixWithWhite(hex, 0.82), mixWithWhite(hex, 0.95)] };
  }
  if (!id) return { accent: C.slate400, text: C.slate500, light: C.slate100, gradient: [C.slate100, C.slate50] };
  return PALETTE[hashCourseId(id)];
}

/** Back-compat for screens that only need the accent hex. */
export function courseColor(id: string | null | undefined, custom?: string | null) {
  return getCourseColor(id, custom).accent;
}
