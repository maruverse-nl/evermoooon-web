const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const noteName = (midi: number) => NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
export const toMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const toHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// Signed distance in cents. With anyOctave, singing an octave off counts as on pitch.
export function cents(sung: number, target: number, anyOctave = false) {
  const d = (sung - target) * 100;
  return anyOctave ? ((((d + 600) % 1200) + 1200) % 1200) - 600 : d;
}
