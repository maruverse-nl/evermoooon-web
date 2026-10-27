import { cents } from './pitch';
import type { Cue } from './take';

export type Frame = { t: number; midi: number | null };

export type Verdict = {
  cue: Cue;
  hit: number; // share of the note sung within tolerance
  offset: number | null; // median cents off, null when nothing was sung
  sag: number | null; // second half minus first half, long notes only
  late: boolean;
  silent: boolean;
};

export type Report = {
  score: number;
  verdicts: Verdict[];
  drift: number | null;
  tips: string[];
  weakest?: { from: number; to: number };
};

export const LEVELS = { easy: 70, normal: 45, strict: 25 } as const;
export type Level = keyof typeof LEVELS;

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function judge(cue: Cue, frames: Frame[], tolerance: number, anyOctave: boolean): Verdict {
  const length = cue.t1 - cue.t0;
  // the first moment of a note is a scoop for everyone, don't count it
  const from = cue.t0 + Math.min(0.12, length * 0.25);
  const heard = frames.filter(f => f.t >= from && f.t < cue.t1);
  const voiced = heard.filter((f): f is { t: number; midi: number } => f.midi !== null);
  const offsets = voiced.map(f => cents(f.midi, cue.midi, anyOctave));
  const good = offsets.filter(o => Math.abs(o) <= tolerance).length;

  const firstGood = voiced.find((f, i) => Math.abs(offsets[i]) <= tolerance);
  const half = cue.t0 + length / 2;
  const early = median(offsets.filter((_, i) => voiced[i].t < half));
  const lateHalf = median(offsets.filter((_, i) => voiced[i].t >= half));

  return {
    cue,
    hit: heard.length ? good / heard.length : 0,
    offset: median(offsets),
    sag: length >= 1.5 && early !== null && lateHalf !== null ? lateHalf - early : null,
    late: length > 0.6 && !!firstGood && firstGood.t > cue.t0 + 0.3,
    silent: voiced.length < Math.max(1, heard.length * 0.3),
  };
}

export const hint = (offset: number, tolerance: number) =>
  Math.abs(offset) <= tolerance ? 'on' : offset < 0 ? 'up' : 'down';

export function report(cues: Cue[], frames: Frame[], level: Level, anyOctave: boolean): Report {
  const tolerance = LEVELS[level];
  const verdicts = cues.map(c => judge(c, frames, tolerance, anyOctave));
  const sung = verdicts.filter(v => !v.silent && v.offset !== null);
  const drift = median(sung.map(v => v.offset!));
  const score = Math.round(100 * mean(verdicts.map(v => v.hit)));
  const tips: string[] = [];

  const silent = verdicts.filter(v => v.silent).length;
  if (silent > verdicts.length * 0.25) {
    tips.push(`${silent} of ${verdicts.length} notes had no clear sound. Sing out, or hold the phone closer.`);
  }

  if (drift !== null && drift < -15) {
    tips.push(`Overall you sit ${Math.round(-drift)} cents flat. Aim each note a hair higher and keep the breath going to the end of the phrase.`);
  } else if (drift !== null && drift > 15) {
    tips.push(`Overall you sit ${Math.round(drift)} cents sharp. Push less, let the jaw drop and the note will settle.`);
  }

  if (sung.length >= 8) {
    const byPitch = [...sung].sort((a, b) => b.cue.midi - a.cue.midi);
    const top = median(byPitch.slice(0, Math.ceil(sung.length / 4)).map(v => v.offset!))!;
    if (top < -25 && (drift ?? 0) > top + 15) {
      tips.push('Your highest notes come out flat. Try them on a lip trill first, then add the words back in.');
    }
  }

  const leaps = verdicts.filter((v, i) => i > 0 && Math.abs(v.cue.midi - verdicts[i - 1].cue.midi) >= 5 && !v.silent);
  if (leaps.length >= 3 && mean(leaps.map(v => v.hit)) < mean(sung.map(v => v.hit)) - 0.2) {
    tips.push('Big jumps land off target. Hear the next note in your head before you leave the one you are on.');
  }

  const sags = verdicts.flatMap(v => (v.sag === null ? [] : [v.sag]));
  if (sags.length >= 2 && mean(sags) < -20) {
    tips.push('Long notes sag towards the end. Keep the air moving until the note is really over.');
  }

  const late = verdicts.filter(v => v.late).length;
  if (late >= 3) tips.push(`You found the pitch late on ${late} notes. Breathe in on the beat before you come in.`);

  const weakest = weakestBars(verdicts);
  if (!tips.length && score >= 85) {
    tips.push(level === 'strict' ? 'Clean run. Try it with the guide off.' : 'Clean run. Try it on strict.');
  }

  return { score, verdicts, drift, tips, weakest };
}

// Two bars in a row with the lowest hit rate, if they are worth looping.
function weakestBars(verdicts: Verdict[]) {
  const byBar = new Map<number, number[]>();
  for (const v of verdicts) byBar.set(v.cue.bar, [...(byBar.get(v.cue.bar) ?? []), v.hit]);
  const bars = [...byBar.keys()].sort((a, b) => a - b);
  let worst: { from: number; to: number; hit: number } | undefined;
  for (let i = 0; i < bars.length; i++) {
    const to = bars[i + 1] === bars[i] + 1 ? bars[i + 1] : bars[i];
    const hit = mean([...byBar.get(bars[i])!, ...(to !== bars[i] ? byBar.get(to)! : [])]);
    if (!worst || hit < worst.hit) worst = { from: bars[i], to, hit };
  }
  return worst && worst.hit < 0.6 ? { from: worst.from, to: worst.to } : undefined;
}
