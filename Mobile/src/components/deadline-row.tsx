import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { Icon, Row, Text } from '@/components/ui';
import { courseColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTime, relativeDay } from '@/lib/dates';
import type { Deadline } from '@/lib/types';

export function DeadlineRow({
  deadline,
  onToggle,
  showDate = true,
  last,
}: {
  deadline: Deadline;
  onToggle: (d: Deadline) => void;
  showDate?: boolean;
  last?: boolean;
}) {
  const t = useTheme();
  const color = courseColor(deadline.course_id);
  const meta = [
    deadline.course_code || deadline.course_name || (deadline.course_id ? null : 'To do'),
    showDate && deadline.date ? relativeDay(deadline.date) : null,
    formatTime(deadline.time),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Row last={last}>
      <Pressable
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: deadline.completed }}
        accessibilityLabel={`Mark ${deadline.title ?? 'deadline'} ${deadline.completed ? 'not done' : 'done'}`}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(deadline);
        }}>
        <Icon
          name={deadline.completed ? 'checkmark.circle.fill' : 'circle'}
          size={24}
          color={deadline.completed ? t.success : t.textSecondary}
        />
      </Pressable>
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={2}
          style={deadline.completed ? { textDecorationLine: 'line-through', color: t.textSecondary } : undefined}>
          {deadline.title || 'Untitled'}
        </Text>
        {meta ? <Text variant="caption" numberOfLines={1}>{meta}</Text> : null}
      </View>
      {deadline.type ? (
        <Text variant="caption" style={{ textTransform: 'capitalize' }}>{deadline.type}</Text>
      ) : null}
    </Row>
  );
}

/** Optimistically flips completion, then syncs; rolls back on failure. */
export function useToggleDeadline(
  setList: (fn: (prev: Deadline[] | null) => Deadline[] | null) => void,
  toggle: (id: string) => Promise<unknown>,
) {
  return async (d: Deadline) => {
    const flip = (prev: Deadline[] | null) =>
      prev?.map((x) => (x.id === d.id ? { ...x, completed: !x.completed } : x)) ?? prev;
    setList(flip);
    try {
      await toggle(d.id);
    } catch {
      setList(flip);
    }
  };
}
