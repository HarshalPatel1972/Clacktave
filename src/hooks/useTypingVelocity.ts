// useTypingVelocity — 500ms sliding window KPS calculator
import { useRef, useCallback } from 'react';

export function useTypingVelocity() {
  const timestamps = useRef<number[]>([]);

  const recordKeystroke = useCallback(() => {
    const now = Date.now();
    timestamps.current.push(now);
    // Keep only last 2 seconds for memory
    timestamps.current = timestamps.current.filter(t => now - t < 2000);
  }, []);

  const getVelocity = useCallback((): number => {
    const now = Date.now();
    const recent = timestamps.current.filter(t => now - t < 500);
    return Math.min(10, recent.length * 2); // 0–10 scale
  }, []);

  const getKeystrokeCount = useCallback((): number => {
    return timestamps.current.length;
  }, []);

  return { recordKeystroke, getVelocity, getKeystrokeCount };
}
