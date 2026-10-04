import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BookOpen, CalendarDays, Home, LogOut, MessageCircle, Settings, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, LogoMark, T } from '@/components/web';
import { C, shadowSm } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export const HEADER_HEIGHT = 64;

/** sticky h-16 white header with border-b, logo + "ClassMate", avatar menu (Frontend/components/SiteChrome + Nav). */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const name = me?.profile?.full_name || me?.profile?.email;

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.7)' }}>
      <View style={{ height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.navigate('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel="ClassMate home">
          <LogoMark size={32} />
          <T size={16} weight="semibold" color={C.brandText} style={{ letterSpacing: -0.2 }}>ClassMate</T>
        </Pressable>
        <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityLabel="Account menu">
          <Avatar name={name} size={36} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)}>
          <View
            style={[
              { position: 'absolute', right: 16, top: insets.top + HEADER_HEIGHT - 4, width: 224, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.slate100, paddingVertical: 4 },
              { shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
            ]}>
            <T size={12} color={C.slate500} numberOfLines={1} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>{me?.profile?.email}</T>
            <View style={{ height: 1, backgroundColor: C.slate100 }} />
            <MenuItem icon={Settings} label="Settings" onPress={() => { setOpen(false); router.push('/settings'); }} />
            <MenuItem icon={LogOut} label="Log out" onPress={() => { setOpen(false); signOut(); }} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuItem({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? C.slate50 : 'transparent' })}>
      <Icon size={16} color={C.slate400} />
      <T size={14} color={C.slate700}>{label}</T>
    </Pressable>
  );
}

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  '(home)': { label: 'Home', icon: Home },
  courses: { label: 'Courses', icon: BookOpen },
  calendar: { label: 'Calendar', icon: CalendarDays },
  chat: { label: 'Chat', icon: MessageCircle },
};

/** fixed bottom tab bar: white/95, border-t slate-200/80, 4 equal tabs, 22px lucide icons, 10px labels (MobileTabBar.tsx). */
export function WebTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.8)', paddingBottom: insets.bottom }, shadowSm]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const active = state.index === index;
        const Icon = tab.icon;
        const color = active ? C.brand : C.slate500;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!active && !e.defaultPrevented) {
                Haptics.selectionAsync();
                navigation.navigate(route.name);
              } else if (active) {
                // Re-tapping the active tab pops back to its root, like the web nav link.
                navigation.navigate(route.name, { screen: 'index' });
              }
            }}
            style={{ flex: 1, height: 55, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Icon size={22} color={color} strokeWidth={active ? 2.25 : 1.75} />
            <T size={10} weight="medium" color={color} style={{ lineHeight: 13 }}>{tab.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
