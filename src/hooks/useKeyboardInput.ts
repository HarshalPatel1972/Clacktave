// useKeyboardInput — Key listener with repeat suppression + event dispatch
import { useEffect, useRef, useCallback } from 'react';

export interface KeyEvent {
  key: string;
  code: string;
  charCode: number;
  timestamp: number;
}

type KeyCallback = (event: KeyEvent) => void;
type SimpleCallback = () => void;

export function useKeyboardInput(
  onKeyDown: KeyCallback,
  onKeyUp: SimpleCallback,
  enabled: boolean = true
) {
  const activeKeys = useRef(new Set<string>());
  const lastKeyTime = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Suppress repeats
      if (e.repeat) return;
      if (activeKeys.current.has(e.code)) return;

      activeKeys.current.add(e.code);
      lastKeyTime.current = Date.now();

      onKeyDown({
        key: e.key,
        code: e.code,
        charCode: e.key.toUpperCase().charCodeAt(0),
        timestamp: Date.now(),
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.current.delete(e.code);
      if (activeKeys.current.size === 0) {
        onKeyUp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, onKeyDown, onKeyUp]);

  const getActiveKeyCount = useCallback(() => activeKeys.current.size, []);
  const getTimeSinceLastKey = useCallback(() => Date.now() - lastKeyTime.current, []);

  return { getActiveKeyCount, getTimeSinceLastKey };
}
