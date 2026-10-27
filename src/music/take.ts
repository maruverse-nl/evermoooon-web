import { clock } from './time';
import type { Bar, Note, Song } from './types';

// A note placed on the playback timeline, in seconds at the chosen speed.
export type Cue = Note & { t0: number; t1: number };

export type Take = {
  cues: Cue[];
  others: Cue[];
  bars: (Bar & { t: number; index: number })[];
  start: number;
  end: number;
  countIn: number;
  beat: number;
  low: number;
  high: number;
};

export type TakeOptions = { from: number; to: number; speed: number; shift: number };

export function prepare(song: Song, partId: string, { from, to, speed, shift }: TakeOptions): Take {
  const sec = clock(song);
  const at = (q: number) => sec(q) / speed;
  const first = song.bars[from];
  const last = song.bars[to];
  const qFrom = first.start;
  const qTo = last.start + last.length;

  const place = (n: Note, transpose: number): Cue => ({ ...n, midi: n.midi + transpose, t0: at(n.start), t1: at(n.start + n.length) });
  const within = (n: Note) => n.start >= qFrom - 1e-6 && n.start < qTo - 1e-6;

  const part = song.parts.find(p => p.id === partId) ?? song.parts[0];
  const cues = part.notes.filter(within).map(n => place(n, shift));
  const others = song.parts.filter(p => p !== part).flatMap(p => p.notes.filter(within).map(n => place(n, 0)));

  const beat = at(qFrom + 4 / first.beatType) - at(qFrom);
  const midis = cues.length ? cues.map(c => c.midi) : part.notes.map(n => n.midi + shift);
  return {
    cues,
    others,
    bars: song.bars.slice(from, to + 1).map((b, i) => ({ ...b, t: at(b.start), index: from + i })),
    start: at(qFrom),
    end: at(qTo),
    countIn: beat * Math.min(first.beats, 4),
    beat,
    low: Math.min(...midis),
    high: Math.max(...midis),
  };
}
