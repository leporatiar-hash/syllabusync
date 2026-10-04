import { ArrowUp } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';

import { C, F, shadowSm } from '@/constants/theme';

export const CHAT_BRAND = '#5B4EE8';
export const CHAT_SOFT_BG = '#EEEDFE';
export const CHAT_SOFT_TEXT = '#3C3489';

/** Rounded composer like the web ChatComposer. */
export function ChatComposer({ value, onChange, onSubmit, sending, autoFocus }: { value: string; onChange: (v: string) => void; onSubmit: () => void; sending: boolean; autoFocus?: boolean }) {
  const can = !!value.trim() && !sending;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.slate200, borderRadius: 20, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 }, shadowSm]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Message ClassMate"
        placeholderTextColor={C.slate400}
        multiline
        autoFocus={autoFocus}
        style={{ flex: 1, maxHeight: 120, fontFamily: F.regular, fontSize: 15, color: C.slate900, paddingTop: 8, paddingBottom: 8 }}
      />
      <Pressable onPress={onSubmit} disabled={!can} accessibilityLabel="Send" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: can ? CHAT_BRAND : C.slate200, alignItems: 'center', justifyContent: 'center' }}>
        <ArrowUp size={18} color="#fff" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}
