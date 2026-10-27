import { toHz } from './pitch';
import type { Cue, Take } from './take';

const RATE = 22050;
const SIZE = 2048;

// A soft organ-ish tone: easy to match, no vibrato to confuse the ear.
const TABLE = (() => {
  const t = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    const x = (2 * Math.PI * i) / SIZE;
    t[i] = (Math.sin(x) + 0.35 * Math.sin(2 * x) + 0.15 * Math.sin(3 * x) + 0.05 * Math.sin(4 * x)) / 1.55;
  }
  return t;
})();

function tone(out: Float32Array, cue: Cue, origin: number, gain: number) {
  const from = Math.round((cue.t0 - origin) * RATE);
  const to = Math.min(out.length, Math.round((cue.t1 - origin) * RATE));
  const attack = 0.02 * RATE;
  const release = Math.min(0.06 * RATE, (to - from) / 3);
  const step = (toHz(cue.midi) * SIZE) / RATE;
  let phase = 0;
  for (let i = Math.max(from, 0); i < to; i++) {
    const env = Math.min(1, (i - from) / attack, (to - i) / release);
    out[i] += TABLE[phase | 0] * env * gain;
    phase = (phase + step) % SIZE;
  }
}

function click(out: Float32Array, at: number, accent: boolean) {
  const from = Math.round(at * RATE);
  const length = 0.03 * RATE;
  const hz = accent ? 1760 : 1320;
  for (let i = 0; i < length && from + i < out.length; i++) {
    out[from + i] += Math.sin((2 * Math.PI * hz * i) / RATE) * 0.5 * (1 - i / length) ** 2;
  }
}

// Audio time 0 is the first count-in click, take.start - take.countIn on the song timeline.
export function renderGuide(take: Take, own: number, others: number): Uint8Array {
  const origin = take.start - take.countIn;
  const out = new Float32Array(Math.ceil((take.end - origin + 0.5) * RATE));
  const beats = Math.round(take.countIn / take.beat);
  for (let i = 0; i < beats; i++) click(out, i * take.beat, i === 0);
  if (own > 0) for (const cue of take.cues) tone(out, cue, origin, 0.45 * own);
  if (others > 0) for (const cue of take.others) tone(out, cue, origin, 0.2 * others);

  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  return wav(out, peak > 0.95 ? 0.95 / peak : 1);
}

function wav(samples: Float32Array, gain: number) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i] * gain)) * 0x7fff, true);
  }
  return bytes;
}
