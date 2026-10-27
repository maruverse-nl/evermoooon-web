import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text } from 'react-native-svg';
import type { Frame } from '../music/coach';
import { cents, noteName } from '../music/pitch';
import type { Take } from '../music/take';
import { ink, mono } from '../theme';

export const PPS = 110;
export const GUTTER = 46;
export const playheadX = (width: number) => GUTTER + (width - GUTTER) * 0.26;

type Props = {
  take: Take;
  now: number;
  frames: Frame[];
  hits: (number | undefined)[];
  tolerance: number;
  anyOctave: boolean;
};

const hitColor = (hit: number) => (hit >= 0.6 ? ink.leaf : hit >= 0.3 ? ink.amber : ink.miss);

export function Lane({ take, now, frames, hits, tolerance, anyOctave }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const top = take.high + 3;
  const span = Math.max(14, take.high - take.low + 6);
  const row = height / span;
  const y = (midi: number) => (top - midi) * row;
  const head = playheadX(width);
  const x = (t: number) => head + (t - now) * PPS;
  const visible = (t0: number, t1: number) => x(t1) > GUTTER && x(t0) < width;

  const sungNames = [...new Set(take.cues.map(c => c.midi))];
  const current = take.cues.find(c => c.t0 <= now && now < c.t1);
  const trail = frames.filter(f => f.t > now - (head - GUTTER) / PPS && f.t <= now);

  // With "any octave" the trail is drawn in the octave of the nearest target note
  const place = (f: Frame & { midi: number }) => {
    const target = take.cues.find(c => c.t0 <= f.t && f.t < c.t1 + 0.15);
    const midi = anyOctave && target ? target.midi + cents(f.midi, target.midi, true) / 100 : f.midi;
    const on = !!target && Math.abs(cents(f.midi, target.midi, anyOctave)) <= tolerance;
    return { midi: Math.max(top - span, Math.min(top, midi)), on };
  };

  return (
    <View style={styles.lane} onLayout={e => setSize(e.nativeEvent.layout)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {Array.from({ length: span }, (_, i) => top - i).map(m => (
            <Line key={m} x1={GUTTER} x2={width} y1={y(m)} y2={y(m)} stroke={ink.rule} strokeWidth={m % 12 === 0 ? 1 : 0.5} />
          ))}

          {take.bars.filter(b => visible(b.t, b.t)).map(b => (
            <G key={b.index}>
              <Line x1={x(b.t)} x2={x(b.t)} y1={0} y2={height} stroke={ink.rule} strokeWidth={1} />
              <Text x={x(b.t) + 4} y={12} fill={ink.dim} fontSize={10} fontFamily={mono}>
                {b.mark ? `${b.number}  ${b.mark}` : b.number}
              </Text>
            </G>
          ))}

          {take.cues.map((c, i) => {
            if (!visible(c.t0, c.t1)) return null;
            const active = c === current;
            const done = hits[i] !== undefined;
            const h = Math.max(6, row * 0.72);
            return (
              <Rect
                key={i}
                x={x(c.t0) + 1}
                y={y(c.midi) - h / 2}
                width={Math.max(4, (c.t1 - c.t0) * PPS - 2)}
                height={h}
                rx={h / 2}
                fill={done ? hitColor(hits[i]!) : active ? ink.bloom : ink.raised}
                stroke={done ? 'none' : active ? ink.bloom : ink.paper}
                strokeOpacity={0.55}
                strokeWidth={1.2}
              />
            );
          })}

          {trail.map((f, i) => {
            if (f.midi === null) return null;
            const p = place(f as Frame & { midi: number });
            return <Circle key={i} cx={x(f.t)} cy={y(p.midi)} r={2.4} fill={p.on ? ink.leaf : ink.paper} opacity={p.on ? 1 : 0.6} />;
          })}

          <Line x1={head} x2={head} y1={0} y2={height} stroke={ink.paper} strokeOpacity={0.4} strokeWidth={1.5} />

          <Rect x={0} y={0} width={GUTTER} height={height} fill={ink.stage} />
          {sungNames.map(m => (
            <Text key={m} x={GUTTER - 6} y={y(m) + 4} fill={ink.dim} fontSize={10} fontFamily={mono} textAnchor="end">
              {noteName(m)}
            </Text>
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lane: { flex: 1, backgroundColor: ink.stage },
});
