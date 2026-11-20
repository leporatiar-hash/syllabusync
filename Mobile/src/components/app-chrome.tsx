import { router } from 'expo-router';
import { LogOut, Settings, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, T } from '@/components/web';
import { C } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

/**
 * iOS-style large title at the top of a tab's root screen, with the account avatar on the right.
 * Render it as the first child of the screen's ScrollView; it pads itself below the status bar.
 */
export function ScreenTitle({ title, eyebrow, right }: { title: string; eyebrow?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <T size={13} weight="semibold" color={C.slate500} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{eyebrow}</T> : null}
          <T size={34} weight="bold" color={C.slate900} style={{ lineHeight: 41, letterSpacing: -0.8 }}>{title}</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
          {right}
          <AccountButton />
        </View>
      </View>
    </View>
  );
}

/** Round icon button for title-bar actions (e.g. "+"). */
export function TitleAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: pressed ? C.slate200 : C.slate100, alignItems: 'center', justifyContent: 'center' })}>
      <Icon size={18} color={C.brandSolid} strokeWidth={2.25} />
    </Pressable>
  );
}

/** Avatar that opens the account menu (Settings, Log out). */
function AccountButton() {
  const insets = useSafeAreaInsets();
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const name = me?.profile?.full_name || me?.profile?.email;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityLabel="Account menu">
        <Avatar name={name} size={34} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.08)' }} onPress={() => setOpen(false)}>
          <View
            style={[
              { position: 'absolute', right: 16, top: insets.top + 56, width: 232, backgroundColor: C.white, borderRadius: 16, borderCurve: 'continuous', paddingVertical: 4 },
              { shadowColor: '#0F172A', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
            ]}>
            <T size={12} color={C.slate500} numberOfLines={1} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>{me?.profile?.email}</T>
            <View style={{ height: 1, backgroundColor: C.slate100 }} />
            <MenuItem icon={Settings} label="Settings" onPress={() => { setOpen(false); router.push('/settings'); }} />
            <MenuItem icon={LogOut} label="Log out" onPress={() => { setOpen(false); signOut(); }} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuItem({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? C.slate50 : 'transparent' })}>
      <Icon size={16} color={C.slate500} />
      <T size={15} color={C.slate800}>{label}</T>
    </Pressable>
  );
}

/** Grouped-list section header (small caps label above a card), like iOS Settings. */
export function SectionHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 }}>
      <T size={13} weight="semibold" color={C.slate500} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{children}</T>
      {right}
    </View>
  );
}
