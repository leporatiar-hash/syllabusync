import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'title' | 'headline' | 'body' | 'caption' | 'secondary';

const sizes: Record<Variant, { fontSize: number; fontWeight?: '400' | '600' | '700' }> = {
  title: { fontSize: 28, fontWeight: '700' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16 },
  secondary: { fontSize: 15 },
  caption: { fontSize: 13 },
};

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const t = useTheme();
  const color = variant === 'secondary' || variant === 'caption' ? t.textSecondary : t.text;
  return <RNText style={[{ color }, sizes[variant], style]} {...rest} />;
}

export function Icon({ name, size = 20, color }: { name: SymbolViewProps['name']; size?: number; color?: string }) {
  const t = useTheme();
  return <SymbolView name={name} size={size} tintColor={color ?? t.textSecondary} />;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.card, borderRadius: 14, borderCurve: 'continuous', overflow: 'hidden' }, style]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.tint : variant === 'destructive' ? t.danger : t.card;
  const fg = variant === 'secondary' ? t.tint : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: 12,
        borderCurve: 'continuous',
        paddingVertical: 14,
        alignItems: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}>
      {loading ? <ActivityIndicator color={fg} /> : <RNText style={{ color: fg, fontSize: 17, fontWeight: '600' }}>{title}</RNText>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: Spacing.one }}>
      <Text variant="caption">{label}</Text>
      <TextInput
        placeholderTextColor={t.textSecondary}
        style={[
          {
            backgroundColor: t.card,
            color: t.text,
            borderRadius: 12,
            borderCurve: 'continuous',
            paddingHorizontal: 14,
            paddingVertical: 14,
            fontSize: 17,
            borderWidth: 1,
            borderColor: t.border,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function Row({
  children,
  onPress,
  last,
}: {
  children: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        minHeight: 48,
        backgroundColor: pressed ? t.border : 'transparent',
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: t.border,
      })}>
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text variant="caption" style={{ textTransform: 'uppercase', marginTop: Spacing.five, marginBottom: Spacing.two, marginLeft: Spacing.four }}>
      {title}
    </Text>
  );
}

export function Empty({ icon, title, message }: { icon: SymbolViewProps['name']; title: string; message?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: Spacing.five, gap: Spacing.two }}>
      <Icon name={icon} size={40} />
      <Text variant="headline" style={{ textAlign: 'center' }}>{title}</Text>
      {message ? <Text variant="secondary" style={{ textAlign: 'center' }}>{message}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onRetry} style={{ backgroundColor: t.card, borderRadius: 12, padding: Spacing.four, margin: Spacing.four, gap: Spacing.one }}>
      <Text style={{ color: t.danger, fontWeight: '600' }}>Couldn’t load</Text>
      <Text variant="secondary">{message}</Text>
      {onRetry ? <Text style={{ color: t.tint }}>Tap to retry</Text> : null}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <ActivityIndicator />
    </View>
  );
}
