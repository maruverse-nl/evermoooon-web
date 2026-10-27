import { DOMParser, type Element } from '@xmldom/xmldom';
import type { Bar, Clef, Note, Part, Song, Tempo } from './types';

const SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const SECTION = /^(intro|verse|pre-?chorus|chorus|bridge|outro|coda|interlude|refrain|ending|tag)\b/i;
const BEAT_UNIT: Record<string, number> = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 };

const kids = (el: Element, tag: string) =>
  Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1 && (n as Element).tagName === tag);
const kid = (el: Element | undefined, tag: string): Element | undefined => (el ? kids(el, tag)[0] : undefined);
const text = (el: Element | undefined, tag: string) => kid(el, tag)?.textContent?.trim() || undefined;
const num = (el: Element | undefined, tag: string, fallback: number) => {
  const t = text(el, tag);
  return t === undefined || isNaN(Number(t)) ? fallback : Number(t);
};

type Draft = Note & { tieStart: boolean };

export function parseMusicXml(xml: string, id: string): Song {
  const root = new DOMParser().parseFromString(xml, 'text/xml').documentElement;
  if (root?.tagName === 'score-timewise') throw new Error('This is timewise MusicXML. Export it again as partwise (the default).');
  if (root?.tagName !== 'score-partwise') throw new Error('This file is not a MusicXML score.');

  const names = new Map<string, string>();
  for (const sp of Array.from(root.getElementsByTagName('score-part'))) {
    names.set(sp.getAttribute('id') ?? '', text(sp, 'part-name') ?? text(sp, 'part-abbreviation') ?? 'Part');
  }

  const bars: Bar[] = [];
  const tempos: Tempo[] = [];
  const parts: Part[] = [];

  kids(root, 'part').forEach((xmlPart, pi) => {
    const voices = new Map<string, Draft[]>();
    const clefs = new Map<number, Clef>();
    let divisions = 1, fifths = 0, beats = 4, beatType = 4, transpose = 0;
    let at = 0;

    kids(xmlPart, 'measure').forEach((measure, mi) => {
      let cursor = 0, longest = 0, lastStart = 0;
      let mark: string | undefined;

      for (const el of Array.from(measure.childNodes) as Element[]) {
        if (el.nodeType !== 1) continue;
        switch (el.tagName) {
          case 'attributes': {
            divisions = num(el, 'divisions', divisions);
            fifths = num(kid(el, 'key'), 'fifths', fifths);
            const time = kid(el, 'time');
            if (time) {
              beats = num(time, 'beats', beats);
              beatType = num(time, 'beat-type', beatType);
            }
            for (const clef of kids(el, 'clef')) {
              const sign = text(clef, 'sign');
              const staff = Number(clef.getAttribute('number') ?? 1);
              if (sign === 'F') clefs.set(staff, 'bass');
              else if (sign === 'G') clefs.set(staff, num(clef, 'clef-octave-change', 0) === -1 ? 'treble8' : 'treble');
            }
            const tr = kid(el, 'transpose');
            if (tr) transpose = num(tr, 'chromatic', 0) + 12 * num(tr, 'octave-change', 0);
            break;
          }
          case 'backup':
            cursor -= num(el, 'duration', 0) / divisions;
            break;
          case 'forward':
            cursor += num(el, 'duration', 0) / divisions;
            longest = Math.max(longest, cursor);
            break;
          case 'direction':
          case 'sound': {
            if (pi > 0) break;
            const bpm = readTempo(el);
            if (bpm) tempos.push({ at: at + cursor, bpm });
            for (const dt of kids(el, 'direction-type')) {
              const label = text(dt, 'rehearsal') ?? text(dt, 'words');
              if (label && (kid(dt, 'rehearsal') || SECTION.test(label))) mark ??= label;
            }
            break;
          }
          case 'note': {
            if (kid(el, 'grace') || kid(el, 'cue')) break;
            const length = num(el, 'duration', 0) / divisions;
            const chord = !!kid(el, 'chord');
            const start = chord ? lastStart : cursor;
            if (!chord) {
              lastStart = cursor;
              cursor += length;
              longest = Math.max(longest, cursor);
            }
            const pitch = kid(el, 'pitch');
            if (!pitch) break;

            const si = 'CDEFGAB'.indexOf(text(pitch, 'step') ?? 'C');
            const alter = Math.round(num(pitch, 'alter', 0));
            const octave = num(pitch, 'octave', 4);
            const ties = kids(el, 'tie').map(t => t.getAttribute('type'));
            const key = `${num(el, 'staff', 1)}/${text(el, 'voice') ?? '1'}`;
            const notes = voices.get(key) ?? voices.set(key, []).get(key)!;
            const midi = (octave + 1) * 12 + SEMITONES[si] + alter + transpose;

            if (ties.includes('stop')) {
              const held = notes.findLast(n => n.tieStart && n.midi === midi && Math.abs(n.start + n.length - (at + start)) < 1e-6);
              if (held) {
                held.length += length;
                held.tieStart = ties.includes('start');
                break;
              }
            }
            const lyric = kids(el, 'lyric').find(l => (l.getAttribute('number') ?? '1') === '1') ?? kid(el, 'lyric');
            const syllabic = text(lyric, 'syllabic');
            notes.push({
              start: at + start,
              length,
              midi,
              step: octave * 7 + si,
              alter,
              bar: mi,
              lyric: lyric ? kids(lyric, 'text').map(t => t.textContent ?? '').join(' ') || undefined : undefined,
              joined: syllabic === 'begin' || syllabic === 'middle' || undefined,
              tieStart: ties.includes('start'),
            });
            break;
          }
        }
      }

      if (pi === 0) {
        bars.push({
          number: measure.getAttribute('number') ?? String(mi + 1),
          start: at,
          length: longest || (beats * 4) / beatType,
          beats,
          beatType,
          fifths,
          mark,
        });
      }
      at += bars[mi]?.length ?? longest;
    });

    parts.push(...splitVoices(names.get(xmlPart.getAttribute('id') ?? '') ?? 'Part', pi, voices, clefs));
  });

  borrowLyrics(parts);
  return {
    id,
    title: text(kid(root, 'work'), 'work-title') ?? text(root, 'movement-title') ?? 'Untitled',
    credit: credit(root),
    bars,
    tempos: tempos.length ? tempos : [{ at: 0, bpm: 90 }],
    parts: parts.filter(p => p.notes.length),
  };
}

