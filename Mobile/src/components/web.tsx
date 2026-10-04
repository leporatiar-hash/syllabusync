// Building blocks that reproduce the web app's Tailwind look in React Native.
import { LinearGradient } from 'expo-linear-gradient';
import {
  BookMarked,
  BookOpen,
  BookOpenCheck,
  ClipboardList,
  Clock,
  FileText,
  HelpCircle,
  Target,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { C, F, shadowSm, typeStyle } from '@/constants/theme';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

/** Text in Inter, defaulting to slate-700 at 14px like the web body copy. */
export function T({
  size = 14,
  weight = 'regular',
  color = C.slate700,
  style,
  ...rest
}: TextProps & { size?: number; weight?: Weight; color?: string }) {
  return <Text style={[{ fontFamily: F[weight], fontSize: size, color, lineHeight: Math.round(size * 1.4) }, style]} {...rest} />;
}

/** text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 */
export function Eyebrow({ children, color = C.slate500, tracking = 2.4, style }: { children: ReactNode; color?: string; tracking?: number; style?: StyleProp<TextStyle> }) {
  return (
    <T size={12} weight="semibold" color={color} style={[{ textTransform: 'uppercase', letterSpacing: tracking }, style]}>
      {children}
    </T>
  );
}

/** rounded-2xl/3xl bg-white shadow-sm */
export function Card({ children, style, radius = 16, padding = 16 }: { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; padding?: number }) {
  return (
    <View style={[{ backgroundColor: C.white, borderRadius: radius, borderCurve: 'continuous', padding, borderWidth: 1, borderColor: C.white }, shadowSm, style]}>
      {children}
    </View>
  );
}

/** rounded-full bg-gradient-to-r from-[#5B8DEF] to-[#7C9BF6] text-white font-semibold */
export function GradientButton({
  title,
  onPress,
  loading,
  disabled,
  size = 'md',
  icon,
  style,
  colors = [C.brand, C.brandEnd],
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: [string, string];
}) {
  const pad = size === 'sm' ? { paddingVertical: 8, paddingHorizontal: 16 } : size === 'lg' ? { paddingVertical: 14, paddingHorizontal: 24 } : { paddingVertical: 11, paddingHorizontal: 20 };
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderRadius: 999 }, shadowSm, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[{ borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, pad]}>
        {loading ? <ActivityIndicator color="#fff" /> : (
          <>
            {icon}
            <T size={size === 'sm' ? 13 : 15} weight="semibold" color="#fff">{title}</T>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

/** rounded-full border border-slate-200 bg-white text-slate-700 font-semibold */
export function OutlineButton({ title, onPress, icon, color = C.slate700, disabled, style, size = 'md' }: { title: string; onPress: () => void; icon?: ReactNode; color?: string; disabled?: boolean; style?: StyleProp<ViewStyle>; size?: 'sm' | 'md' }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        { borderRadius: 999, borderWidth: 1, borderColor: C.slate200, backgroundColor: pressed ? C.slate50 : C.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: size === 'sm' ? 7 : 10, paddingHorizontal: size === 'sm' ? 14 : 18, opacity: disabled ? 0.5 : 1 },
        style,
      ]}>
      {icon}
      <T size={size === 'sm' ? 13 : 14} weight="semibold" color={color}>{title}</T>
    </Pressable>
  );
}

export function Pill({ children, bg, fg, style }: { children: ReactNode; bg: string; fg: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }, style]}>
      <T size={12} weight="semibold" color={fg}>{children}</T>
    </View>
  );
}

const TYPE_ICONS: Record<string, LucideIcon> = { BookOpen, HelpCircle, FileText, Target, BookMarked, BookOpenCheck, Clock, ClipboardList };

/** 36px rounded-xl icon chip used on the Home deadline list. */
export function TypeChip({ type }: { type: string | null | undefined }) {
  const s = typeStyle(type);
  const Icon = TYPE_ICONS[s.icon] ?? ClipboardList;
  return (
    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: s.chipBg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={16} color={s.chipFg} strokeWidth={2} />
    </View>
  );
}

/** rounded-full px-2.5 py-0.5 type badge used on the course Timeline. */
export function TypeBadge({ type }: { type: string | null | undefined }) {
  const s = typeStyle(type);
  return <Pill bg={s.badgeBg} fg={s.badgeFg}>{type || 'Deadline'}</Pill>;
}

/** 40px rounded-xl colored icon square (course info section headers, empty states). */
export function IconSquare({ icon: Icon, bg, fg, size = 40, radius = 12 }: { icon: LucideIcon; bg: string; fg: string; size?: number; radius?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={Math.round(size * 0.45)} color={fg} strokeWidth={1.75} />
    </View>
  );
}

/** The ClassMate "C" mark (Frontend/public/brand/logo.svg). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Rect width={512} height={512} rx={115} fill={C.indigo} />
      <Path d="M368 168 A128 128 0 1 0 368 344" fill="none" stroke="#FFFFFF" strokeWidth={76} strokeLinecap="round" />
    </Svg>
  );
}

/** Gradient initial avatar (bg-gradient-to-br from-[#5B8DEF] to-[#A78BFA]). */
export function Avatar({ name, size = 36 }: { name?: string | null; size?: number }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <LinearGradient colors={[C.brand, C.lavender]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <T size={Math.round(size * 0.4)} weight="bold" color="#fff">{initial}</T>
    </LinearGradient>
  );
}

/** Full-screen page background: bg-gradient-to-br from-[#F5F7FA] to-[#E8EDFB] (home) or #FAFAFA. */
export function PageBackground({ children, gradient }: { children: ReactNode; gradient?: boolean }) {
  if (!gradient) return <View style={{ flex: 1, backgroundColor: C.pageBg }}>{children}</View>;
  return (
    <LinearGradient colors={[C.homeBgFrom, C.homeBgTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      {children}
    </LinearGradient>
  );
}

/** Dashed empty-state box (rounded-2xl border border-dashed border-slate-200). */
export function DashedBox({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.slate200, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: pressed ? C.slate50 : 'transparent' }, style]}>
      {children}
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.slate100 }} />;
}

export function Spinner() {
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <ActivityIndicator color={C.brand} />
    </View>
  );
}
