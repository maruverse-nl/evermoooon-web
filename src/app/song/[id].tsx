import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LEVELS, type Level } from '../../music/coach';
import { noteName } from '../../music/pitch';
import type { Song } from '../../music/types';
import { fromParams, sections, toParams, type Setup } from '../../sing/setup';
import { getSong, progress } from '../../store/songs';
import { ink, mono, serif } from '../../theme';

function Choice<T extends string | number>({ options, value, onPick }: { options: [T, string][]; value: T; onPick: (v: T) => void }) {
  return (
    <View style={styles.choice}>
      {options.map(([v, label]) => (
        <Pressable key={String(v)} style={[styles.option, v === value && styles.picked]} onPress={() => onPick(v)}>
          <Text style={[styles.optionLabel, v === value && styles.pickedLabel]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [song, setSong] = useState<Song>();
  const [setup, setSetup] = useState<Setup>();
  const [best, setBest] = useState<Record<string, number>>({});
  const [error, setError] = useState<string>();

  useEffect(() => {
    getSong(id).then(s => {
      setSong(s);
      progress().then(p => setSetup(fromParams({ part: p.part[s.id] }, s)));
    }, e => setError(e.message));
  }, [id]);

  useFocusEffect(useCallback(() => void progress().then(p => setBest(p.best)), []));

  if (error) return <Text style={[styles.screen, styles.note]}>{error}</Text>;
  if (!song || !setup) return <View style={styles.screen} />;

  const set = (patch: Partial<Setup>) => setSetup({ ...setup, ...patch });
  const all = sections(song);
  const inRange = (s: { from: number; to: number }) => s.from >= setup.from && s.to <= setup.to;
  const wholeSong = setup.from === 0 && setup.to === song.bars.length - 1;

  // Tap one section to drill it, a second one to stretch the range up to it.
  const pickSection = (s: { from: number; to: number }) => {
    if (wholeSong || inRange(s)) return set({ from: s.from, to: s.to });
    set({ from: Math.min(setup.from, s.from), to: Math.max(setup.to, s.to) });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Stack.Screen options={{ title: '' }} />
      <Text style={styles.title}>{song.title}</Text>
      {song.credit && <Text style={styles.note}>{song.credit}</Text>}

      <Text style={styles.heading}>Your part</Text>
      {song.parts.map(p => {
        const midis = p.notes.map(n => n.midi);
        const score = best[`${song.id}/${p.id}`];
        return (
          <Pressable key={p.id} style={[styles.part, p.id === setup.part && styles.partPicked]} onPress={() => set({ part: p.id })}>
            <Text style={[styles.partName, p.id === setup.part && styles.pickedName]}>{p.name}</Text>
            <Text style={styles.range}>
              {noteName(Math.min(...midis))}–{noteName(Math.max(...midis))}
              {score !== undefined ? `   best ${score}` : ''}
            </Text>
          </Pressable>
        );
      })}

      <Text style={styles.heading}>What to sing</Text>
      <View style={styles.choice}>
        <Pressable style={[styles.option, wholeSong && styles.picked]} onPress={() => set({ from: 0, to: song.bars.length - 1 })}>
          <Text style={[styles.optionLabel, wholeSong && styles.pickedLabel]}>Whole song</Text>
        </Pressable>
        {all.map(s => {
          const on = !wholeSong && inRange(s);
          return (
            <Pressable key={s.from} style={[styles.option, on && styles.picked]} onPress={() => pickSection(s)}>
              <Text style={[styles.optionLabel, on && styles.pickedLabel]}>{s.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.note}>
        Bars {song.bars[setup.from].number}–{song.bars[setup.to].number}
      </Text>

      <Text style={styles.heading}>Speed</Text>
      <Choice options={[[0.6, 'Slow'], [0.8, 'Steady'], [1, 'Full']]} value={setup.speed} onPick={speed => set({ speed })} />

      <Text style={styles.heading}>Octave</Text>
      <Choice options={[[-12, 'Down'], [0, 'As written'], [12, 'Up']]} value={setup.shift} onPick={shift => set({ shift })} />

      <Text style={styles.heading}>Strictness</Text>
      <Choice
        options={(Object.keys(LEVELS) as Level[]).map(l => [l, `${l[0].toUpperCase()}${l.slice(1)} ±${LEVELS[l]}c`])}
        value={setup.level}
        onPick={level => set({ level })}
      />

      <Text style={styles.heading}>In your ears</Text>
      <Choice options={[[1, 'Play my part'], [0, 'Clicks only']]} value={setup.guide ? 1 : 0} onPick={v => set({ guide: v === 1 })} />
      <Choice options={[[1, 'Other parts soft'], [0, 'Just me']]} value={setup.others ? 1 : 0} onPick={v => set({ others: v === 1 })} />
      <Choice
        options={[[0, 'Exact octave'], [1, 'Any octave counts']]}
        value={setup.anyOctave ? 1 : 0}
        onPick={v => set({ anyOctave: v === 1 })}
      />
      <Text style={styles.note}>Wear headphones when the guide plays, or the coach hears the phone instead of you.</Text>

      <Pressable style={styles.go} onPress={() => router.push({ pathname: '/sing/[id]', params: { id: song.id, ...toParams(setup) } })}>
        <Text style={styles.goLabel}>Sing</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.stage },
  body: { padding: 20, paddingBottom: 48, gap: 8, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { color: ink.paper, fontFamily: serif, fontSize: 34 },
  note: { color: ink.dim, fontSize: 13, lineHeight: 18 },
  heading: { color: ink.dim, fontFamily: mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 22 },
  part: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ink.rule },
  partPicked: { borderBottomColor: ink.bloom, borderBottomWidth: 2 },
  partName: { color: ink.paper, fontFamily: serif, fontSize: 22 },
  pickedName: { color: ink.bloom },
  range: { color: ink.dim, fontFamily: mono, fontSize: 12 },
  choice: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { borderWidth: 1, borderColor: ink.rule, paddingVertical: 8, paddingHorizontal: 12 },
  picked: { borderColor: ink.paper, backgroundColor: ink.paper },
  optionLabel: { color: ink.paper, fontSize: 14 },
  pickedLabel: { color: ink.stage },
  go: { marginTop: 28, backgroundColor: ink.bloom, paddingVertical: 18, alignItems: 'center' },
  goLabel: { color: ink.stage, fontFamily: serif, fontSize: 24 },
});
