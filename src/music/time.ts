import type { Song } from './types';

// Quarter notes to seconds, following every tempo change.
export function clock(song: Song) {
  const tempos = [...song.tempos].sort((a, b) => a.at - b.at);
  if (tempos[0].at > 0) tempos.unshift({ at: 0, bpm: tempos[0].bpm });
  const marks: number[] = [0];
  for (let i = 1; i < tempos.length; i++) {
    marks.push(marks[i - 1] + ((tempos[i].at - tempos[i - 1].at) * 60) / tempos[i - 1].bpm);
  }
  return (q: number) => {
    let i = tempos.length - 1;
    while (i > 0 && tempos[i].at > q) i--;
    return marks[i] + ((q - tempos[i].at) * 60) / tempos[i].bpm;
  };
}
