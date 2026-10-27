import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Cue } from '../music/take';
import { ink, serif } from '../theme';

type Syllable = { text: string; t0: number; t1: number; joined: boolean };

// A rest of more than a third of a second, or a long line, starts a new phrase.
function phrases(cues: Cue[]) {
  const out: Syllable[][] = [];
  let line: Syllable[] = [];
  let chars = 0;
  cues.forEach((c, i) => {
    const gap = i > 0 ? c.t0 - cues[i - 1].t1 : 0;
    const last = line[line.length - 1];
    if (!c.lyric) {
      if (last && gap < 0.35) last.t1 = c.t1;
      return;
    }
    if (line.length && (gap > 0.35 || (chars > 34 && !last.joined))) {
      out.push(line);
      line = [];
      chars = 0;
    }
    line.push({ text: c.lyric, t0: c.t0, t1: c.t1, joined: !!c.joined });
    chars += c.lyric.length + 1;
  });
  if (line.length) out.push(line);
  return out;
}

export function Lyrics({ cues, now }: { cues: Cue[]; now: number }) {
  const lines = useMemo(() => phrases(cues), [cues]);
  let at = lines.findIndex(l => now < l[l.length - 1].t1);
  if (at < 0) at = lines.length;

  return (
    <View style={styles.box}>
      {[lines[at], lines[at + 1]].map((line, row) => (
        <Text key={row} style={[styles.line, row > 0 && styles.next]} numberOfLines={1}>
          {line?.map((s, i) => (
            <Text key={i} style={row === 0 && s.t0 <= now ? (now < s.t1 ? styles.active : styles.sung) : undefined}>
              {s.text}
              {s.joined ? '' : ' '}
            </Text>
          )) ?? ' '}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: 20, paddingVertical: 10, gap: 4 },
  line: { color: ink.paper, fontFamily: serif, fontSize: 24, textAlign: 'center' },
  next: { color: ink.dim, fontSize: 17 },
  sung: { color: ink.bloom },
  active: { color: ink.bloom, textDecorationLine: 'underline' },
});
