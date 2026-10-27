import type { Level } from '../music/coach';
import type { Song } from '../music/types';

export type Setup = {
  part: string;
  from: number;
  to: number;
  speed: number;
  shift: number;
  level: Level;
  guide: boolean;
  others: boolean;
  anyOctave: boolean;
};

type Params = Record<string, string | string[] | undefined>;

export const toParams = (s: Setup) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)]));

export function fromParams(p: Params, song: Song): Setup {
  const str = (k: string) => (Array.isArray(p[k]) ? p[k][0] : p[k]);
  const int = (k: string, fallback: number) => (str(k) === undefined ? fallback : Number(str(k)));
  const last = song.bars.length - 1;
  return {
    part: str('part') ?? song.parts[0].id,
    from: Math.min(Math.max(int('from', 0), 0), last),
    to: Math.min(Math.max(int('to', last), 0), last),
    speed: int('speed', 1),
    shift: int('shift', 0),
    level: (str('level') as Level) ?? 'normal',
    guide: str('guide') !== 'false',
    others: str('others') === 'true',
    anyOctave: str('anyOctave') === 'true',
  };
}

export function sections(song: Song) {
  const starts = song.bars.flatMap((b, i) => (b.mark || i === 0 ? [i] : []));
  return starts.map((from, i) => ({
    name: song.bars[from].mark ?? 'Start',
    from,
    to: (starts[i + 1] ?? song.bars.length) - 1,
  }));
}
