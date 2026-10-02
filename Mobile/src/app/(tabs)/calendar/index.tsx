import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { DeadlineRow, useToggleDeadline } from '@/components/deadline-row';
import { Card, Empty, ErrorBanner, Icon, SectionHeader, Text } from '@/components/ui';
import { courseColor, Spacing } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { parseYmd, toYmd } from '@/lib/dates';
import type { Deadline } from '@/lib/types';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Calendar() {
  const t = useTheme();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => toYmd(new Date()));

  const first = toYmd(month);
  const last = toYmd(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const { data, setData, error, refreshing, refresh, reload } = useApi<Deadline[]>(`/deadlines?from=${first}&to=${last}`);
  const toggle = useToggleDeadline(setData, (id) => api(`/deadlines/${id}/complete`, { method: 'PATCH' }));

  const byDay = useMemo(() => {
    const m = new Map<string, Deadline[]>();
    for (const d of data ?? []) if (d.date) m.set(d.date, [...(m.get(d.date) ?? []), d]);
    return m;
  }, [data]);

  // 6x7 grid starting on the Sunday on/before the 1st.
  const cells = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - month.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const shift = (n: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(next);
    setSelected(toYmd(next));
  };
  const todayYmd = toYmd(new Date());
  const items = byDay.get(selected) ?? [];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: Spacing.four, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Card style={{ padding: Spacing.three }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two }}>
          <Pressable hitSlop={12} onPress={() => shift(-1)} accessibilityLabel="Previous month">
            <Icon name="chevron.left" color={t.tint} />
          </Pressable>
          <Text variant="headline">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <Pressable hitSlop={12} onPress={() => shift(1)} accessibilityLabel="Next month">
            <Icon name="chevron.right" color={t.tint} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} variant="caption" style={{ flex: 1, textAlign: 'center' }}>{w}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d) => {
            const ymd = toYmd(d);
            const inMonth = d.getMonth() === month.getMonth();
            const isSel = ymd === selected;
            const isToday = ymd === todayYmd;
            const dots = (byDay.get(ymd) ?? []).slice(0, 3);
            return (
              <Pressable
                key={ymd}
                onPress={() => setSelected(ymd)}
                accessibilityLabel={`${d.toDateString()}, ${byDay.get(ymd)?.length ?? 0} items`}
                style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4, gap: 3 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSel ? t.tint : 'transparent',
                  }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: isToday || isSel ? '700' : '400',
                      color: isSel ? '#fff' : isToday ? t.tint : inMonth ? t.text : t.textSecondary,
                      opacity: inMonth ? 1 : 0.4,
                    }}>
                    {d.getDate()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
                  {inMonth && dots.map((x) => (
                    <View key={x.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: x.completed ? t.border : courseColor(x.course_id) }} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

      <SectionHeader title={parseYmd(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} />
      {items.length ? (
        <Card>
          {items.map((d, i) => (
            <DeadlineRow key={d.id} deadline={d} onToggle={toggle} showDate={false} last={i === items.length - 1} />
          ))}
        </Card>
      ) : (
        <Empty icon="calendar" title="Nothing due" />
      )}
    </ScrollView>
  );
}
