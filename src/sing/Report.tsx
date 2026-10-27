import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Report as Result } from '../music/coach';
import type { Bar } from '../music/types';
import { ink, mono, serif } from '../theme';

type Props = {
  result: Result;
  bars: Bar[];
  best?: number;
  onAgain: () => void;
  onLoop: (from: number, to: number) => void;
  onDone: () => void;
};

const verdictColor = (hit: number, silent: boolean) =>
  silent ? ink.rule : hit >= 0.6 ? ink.leaf : hit >= 0.3 ? ink.amber : ink.miss;

export function Report({ result, bars, best, onAgain, onLoop, onDone }: Props) {
  const { score, verdicts, tips, weakest } = result;
  const onPitch = verdicts.filter(v => v.hit >= 0.6).length;

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={styles.body}>
      <Text style={styles.score}>{score}</Text>
      <Text style={styles.sub}>
        {onPitch} of {verdicts.length} notes on pitch
        {best !== undefined && score > best ? '   new best' : best !== undefined ? `   best ${best}` : ''}
      </Text>

      <View style={styles.strip}>
        {verdicts.map((v, i) => (
          <View key={i} style={[styles.cell, { backgroundColor: verdictColor(v.hit, v.silent) }]} />
        ))}
      </View>

      {tips.map((tip, i) => (
        <Text key={i} style={styles.tip}>
          {tip}
        </Text>
      ))}

      <View style={styles.actions}>
        {weakest && (
          <Pressable style={[styles.button, styles.loud]} onPress={() => onLoop(weakest.from, weakest.to)}>
            <Text style={[styles.label, styles.loudLabel]}>
              Drill bars {bars[weakest.from].number}
              {weakest.to !== weakest.from ? `–${bars[weakest.to].number}` : ''}
            </Text>
          </Pressable>
        )}
        <Pressable style={styles.button} onPress={onAgain}>
          <Text style={styles.label}>Sing it again</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onDone}>
          <Text style={styles.label}>Back to the song</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { ...StyleSheet.absoluteFill, backgroundColor: ink.stage },
  body: { padding: 28, paddingTop: 48, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  score: { color: ink.bloom, fontFamily: serif, fontSize: 88, lineHeight: 92 },
  sub: { color: ink.dim, fontFamily: mono, fontSize: 12, letterSpacing: 1 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginVertical: 8 },
  cell: { width: 7, height: 14 },
  tip: { color: ink.paper, fontSize: 16, lineHeight: 23, borderLeftWidth: 2, borderLeftColor: ink.bloom, paddingLeft: 12 },
  actions: { marginTop: 16, gap: 10 },
  button: { borderWidth: 1, borderColor: ink.rule, paddingVertical: 14, paddingHorizontal: 18 },
  loud: { backgroundColor: ink.bloom, borderColor: ink.bloom },
  label: { color: ink.paper, fontSize: 16 },
  loudLabel: { color: ink.stage, fontWeight: '600' },
});