function readTempo(el: Element) {
  const sound = el.tagName === 'sound' ? el : kid(el, 'sound');
  const tempo = Number(sound?.getAttribute('tempo'));
  if (tempo > 0) return tempo;
  const metronome = kid(kid(el, 'direction-type'), 'metronome');
  const unit = BEAT_UNIT[text(metronome, 'beat-unit') ?? ''];
  const perMinute = num(metronome, 'per-minute', 0);
  if (!unit || !perMinute) return undefined;
  return perMinute * unit * (kid(metronome, 'beat-unit-dot') ? 1.5 : 1);
}

function credit(root: Element) {
  const creators = Array.from(root.getElementsByTagName('creator'));
  const by = (type: string) => creators.find(c => c.getAttribute('type') === type)?.textContent?.trim();
  const arranger = by('arranger');
  return [by('composer'), arranger && `arr. ${arranger}`].filter(Boolean).join(', ') || undefined;
}

// Choir scores put two singers on one staff, either as two voices or as chords
// in one voice. The upper voice takes the top note of a chord, the others the bottom.
function splitVoices(name: string, pi: number, voices: Map<string, Draft[]>, clefs: Map<number, Clef>): Part[] {
  const lines: { notes: Draft[]; pick: 'top' | 'bottom'; staff: number }[] = [];
  const keys = [...voices.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  for (const key of keys) {
    const notes = voices.get(key)!;
    const staff = Number(key.split('/')[0]);
    const onStaff = keys.filter(k => k.startsWith(`${staff}/`));
    // a stray divisi chord is not worth a second line; take the top note
    const chords = notes.filter((n, i) => i > 0 && n.start === notes[i - 1].start).length > notes.length * 0.15;
    if (onStaff.length === 1 && chords) {
      lines.push({ notes, pick: 'top', staff }, { notes, pick: 'bottom', staff });
    } else {
      lines.push({ notes, pick: onStaff[0] === key ? 'top' : 'bottom', staff });
    }
  }

  const labels = nameLines(name, lines.length);
  return lines.map((line, i) => ({
    id: `${pi}.${i}`,
    name: labels[i],
    clef: clefs.get(line.staff) ?? 'treble',
    notes: pickLine(line.notes, line.pick),
  }));
}

function pickLine(notes: Draft[], pick: 'top' | 'bottom'): Note[] {
  const byStart = new Map<number, Draft>();
  for (const n of notes) {
    const other = byStart.get(n.start);
    if (!other || (pick === 'top' ? n.midi > other.midi : n.midi < other.midi)) byStart.set(n.start, n);
  }
  return [...byStart.values()]
    .sort((a, b) => a.start - b.start)
    .map(({ tieStart, ...note }) => note);
}

function nameLines(name: string, count: number) {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (count === 1) return [clean];
  for (const split of [/\s*(?:\n|\/|&|\+|,|\band\b)\s*/i, /\s+/]) {
    const words = name.split(split).map(w => w.trim()).filter(Boolean);
    if (words.length === count) return words;
  }
  return Array.from({ length: count }, (_, i) => `${clean} ${i + 1}`);
}

// Notation software usually attaches lyrics to one voice only. Lend them to
// the other singers on the same rhythm, first from their own staff.
function borrowLyrics(parts: Part[]) {
  const lyricsAt = (pool: Part[]) => {
    const map = new Map<number, Note>();
    for (const n of pool.flatMap(p => p.notes)) if (n.lyric && !map.has(n.start)) map.set(n.start, n);
    return map;
  };
  const everywhere = lyricsAt(parts);
  for (const part of parts) {
    const own = lyricsAt(parts.filter(p => p.id.split('.')[0] === part.id.split('.')[0]));
    const pool = part.notes.some(n => n.lyric) ? own : new Map([...everywhere, ...own]);
    for (const n of part.notes) {
      const donor = n.lyric ? undefined : pool.get(n.start);
      if (donor) Object.assign(n, { lyric: donor.lyric, joined: donor.joined });
    }
  }
}
