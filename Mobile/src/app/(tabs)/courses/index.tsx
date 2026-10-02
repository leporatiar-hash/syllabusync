import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Card, Empty, ErrorBanner, Icon, Loading, Row, Text } from '@/components/ui';
import { courseColor, Spacing } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import type { Course } from '@/lib/types';

export default function Courses() {
  const { data, error, loading, refreshing, refresh, reload } = useApi<Course[]>('/courses');

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: Spacing.four, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
      {loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <Empty icon="books.vertical" title="No courses yet" message="Add a course and upload its syllabus on tryclassmate.com, or connect Canvas in Settings on the web." />
      ) : (
        <Card>
          {data.map((c, i) => (
            <Row key={c.id} last={i === data.length - 1} onPress={() => router.push({ pathname: '/courses/[id]', params: { id: c.id, name: c.name } })}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: courseColor(c.id, c.color) }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontWeight: '600' }}>{c.name}</Text>
                <Text variant="caption" numberOfLines={1}>
                  {[c.code, c.semester, `${c.deadline_count} deadline${c.deadline_count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Icon name="chevron.right" size={14} />
            </Row>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
