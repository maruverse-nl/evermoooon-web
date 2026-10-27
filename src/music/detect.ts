import { PitchDetector } from 'pitchy';
import { toMidi } from './pitch';

const WINDOW = 2048;
const HOP = 1024;

export type Heard = (midi: number | null, age: number) => void;

// Feeds raw mic samples through pitchy in overlapping windows. `age` is how many
// seconds ago the end of the analysed window was recorded, relative to the newest sample.
export function listener(heard: Heard) {
  const detector = PitchDetector.forFloat32Array(WINDOW);
  detector.minVolumeDecibels = -42;
  let carry = new Float32Array(0);

  return (samples: Float32Array, rate: number) => {
    const all = new Float32Array(carry.length + samples.length);
    all.set(carry);
    all.set(samples, carry.length);

    let pos = 0;
    for (; pos + WINDOW <= all.length; pos += HOP) {
      const [hz, clarity] = detector.findPitch(all.subarray(pos, pos + WINDOW), rate);
      const sung = clarity > 0.88 && hz > 65 && hz < 1400;
      heard(sung ? toMidi(hz) : null, (all.length - pos - WINDOW) / rate);
    }
    carry = all.slice(pos);
  };
}
