import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text } from 'react-native-svg';
import type { Take } from '../music/take';
import type { Clef } from '../music/types';
import { ink, serif } from '../theme';
import { GUTTER, PPS, playheadX } from './Lane';

const SPACE = 9;
const HEIGHT = 128;
const MIDDLE = 52; // y of the middle staff line
const SHARPS = 'FCGDAEB';
const FLATS = 'BEADGCF';
// diatonic step of the middle line: B4 on treble, D3 on bass
const CENTER: Record<Clef, number> = { treble: 34, treble8: 27, bass: 22 };
const KEY_SHARPS = [38, 35, 39, 36, 33, 37, 34];
const KEY_FLATS = [34, 37, 33, 36, 32, 35, 31];

const keyAlter = (letter: string, fifths: number) =>
  fifths > 0 && SHARPS.slice(0, fifths).includes(letter) ? 1 : fifths < 0 && FLATS.slice(0, -fifths).includes(letter) ? -1 : 0;
const SIGN: Record<number, string> = { [-2]: '♭♭', [-1]: '♭', 0: '♮', 1: '♯', 2: 'x' };

export function Staff({ take, now, clef }: { take: Take; now: number; clef: Clef }) {
  const [width, setWidth] = useState(0);
  const head = playheadX(width);
  const x = (t: number) => head + (t - now) * PPS;
  const y = (step: number) => MIDDLE - (step - CENTER[clef]) * (SPACE / 2);
  const fifths = take.bars[0]?.fifths ?? 0;

  // accidentals carry through the bar, like on paper
  const notes = useMemo(() => {
    let bar = -1;
    let seen = new Map<number, number>();
    return take.cues.map(c => {
      if (c.bar !== bar) [bar, seen] = [c.bar, new Map()];
      const letter = 'CDEFGAB'[((c.step % 7) + 7) % 7];
      const expected = seen.get(c.step) ?? keyAlter(letter, take.bars.find(b => b.index === c.bar)?.fifths ?? fifths);
      seen.set(c.step, c.alter);
      return { ...c, accidental: c.alter !== expected ? SIGN[c.alter] : undefined };
    });
  }, [take, fifths]);

  const keySteps = (fifths >= 0 ? KEY_SHARPS : KEY_FLATS)
    .slice(0, Math.abs(fifths))
    .map(s => s - 34 + CENTER[clef] - (clef === 'bass' ? 2 : 0));

  return (
    <View style={styles.staff} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {[-2, -1, 0, 1, 2].map(i => (
            <Line key={i} x1={0} x2={width} y1={MIDDLE + i * SPACE} y2={MIDDLE + i * SPACE} stroke={ink.dim} strokeWidth={1} />
          ))}

          {take.bars.map(b =>
            x(b.t) > GUTTER && x(b.t) < width ? (
              <Line key={b.index} x1={x(b.t)} x2={x(b.t)} y1={MIDDLE - 2 * SPACE} y2={MIDDLE + 2 * SPACE} stroke={ink.dim} />
            ) : null,
          )}

          {notes.map((n, i) => {
            const nx = x(n.t0) + 8;
            if (nx < GUTTER - 10 || nx > width + 10) return null;
            const ny = y(n.step);
            const active = n.t0 <= now && now < n.t1;
            const color = active ? ink.bloom : ink.paper;
            const d = n.step - CENTER[clef];
            const ledgers: number[] = [];
            for (let l = 6; l <= Math.abs(d); l += 2) ledgers.push(MIDDLE - Math.sign(d) * l * (SPACE / 2));
            const up = ny > MIDDLE;
            const hollow = n.length >= 2;
            const dotted = [0.75, 1.5, 3].includes(n.length);
            return (
              <G key={i}>
                {ledgers.map(ly => (
                  <Line key={ly} x1={nx - 9} x2={nx + 9} y1={ly} y2={ly} stroke={ink.dim} />
                ))}
                {n.accidental && (
                  <Text x={nx - 11} y={ny + 4} fill={color} fontSize={13} textAnchor="end">
                    {n.accidental}
                  </Text>
                )}
                <Ellipse
                  cx={nx}
                  cy={ny}
                  rx={SPACE * 0.62}
                  ry={SPACE * 0.44}
                  rotation={-20}
                  origin={`${nx}, ${ny}`}
                  fill={hollow ? 'none' : color}
                  stroke={color}
                  strokeWidth={hollow ? 1.6 : 0}
                />
                {n.length < 4 && (
                  <Line x1={up ? nx + 5.2 : nx - 5.2} x2={up ? nx + 5.2 : nx - 5.2} y1={ny} y2={ny + (up ? -3.3 : 3.3) * SPACE} stroke={color} strokeWidth={1.2} />
                )}
                {dotted && <Circle cx={nx + 10} cy={d % 2 === 0 ? ny - SPACE / 2 : ny} r={1.6} fill={color} />}
                {n.lyric && (
                  <Text x={nx} y={HEIGHT - 10} fill={active ? ink.bloom : ink.dim} fontSize={12} fontFamily={serif} textAnchor="middle">
                    {n.joined ? `${n.lyric}-` : n.lyric}
                  </Text>
                )}
              </G>
            );
          })}

          <Line x1={head} x2={head} y1={MIDDLE - 3.5 * SPACE} y2={MIDDLE + 3.5 * SPACE} stroke={ink.bloom} strokeOpacity={0.5} />

          <Rect x={0} y={0} width={GUTTER + 26 + keySteps.length * 8} height={HEIGHT} fill={ink.stage} />
          {[-2, -1, 0, 1, 2].map(i => (
            <Line key={i} x1={6} x2={GUTTER + 26 + keySteps.length * 8} y1={MIDDLE + i * SPACE} y2={MIDDLE + i * SPACE} stroke={ink.dim} />
          ))}
          <ClefMark clef={clef} />
          {keySteps.map((s, i) => (
            <Text key={i} x={GUTTER + 12 + i * 8} y={y(s) + 4} fill={ink.paper} fontSize={13} textAnchor="middle">
              {fifths > 0 ? '♯' : '♭'}
            </Text>
          ))}
        </Svg>
      )}
    </View>
  );
}

