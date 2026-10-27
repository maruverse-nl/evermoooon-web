import { useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { renderGuide } from '../music/synth';
import type { Take } from '../music/take';
import { storeGuide } from './guideFile';

// The guide track doubles as the clock. performance.now() keeps it smooth between
// the player's coarse position updates; a big disagreement re-anchors it.
export function usePlayback(take: Take, own: number, others: number) {
  const player = useAudioPlayer(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const running = useRef(false);
  const anchor = useRef({ perf: 0, audio: 0 });
  const origin = take.start - take.countIn;

  useEffect(() => {
    let current = true;
    setReady(false);
    // let the "tuning up" state paint before the synth blocks the thread
    const timer = setTimeout(async () => {
      const uri = await storeGuide(renderGuide(take, own, others));
      if (!current) return;
      player.replace({ uri });
      setReady(true);
    }, 30);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [take, own, others, player]);

  const audioTime = () =>
    running.current ? anchor.current.audio + (performance.now() - anchor.current.perf) / 1000 : anchor.current.audio;

  const now = () => {
    if (running.current) {
      const reported = player.currentTime;
      if (Math.abs(reported - audioTime()) > 0.12) anchor.current = { perf: performance.now(), audio: reported };
    }
    return origin + audioTime();
  };

  const play = () => {
    anchor.current = { perf: performance.now(), audio: player.currentTime };
    player.play();
    running.current = true;
    setPlaying(true);
  };

  const pause = () => {
    player.pause();
    anchor.current = { perf: 0, audio: audioTime() };
    running.current = false;
    setPlaying(false);
  };

  const rewind = async () => {
    player.pause();
    await player.seekTo(0);
    anchor.current = { perf: 0, audio: 0 };
    running.current = false;
    setPlaying(false);
  };

  return { ready, playing, play, pause, rewind, now };
}
