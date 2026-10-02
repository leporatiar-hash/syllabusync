import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

import { DeadlineRow, useToggleDeadline } from '@/components/deadline-row';
import { Card, Empty, ErrorBanner, Loading, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { daysUntil } from '@/lib/dates';
import type { Deadline } from '@/lib/types';

export default function CourseDetail() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { data, setData, error, loading, refreshing, refresh, reload } = useApi<Deadline[]>(`/deadlines?course_id=${encodeURIComponent(id)}`);
  const toggle = useToggleDeadline(setData, (did) => api(`/deadlines/${did}/complete`, { method: 'PATCH' }));

  const { upcoming, past } = useMemo(() => {
    const all = data ?? [];
    return {
      upcoming: all.filter((d) => !d.date || daysUntil(d.date) >= 0),
      past: all.filter((d) => d.date && daysUntil(d.date) < 0).reverse(),
    };
  }, [data]);

  const list = (title: string, items: Deadline[]) =>
    items.length ? (
      <>
        <SectionHeader title={title} />
        <Card>
          {items.map((d, i) => (
            <DeadlineRow key={d.id} deadline={d} onToggle={toggle} last={i === items.length - 1} />
          ))}
        </Card>
      </>
    ) : null;

  return (
    <>
      <Stack.Screen options={{ title: name ?? 'Course' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: Spacing.four, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <Empty icon="doc.text" title="No deadlines" message="Upload this course’s syllabus on the web to pull in its deadlines." />
        ) : (
          <>
            {list('Upcoming', upcoming)}
            {list('Past', past)}
          </>
        )}
      </ScrollView>
    </>
  );
}
