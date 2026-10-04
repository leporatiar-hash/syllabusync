import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BackBar } from '@/components/back-bar';
import { Card, OutlineButton, PageBackground, Spinner, T } from '@/components/web';
import { C, shadowSm } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';

type Card_ = { id: string; front: string; back: string; grade: 'known' | 'learning' | null };
type FlashSet = { id: string; name: string; flashcards: Card_[] };

export default function Flashcards() {
  const { toolId } = useLocalSearchParams<{ toolId: string }>();
  const { data, setData } = useApi<FlashSet>(`/flashcard-sets/${toolId}`);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cards = data?.flashcards ?? [];
  const card = cards[i];
  const known = useMemo(() => cards.filter((c) => c.grade === 'known').length, [cards]);

  const go = (n: number) => {
    setFlipped(false);
    setI((x) => Math.max(0, Math.min(cards.length - 1, x + n)));
  };
  const grade = async (g: 'known' | 'learning') => {
    if (!card) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setData((d) => (d ? { ...d, flashcards: d.flashcards.map((c) => (c.id === card.id ? { ...c, grade: g } : c)) } : d));
    api(`/flashcards/${card.id}/grade`, { method: 'PATCH', body: JSON.stringify({ grade: g }) }).catch(() => {});
    if (i < cards.length - 1) go(1);
  };

  return (
    <PageBackground>
      <BackBar label="Study Tools" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {!data ? <Spinner /> : (
          <>
            <View>
              <T size={22} weight="semibold" color={C.slate900}>{data.name}</T>
              <T size={13} color={C.slate500} style={{ marginTop: 4 }}>Card {Math.min(i + 1, cards.length)} of {cards.length} · {known} known</T>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: C.slate100, marginTop: 10, overflow: 'hidden' }}>
                <View style={{ width: `${cards.length ? ((i + 1) / cards.length) * 100 : 0}%`, height: '100%', backgroundColor: C.brand }} />
              </View>
            </View>
            {card ? (
              <Pressable onPress={() => { Haptics.selectionAsync(); setFlipped((f) => !f); }} accessibilityHint="Tap to flip">
                <Card radius={24} padding={28} style={[{ minHeight: 300, justifyContent: 'center', backgroundColor: flipped ? '#F5F7FF' : C.white }, shadowSm]}>
                  <T size={12} weight="semibold" color={flipped ? C.brand : C.slate400} style={{ textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' }}>{flipped ? 'Answer' : 'Question'}</T>
                  <T size={20} weight="medium" color={C.slate900} style={{ textAlign: 'center', marginTop: 16, lineHeight: 28 }}>{flipped ? card.back : card.front}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 }}>
                    <RotateCcw size={13} color={C.slate400} />
                    <T size={12} color={C.slate400}>Tap to flip</T>
                  </View>
                </Card>
              </Pressable>
            ) : <T color={C.slate500}>This set has no cards.</T>}
            {card ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <OutlineButton title="Still learning" color={C.orange} style={{ flex: 1 }} onPress={() => grade('learning')} />
                  <OutlineButton title="Got it" color={C.green} icon={<Check size={15} color={C.green} />} style={{ flex: 1 }} onPress={() => grade('known')} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Pressable onPress={() => go(-1)} disabled={i === 0} style={{ flexDirection: 'row', alignItems: 'center', opacity: i === 0 ? 0.3 : 1, padding: 8 }}>
                    <ChevronLeft size={18} color={C.slate600} /><T weight="medium" color={C.slate600}>Previous</T>
                  </Pressable>
                  <Pressable onPress={() => go(1)} disabled={i >= cards.length - 1} style={{ flexDirection: 'row', alignItems: 'center', opacity: i >= cards.length - 1 ? 0.3 : 1, padding: 8 }}>
                    <T weight="medium" color={C.slate600}>Next</T><ChevronRight size={18} color={C.slate600} />
                  </Pressable>
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </PageBackground>
  );
}
