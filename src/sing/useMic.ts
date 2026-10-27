import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import { useMemo, useRef } from 'react';
import { listener, type Heard } from '../music/detect';

export function useMic(heard: Heard) {
  const latest = useRef(heard);
  latest.current = heard;
  const feed = useMemo(() => listener((midi, age) => latest.current(midi, age)), []);

  const { stream, isStreaming } = useAudioStream({
    onBuffer: ({ data, channels, sampleRate }) => {
      const samples = new Float32Array(data);
      feed(channels > 1 ? samples.filter((_, i) => i % channels === 0) : samples, sampleRate);
    },
  });

  const start = async () => {
    if (isStreaming) return;
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new Error('The coach needs the microphone to hear you. Allow it in Settings.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
    await stream.start();
  };

  return { start, stop: () => stream.stop(), listening: isStreaming };
}
