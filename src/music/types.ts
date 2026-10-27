export type Clef = 'treble' | 'treble8' | 'bass';

export type Note = {
  start: number; // quarter notes from the top of the song
  length: number;
  midi: number; // sounding pitch
  step: number; // written diatonic position, C4 = 28
  alter: number;
  bar: number; // index into Song.bars
  lyric?: string;
  joined?: boolean; // syllable continues in the next note's lyric
};

export type Part = {
  id: string;
  name: string;
  clef: Clef;
  notes: Note[];
};

export type Bar = {
  number: string;
  start: number;
  length: number;
  beats: number;
  beatType: number;
  fifths: number;
  mark?: string;
};

export type Tempo = { at: number; bpm: number };

export type Song = {
  id: string;
  title: string;
  credit?: string;
  bars: Bar[];
  tempos: Tempo[];
  parts: Part[];
};