// Drawn in staff spaces around the clef's own line, so no music font is needed.
function ClefMark({ clef }: { clef: Clef }) {
  const s = SPACE;
  if (clef === 'bass') {
    const fy = MIDDLE - s;
    return (
      <G>
        <Path
          d={`M ${14} ${fy} C ${14} ${fy - 1.3 * s}, ${14 + 2.2 * s} ${fy - 1.4 * s}, ${14 + 2.2 * s} ${fy + 0.3 * s} C ${14 + 2.2 * s} ${fy + 2 * s}, ${14 + 0.8 * s} ${fy + 2.9 * s}, ${12} ${fy + 3.2 * s}`}
          stroke={ink.paper}
          strokeWidth={2.2}
          fill="none"
        />
        <Circle cx={15} cy={fy} r={2.8} fill={ink.paper} />
        <Circle cx={14 + 2.9 * s} cy={fy - s / 2} r={1.6} fill={ink.paper} />
        <Circle cx={14 + 2.9 * s} cy={fy + s / 2} r={1.6} fill={ink.paper} />
      </G>
    );
  }
  const gx = 22;
  const gy = MIDDLE + s;
  const p = (dx: number, dy: number) => `${gx + dx * s} ${gy + dy * s}`;
  return (
    <G>
      <Path
        d={`M ${p(-0.3, 2.2)} C ${p(-0.3, 2.9)}, ${p(0.7, 2.9)}, ${p(0.6, 2.0)} L ${p(0.05, -2.9)} C ${p(-0.05, -3.9)}, ${p(1.0, -4.6)}, ${p(0.9, -3.3)} C ${p(0.8, -2.2)}, ${p(-1.1, -1.4)}, ${p(-1.1, 0.1)} C ${p(-1.1, 1.3)}, ${p(1.1, 1.3)}, ${p(1.2, 0.2)} C ${p(1.25, -0.7)}, ${p(0.0, -0.9)}, ${p(-0.15, 0.1)}`}
        stroke={ink.paper}
        strokeWidth={2}
        fill="none"
      />
      {clef === 'treble8' && (
        <Text x={gx} y={gy + 4.6 * s} fill={ink.paper} fontSize={9} textAnchor="middle">
          8
        </Text>
      )}
    </G>
  );
}

const styles = StyleSheet.create({
  staff: { height: HEIGHT, backgroundColor: ink.stage },
});
