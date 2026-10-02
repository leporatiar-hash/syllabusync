import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { DeadlineRow, useToggleDeadline } from '@/components/deadline-row';
import { Card, Empty, ErrorBanner, Loading, SectionHeader, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { addDays, daysUntil, toYmd } from '@/lib/dates';
import type { Deadline } from '@/lib/types';

export default function Home() {
  const t = useTheme();
  const { me } = useAuth();
  const today = new Date();
  // Two weeks back catches overdue items; two weeks ahead is the "coming up" window.
  const path = `/deadlines?from=${toYmd(addDays(today, -14))}&to=${toYmd(addDays(today, 14))}`;
  const { data, setData, error, loading, refreshing, refresh, reload } = useApi<Deadline[]>(path);
  const toggle = useToggleDeadline(setData, (id) => api(`/deadlines/${id}/complete`, { method: 'PATCH' }));

  const { overdue, todayItems, thisWeek, later } = useMemo(() => {
    const open = (data ?? []).filter((d) => d.date);
    return {
      overdue: open.filter((d) => !d.completed && daysUntil(d.date!) < 0),
      todayItems: open.filter((d) => daysUntil(d.date!) === 0),
      thisWeek: open.filter((d) => { const n = daysUntil(d.date!); return n >= 1 && n <= 7; }),
      later: open.filter((d) => daysUntil(d.date!) > 7),
    };
  }, [data]);

  const firstName = me?.profile?.full_name?.split(' ')[0];
  const dueSoon = todayItems.filter((d) => !d.completed).length + thisWeek.filter((d) => !d.completed).length;

  const section = (title: string, items: Deadline[]) =>
    items.length ? (
      <View key={title}>
        <SectionHeader title={title} />
        <Card>
          {items.map((d, i) => (
            <DeadlineRow key={d.id} deadline={d} onToggle={toggle} last={i === items.length - 1} />
          ))}
        </Card>
      </View>
    ) : null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: Spacing.four, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Text variant="secondary" style={{ marginLeft: Spacing.one }}>
        {firstName ? `Hi ${firstName}. ` : ''}
        {loading ? '' : dueSoon ? `${dueSoon} due in the next 7 days.` : 'Nothing due in the next 7 days.'}
      </Text>
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      {loading && !data ? (
        <Loading />
      ) : data && !overdue.length && !todayItems.length && !thisWeek.length && !later.length ? (
        <Empty icon="checkmark.seal" title="You’re all caught up" message="Add courses and syllabi on tryclassmate.com, or connect Canvas, and your deadlines show up here." />
      ) : (
        <>
          {section('Overdue', overdue)}
          {section('Today', todayItems)}
          {section('Next 7 days', thisWeek)}
          {section('Coming up', later)}
        </>
      )}
      <Text variant="caption" style={{ textAlign: 'center', marginTop: Spacing.five, color: t.textSecondary }}>
        Pull down to refresh
      </Text>
    </ScrollView>
  );
}
