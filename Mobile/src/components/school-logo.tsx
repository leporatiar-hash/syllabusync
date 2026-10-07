import { useState } from 'react';
import { Image, View } from 'react-native';

import { T } from '@/components/web';
import { C } from '@/constants/theme';
import { schoolLogoUrl } from '@/lib/schools';

const TINTS = [
  ['#E0EAFF', '#3B5BDB'], ['#FCE7F3', '#BE185D'], ['#DCFCE7', '#15803D'], ['#FEF3C7', '#B45309'],
  ['#EDE9FE', '#6D28D9'], ['#FFE4E6', '#BE123C'], ['#CFFAFE', '#0E7490'], ['#FFEDD5', '#C2410C'],
] as const;

const SKIP = new Set(['of', 'the', 'and', 'at', 'in', '&', '-']);
function initials(name: string) {
  const words = name.split(/\s+/).filter((w) => w && !SKIP.has(w.toLowerCase()));
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** School crest from its site icon, on a tinted tile with initials underneath while it loads (or if it has none). */
export function SchoolLogo({ domain, name, size = 44 }: { domain?: string | null; name: string; size?: number }) {
  const [show, setShow] = useState(false);
  let h = 0;
  for (const ch of domain || name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = TINTS[h % TINTS.length];
  const radius = Math.round(size * 0.28);
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: show ? C.white : bg, borderWidth: show ? 1 : 0, borderColor: C.slate200, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {!show ? <T size={Math.round(size * 0.36)} weight="bold" color={fg}>{initials(name)}</T> : null}
      {domain ? (
        <Image
          source={{ uri: schoolLogoUrl(domain) }}
          // Sites with no icon get Google's tiny generic globe: keep the initials for those.
          onLoad={(e) => setShow((e.nativeEvent.source?.width ?? 0) >= 32)}
          style={{ position: 'absolute', width: size * 0.7, height: size * 0.7, opacity: show ? 1 : 0 }}
          resizeMode="contain"
        />
      ) : null}
    </View>
  );
}
