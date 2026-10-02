import { Platform } from 'react-native';

// ClassMate brand blue (#5B8DEF) matches the web app's accent.
export const Brand = '#5B8DEF';

export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#64748B',
    background: '#F2F2F7',
    card: '#FFFFFF',
    border: '#E2E8F0',
    tint: Brand,
    danger: '#DC2626',
    success: '#16A34A',
  },
  dark: {
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    background: '#000000',
    card: '#1C1C1E',
    border: '#2C2C2E',
    tint: Brand,
    danger: '#F87171',
    success: '#4ADE80',
  },
} as const;

export type Theme = (typeof Colors)['light' | 'dark'];

// Fallback course colors when a course has no user-chosen color (same palette idea as the web).
export const CoursePalette = ['#5B8DEF', '#A78BFA', '#F472B6', '#FB923C', '#34D399', '#38BDF8', '#FACC15', '#F87171'];

export function courseColor(id: string | null | undefined, color?: string | null) {
  if (color) return color;
  if (!id) return '#94A3B8';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CoursePalette[h % CoursePalette.length];
}

export const Spacing = { one: 4, two: 8, three: 12, four: 16, five: 24, six: 32 } as const;

export const Fonts = Platform.select({
  ios: { rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { rounded: 'normal', mono: 'monospace' },
});
