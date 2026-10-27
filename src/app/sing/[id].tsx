import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hint, judge, LEVELS, report, type Frame, type Report as Result } from '../../music/coach';
import { cents } from '../../music/pitch';
import { prepare } from '../../music/take';
import type { Song } from '../../music/types';
import { Lane } from '../../sing/Lane';
import { Lyrics } from '../../sing/Lyrics';
import { Report } from '../../sing/Report';
import { fromParams, toParams, type Setup } from '../../sing/setup';
import { Staff } from '../../sing/Staff';
import { useMic } from '../../sing/useMic';
import { usePlayback } from '../../sing/usePlayback';
import { getSong, progress, remember } from '../../store/songs';
import { ink, mono, serif } from '../../theme';

// Roughly what the mic and analysis window add before a sound reaches us.
const MIC_DELAY = 0.06;

export default function SingScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const [song, setSong] = useState<Song>();
  useEffect(() => void getSong(params.id).then(setSong), [params.id]);
  if (!song) return <View style={styles.screen} />;
  return <Session key={JSON.stringify(params)} song={song} setup={fromParams(params, song)} />;
}

const HINTS = { on: 'right there', up: 'go higher', down: 'come down' };

function Session({ song, setup }: { song: Song; setup: Setup }) {
  useKeepAwake();
  const part = song.parts.find(p => p.id === setup.part) ?? song.parts[0];
  const { from, to, speed, shift } = setup;
  const take = useMemo(() => prepare(song, part.id, { from, to, speed, shift }), [song, part.id, from, to, speed, shift]);
  const tolerance = LEVELS[setup.level];
  const playback = usePlayback(take, setup.guide ? 1 : 0, setup.others ? 1 : 0);

  const frames = useRef<Frame[]>([]);
  const hits = useRef<(number | undefined)[]>([]);
  const [now, setNow] = useState(take.start - take.countIn);
  const [result, setResult] = useState<Result>();
  const [best, setBest] = useState<number>();
  const [micError, setMicError] = useState<string>();

  const mic = useMic((midi, age) => {
    if (!playback.playing) return;
    frames.current.push({ t: playback.now() - age - MIC_DELAY, midi });
  });

  // returns false once the take is over
  const tick = useEffectEvent(() => {
    const t = playback.now();
    take.cues.forEach((c, i) => {
      if (hits.current[i] === undefined && c.t1 + 0.1 < t) hits.current[i] = judge(c, frames.current, tolerance, setup.anyOctave).hit;
    });
    setNow(t);
    if (t <= take.end + 0.4) return true;
    finish();
    return false;
  });

  useEffect(() => {
    if (!playback.playing) return;
    let frame = requestAnimationFrame(function loop() {
      if (tick()) frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [playback.playing]);

  const start = async () => {
    setMicError(undefined);
    try {
      await mic.start();
    } catch (e) {
      setMicError(e instanceof Error ? e.message : String(e));
      return;
    }
    playback.play();
  };

  const reset = async () => {
    await playback.rewind();
    frames.current = [];
    hits.current = [];
    setResult(undefined);
    setNow(take.start - take.countIn);
  };

  const finish = async () => {
    playback.pause();
    mic.stop();
    const r = report(take.cues, frames.current, setup.level, setup.anyOctave);
    setBest((await progress()).best[`${song.id}/${part.id}`]);
    setResult(r);
    remember(song.id, part.id, r.score);
  };

  const recent = frames.current.at(-1);
  const current = take.cues.find(c => c.t0 <= now && now < c.t1);
  const live =
    current && recent?.midi != null && now - recent.t < 0.25
      ? hint(cents(recent.midi, current.midi, setup.anyOctave), tolerance)
      : undefined;
  const bar = [...take.bars].reverse().find(b => b.t <= now) ?? take.bars[0];
  const counting = now < take.start;

  if (result) {
    return (
      <Report
        result={result}
        bars={song.bars}
        best={best}
        onAgain={reset}
        onLoop={(from, to) => router.replace({ pathname: '/sing/[id]', params: { id: song.id, ...toParams({ ...setup, from, to }) } })}
        onDone={() => router.back()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>Close</Text>
        </Pressable>
        <Text style={styles.where} numberOfLines={1}>
          {part.name} · bar {bar.number}
          {bar.mark ? ` · ${bar.mark}` : ''}
        </Text>
      </View>

      <Staff take={take} now={now} clef={part.clef} />
      <Lane take={take} now={now} frames={frames.current} hits={hits.current} tolerance={tolerance} anyOctave={setup.anyOctave} />

      <View style={styles.bottom}>
        <Text style={[styles.hint, live === 'on' && styles.on]}>
          {counting && playback.playing ? `${Math.ceil((take.start - now) / take.beat)}` : live ? HINTS[live] : ' '}
        </Text>
        <Lyrics cues={take.cues} now={now} />
        {micError && <Text style={styles.error}>{micError}</Text>}
        <View style={styles.controls}>
          <Pressable style={styles.small} onPress={reset}>
            <Text style={styles.smallLabel}>From the top</Text>
          </Pressable>
          <Pressable
            style={[styles.play, !playback.ready && styles.waiting]}
            disabled={!playback.ready}
            onPress={playback.playing ? playback.pause : start}
          >
            <Text style={styles.playLabel}>{!playback.ready ? 'Tuning up' : playback.playing ? 'Pause' : 'Sing'}</Text>
          </Pressable>
          <Pressable style={styles.small} onPress={finish} disabled={!frames.current.length}>
            <Text style={[styles.smallLabel, !frames.current.length && styles.off]}>Stop and score</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ink.stage },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 10 },
  back: { color: ink.dim, fontSize: 15 },
  where: { flex: 1, color: ink.paper, fontFamily: mono, fontSize: 12, textAlign: 'right' },
  bottom: { paddingBottom: 12 },
  hint: { color: ink.amber, fontFamily: serif, fontStyle: 'italic', fontSize: 18, textAlign: 'center', marginTop: 8 },
  on: { color: ink.leaf },
  error: { color: ink.bloom, textAlign: 'center', paddingHorizontal: 20 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 6 },
  play: { backgroundColor: ink.bloom, paddingVertical: 14, paddingHorizontal: 34 },
  waiting: { backgroundColor: ink.rule },
  playLabel: { color: ink.stage, fontFamily: serif, fontSize: 20 },
  small: { paddingVertical: 10 },
  smallLabel: { color: ink.dim, fontSize: 14 },
  off: { opacity: 0.4 },
});
