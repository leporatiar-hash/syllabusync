import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WebInput } from '@/components/course-form';
import { GradientButton, OutlineButton, T } from '@/components/web';
import { C, getCourseColor, normalizeType, typeStyle } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { toYmd } from '@/lib/dates';
import type { Deadline } from '@/lib/types';

type CalDeadline = Deadline & { saved_to_calendar?: boolean };
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS_BACK = 1;
const MONTHS_AHEAD = 5;

function monthsAround(today: Date) {
  return Array.from({ length: MONTHS_BACK + MONTHS_AHEAD + 1 }, (_, i) => new Date(today.getFullYear(), today.getMonth() - MONTHS_BACK + i, 1));
}

/** Port of the web's phone calendar: stacked months, dots per course color, tap a day for a bottom sheet. */
export default function Calendar() {
  const insets = useSafeAreaInsets();
  const today = new Date();
  const todayYmd = toYmd(today);
  const months = useMemo(() => monthsAround(today), [todayYmd]); // eslint-disable-line react-hooks/exhaustive-deps
  const from = toYmd(months[0]);
  const to = toYmd(new Date(months[months.length - 1].getFullYear(), months[months.length - 1].getMonth() + 1, 0));
  const { data, setData, refreshing, refresh, reload } = useApi<CalDeadline[]>(`/deadlines?from=${from}&to=${to}`);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulk, setBulk] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrolledOnce = useRef(false);
  const monthY = useRef<Record<number, number>>({});
  const [visibleMonth, setVisibleMonth] = useState(MONTHS_BACK);

  const byDay = useMemo(() => {
    const m = new Map<string, CalDeadline[]>();
    for (const d of data ?? []) if (d.date && !d.recurring) m.set(d.date, [...(m.get(d.date) ?? []), d]);
    return m;
  }, [data]);
  const unsaved = (data ?? []).filter((d) => !d.saved_to_calendar && !d.recurring && d.date && d.date >= todayYmd);

  const saveAll = async () => {
    setBulk(true);
    for (const d of unsaved) {
      try {
        await api(`/deadlines/${d.id}/save-to-calendar`, { method: 'POST' });
        setData((prev) => prev?.map((x) => (x.id === d.id ? { ...x, saved_to_calendar: true } : x)) ?? prev);
      } catch {}
    }
    setBulk(false);
  };

  const toggle = async (d: CalDeadline) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const flip = (prev: CalDeadline[] | null) => prev?.map((x) => (x.id === d.id ? { ...x, completed: !x.completed } : x)) ?? prev;
    setData(flip);
    try {
      await api(`/deadlines/${d.id}/complete`, { method: 'PATCH' });
    } catch {
      setData(flip);
    }
  };

  const m = months[visibleMonth] ?? months[MONTHS_BACK];
  const dayItems = selected ? byDay.get(selected) ?? [] : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.slate100, paddingHorizontal: 12, paddingVertical: 6 }}>
        {WEEKDAYS.map((w, i) => <T key={i} size={12} weight="medium" color={C.slate500} style={{ flex: 1, textAlign: 'center' }}>{w}</T>)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Pressable onPress={() => scrollRef.current?.scrollTo({ y: monthY.current[MONTHS_BACK] ?? 0, animated: true })} style={({ pressed }) => ({ borderRadius: 999, borderWidth: 1, borderColor: 'rgba(91,141,239,0.3)', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: pressed ? 'rgba(91,141,239,0.1)' : 'transparent' })}>
          <T size={12} weight="semibold" color={C.brand}>Today</T>
        </Pressable>
        <T size={17} weight="bold" color={C.slate900} style={{ letterSpacing: -0.3 }}>{m.toLocaleDateString('en-US', { month: 'long' })} {m.getFullYear()}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {unsaved.length ? (
            <Pressable onPress={saveAll} disabled={bulk} style={{ borderRadius: 999, borderWidth: 1, borderColor: C.brand, paddingHorizontal: 10, paddingVertical: 4, opacity: bulk ? 0.5 : 1 }}>
              <T size={11} weight="semibold" color={C.brand}>{bulk ? '…' : `Save (${unsaved.length})`}</T>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setCreating(true)} accessibilityLabel="Add a task" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' }}>
            <T size={20} color="#fff" style={{ lineHeight: 22 }}>+</T>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        scrollEventThrottle={64}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y + 40;
          let idx = 0;
          for (const [i, top] of Object.entries(monthY.current)) if (y >= top) idx = Math.max(idx, Number(i));
          if (idx !== visibleMonth) setVisibleMonth(idx);
        }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}>
        {months.map((month, mi) => {
          const startingDay = month.getDay();
          const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
          return (
            <View
              key={mi}
              onLayout={(e) => {
                const y = e.nativeEvent.layout.y; // read now: the event object is recycled after this handler
                monthY.current[mi] = y;
                // Open on the current month (the list starts one month back so recent past is a scroll away).
                if (mi === MONTHS_BACK && !scrolledOnce.current) {
                  scrolledOnce.current = true;
                  requestAnimationFrame(() => scrollRef.current?.scrollTo({ y, animated: false }));
                }
              }}
              style={{ marginBottom: 12 }}>
              <T size={15} weight="bold" color={C.slate900} style={{ paddingHorizontal: 4, paddingVertical: 8 }}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Array.from({ length: startingDay }).map((_, i) => <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 64 }} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const ymd = toYmd(new Date(month.getFullYear(), month.getMonth(), i + 1));
                  const items = byDay.get(ymd) ?? [];
                  const isToday = ymd === todayYmd;
                  const isSel = ymd === selected;
                  return (
                    <Pressable key={ymd} onPress={() => setSelected(ymd)} accessibilityLabel={`${ymd}, ${items.length} items`} style={{ width: `${100 / 7}%`, height: 64, alignItems: 'center', borderTopWidth: 1, borderTopColor: C.slate100, paddingTop: 4 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? C.brand : isSel ? '#EEF2FF' : 'transparent' }}>
                        <T size={14} weight={isToday ? 'semibold' : 'regular'} color={isToday ? '#fff' : C.slate700}>{i + 1}</T>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 3, height: 6, marginTop: 2 }}>
                        {items.slice(0, 3).map((d) => (
                          <View key={d.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: d.completed ? C.slate300 : getCourseColor(d.course_id).accent }} />
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Day bottom sheet */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} onPress={() => setSelected(null)}>
          <Pressable onPress={() => {}} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '60%', backgroundColor: C.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: insets.bottom + 16 }}>
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.slate300 }} /></View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <T size={16} weight="semibold" color={C.slate900} style={{ marginVertical: 8 }}>
                {selected ? new Date(selected + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
              </T>
              {dayItems.length === 0 ? <T size={14} color={C.slate400} style={{ paddingVertical: 24, textAlign: 'center' }}>No events this day</T> : (
                <View style={{ gap: 8 }}>
                  {dayItems.map((d) => {
                    const accent = getCourseColor(d.course_id).accent;
                    const ts = typeStyle(d.type);
                    return (
                      <Pressable key={d.id} onPress={() => toggle(d)} style={({ pressed }) => ({ flexDirection: 'row', borderRadius: 12, backgroundColor: '#F8F7FF', overflow: 'hidden', transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                        <View style={{ width: 4, backgroundColor: accent }} />
                        <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <T size={13} weight="semibold" color={C.slate900} style={[{ flex: 1 }, d.completed ? { textDecorationLine: 'line-through', color: C.slate400 } : null]}>{d.title}</T>
                            <View style={{ backgroundColor: ts.chipFg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <T size={10} weight="semibold" color="#fff">{normalizeType(d.type)}</T>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                            <T size={11} color={C.slate400}>{d.course_code || d.course_name || 'To do'}{d.time ? ` · ${d.time}` : ''}</T>
                            {d.completed ? <Check size={12} color={C.green} /> : null}
                            {d.saved_to_calendar ? <T size={11} color={C.green}>On calendar</T> : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                  <T size={11} color={C.slate400} style={{ textAlign: 'center', marginTop: 4 }}>Tap an item to mark it done</T>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <CreateTaskModal visible={creating} initialDate={selected ?? todayYmd} onClose={() => setCreating(false)} onCreated={reload} />
    </View>
  );
}

function CreateTaskModal({ visible, initialDate, onClose, onCreated }: { visible: boolean; initialDate: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date(initialDate + 'T12:00:00'));
  const [busy, setBusy] = useState(false);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onShow={() => { setTitle(''); setDate(new Date(initialDate + 'T12:00:00')); }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.white, padding: 20, gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={20} weight="semibold" color={C.slate900}>Add a task</T>
          <OutlineButton title="Cancel" size="sm" onPress={onClose} />
        </View>
        <WebInput label="What do you need to do?" placeholder="e.g. Buy blue books" value={title} onChangeText={setTitle} autoFocus />
        <View style={{ gap: 6 }}>
          <T size={14} weight="medium" color={C.slate700}>Due</T>
          <DateTimePicker value={date} mode="date" display="inline" accentColor={C.brand} onChange={(_, d) => d && setDate(d)} />
        </View>
        <GradientButton
          title="Add to To Do list"
          size="lg"
          loading={busy}
          disabled={!title.trim()}
          onPress={async () => {
            setBusy(true);
            try {
              await api('/deadlines', { method: 'POST', body: JSON.stringify({ title: title.trim(), date: toYmd(date), type: 'Deadline' }) });
              onCreated();
              onClose();
            } catch (e) {
              Alert.alert('Couldn’t add task', e instanceof Error ? e.message : '');
            } finally {
              setBusy(false);
            }
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
