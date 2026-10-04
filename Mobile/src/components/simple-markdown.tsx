import { View } from 'react-native';

import { T } from '@/components/web';
import { C } from '@/constants/theme';

/** Renders the subset of markdown our AI summaries and notes use: #/##/### headings, - / 1. lists, **bold**. */
export function SimpleMarkdown({ text }: { text: string }) {
  const inline = (s: string, key: number | string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <T key={`${key}-${i}`} size={15} weight="semibold" color={C.slate900}>{part.slice(2, -2)}</T> : part,
    );
  return (
    <View style={{ gap: 8 }}>
      {text.split('\n').map((line, i) => {
        const l = line.trimEnd();
        if (!l.trim()) return <View key={i} style={{ height: 4 }} />;
        const h = l.match(/^(#{1,3})\s+(.*)/);
        if (h) return <T key={i} size={h[1].length === 1 ? 20 : h[1].length === 2 ? 17 : 15} weight="semibold" color={C.slate900} style={{ marginTop: 8 }}>{h[2]}</T>;
        const li = l.match(/^\s*([-*•]|\d+\.|\[[ x]\])\s+(.*)/);
        if (li) {
          const bullet = /^\d/.test(li[1]) ? li[1] : li[1] === '[x]' ? '☑' : li[1] === '[ ]' ? '☐' : '•';
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: l.search(/\S/) * 4 }}>
              <T size={15} color={C.slate500}>{bullet}</T>
              <T size={15} color={C.slate700} style={{ flex: 1, lineHeight: 22 }}>{inline(li[2], i)}</T>
            </View>
          );
        }
        return <T key={i} size={15} color={C.slate700} style={{ lineHeight: 22 }}>{inline(l, i)}</T>;
      })}
    </View>
  );
}
