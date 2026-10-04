import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton, T } from '@/components/web';
import { C, F } from '@/constants/theme';

// Same swatches as the web color picker (Frontend/lib/courseColors.ts COLOR_PICKER_SWATCHES).
const SWATCHES = ['#5B8DEF', '#F87171', '#4ADE80', '#A78BFA', '#FBBF24', '#2DD4BF', '#F472B6', '#6366F1', '#FB923C', '#22D3EE'];

export type CourseFormValues = { name: string; code: string; semester: string; color: string | null };

export function WebInput(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <T size={14} weight="medium" color={C.slate700}>{label}</T>
      <TextInput
        placeholderTextColor={C.slate400}
        style={[{ borderWidth: 1, borderColor: C.slate200, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: F.regular, color: C.slate900, backgroundColor: C.white }, style]}
        {...rest}
      />
    </View>
  );
}

/** Bottom-sheet style modal for Add / Edit course, styled like the web modal. */
export function CourseFormModal({
  visible,
  title,
  initial,
  showColor,
  submitLabel,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  initial?: Partial<CourseFormValues>;
  showColor?: boolean;
  submitLabel: string;
  onSubmit: (v: CourseFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [v, setV] = useState<CourseFormValues>({ name: '', code: '', semester: '', color: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setV({ name: initial?.name ?? '', code: initial?.code ?? '', semester: initial?.semester ?? '', color: initial?.color ?? null });
    setError(null);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onShow={reset}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.white }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 8 }}>
          <T size={20} weight="semibold" color={C.slate900}>{title}</T>
          <Pressable onPress={onClose} hitSlop={10}><T size={15} weight="medium" color={C.slate500}>Cancel</T></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 24 }}>
          <WebInput label="Course name" placeholder="e.g. Investment Analysis" value={v.name} onChangeText={(name) => setV({ ...v, name })} autoFocus />
          <WebInput label="Course code" placeholder="e.g. FINC 400" value={v.code} onChangeText={(code) => setV({ ...v, code })} autoCapitalize="characters" />
          <WebInput label="Semester" placeholder="e.g. Fall 2026" value={v.semester} onChangeText={(semester) => setV({ ...v, semester })} />
          {showColor ? (
            <View style={{ gap: 8 }}>
              <T size={14} weight="medium" color={C.slate700}>Color</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {SWATCHES.map((hex) => {
                  const on = v.color?.toUpperCase() === hex.toUpperCase();
                  return (
                    <Pressable key={hex} onPress={() => setV({ ...v, color: hex })} accessibilityLabel={`Color ${hex}`} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: hex, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 3 : 0, borderColor: C.slate900 }}>
                      {on ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          {error ? <T color={C.red}>{error}</T> : null}
          <GradientButton
            title={submitLabel}
            size="lg"
            loading={busy}
            disabled={!v.name.trim()}
            style={{ marginTop: 8 }}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await onSubmit({ ...v, name: v.name.trim(), code: v.code.trim(), semester: v.semester.trim() });
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Something went wrong');
              } finally {
                setBusy(false);
              }
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
