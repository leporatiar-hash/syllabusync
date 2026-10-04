import { useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { BackBar } from '@/components/back-bar';
import { SimpleMarkdown } from '@/components/simple-markdown';
import { Card, PageBackground, Spinner, T } from '@/components/web';
import { C } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';

export default function Summary() {
  const { toolId } = useLocalSearchParams<{ toolId: string }>();
  const { data } = useApi<{ id: string; title: string; content: string }>(`/summaries/${toolId}`);
  return (
    <PageBackground>
      <BackBar label="Study Tools" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        {!data ? <Spinner /> : (
          <>
            <T size={22} weight="semibold" color={C.slate900}>{data.title}</T>
            <Card radius={24} padding={20}><SimpleMarkdown text={data.content} /></Card>
          </>
        )}
      </ScrollView>
    </PageBackground>
  );
}
