// useLyricSync — Current word calculator from playback time
import { useRef, useCallback } from 'react';
import type { LyricWord, LyricLine } from '@/lib/lrcParser';

export interface LyricSyncState {
  currentWord: LyricWord | null;
  currentLine: LyricLine | null;
  currentLineIndex: number;
  currentWordIndex: number;
  previousWord: LyricWord | null;
  wordChanged: boolean;
}

export function useLyricSync() {
  const prevWordRef = useRef<LyricWord | null>(null);

  const sync = useCallback((
    timeMs: number,
    lines: LyricLine[],
    allWords: LyricWord[]
  ): LyricSyncState => {
    // Find current line
    let currentLine: LyricLine | null = null;
    let currentLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (timeMs >= lines[i].startMs && timeMs < lines[i].endMs) {
        currentLine = lines[i];
        currentLineIndex = i;
        break;
      }
    }

    // Find current word
    let currentWord: LyricWord | null = null;
    let currentWordIndex = -1;
    for (let i = 0; i < allWords.length; i++) {
      if (timeMs >= allWords[i].startMs && timeMs < allWords[i].endMs) {
        currentWord = allWords[i];
        currentWordIndex = i;
        break;
      }
    }

    const wordChanged = currentWord !== null &&
      (prevWordRef.current === null || prevWordRef.current.startMs !== currentWord.startMs);

    const previousWord = prevWordRef.current;
    if (currentWord) prevWordRef.current = currentWord;

    return {
      currentWord,
      currentLine,
      currentLineIndex,
      currentWordIndex,
      previousWord: wordChanged ? previousWord : null,
      wordChanged,
    };
  }, []);

  return { sync };
}
