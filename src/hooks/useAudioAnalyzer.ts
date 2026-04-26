// useAudioAnalyzer — Web Audio API frequency analysis (bass energy extraction)
// NOTE: Cannot connect to YouTube iframe audio due to cross-origin restrictions.
// Instead, we approximate bass energy from keystroke intensity & lyric density.

import { useRef, useCallback } from 'react';

export function useAudioAnalyzer() {
  const bassEnergy = useRef(0);
  const smoothedBass = useRef(0);

  // Since we can't access YouTube's audio stream directly,
  // we simulate bass energy from keystroke velocity and lyric transitions
  const pulseBass = useCallback((amount: number) => {
    bassEnergy.current = Math.min(1.0, bassEnergy.current + amount);
  }, []);

  const update = useCallback((): number => {
    // Exponential decay
    bassEnergy.current *= 0.92;
    // Smooth
    smoothedBass.current += (bassEnergy.current - smoothedBass.current) * 0.15;
    return smoothedBass.current;
  }, []);

  const getBassEnergy = useCallback((): number => {
    return smoothedBass.current;
  }, []);

  return { pulseBass, update, getBassEnergy };
}
