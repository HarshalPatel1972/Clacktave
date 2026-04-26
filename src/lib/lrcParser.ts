// LRC Parser — Converts LRC timestamps into word-level LyricWord objects

export interface LyricWord {
  text: string;
  startMs: number;
  endMs: number;
  lineIndex: number;
  wordIndex: number;
}

export interface LyricLine {
  startMs: number;
  endMs: number;
  text: string;
  words: LyricWord[];
}

/**
 * Parse raw API response (from our lyrics route) into structured LyricLine/LyricWord arrays.
 * Handles both word-level timing (YouTube JSON3) and line-level timing (LRCLib).
 */
export function parseApiLyrics(
  captions: Array<{
    start: number;
    dur: number;
    text: string;
    words?: Array<{ text: string; offset: number }>;
  }>
): { lines: LyricLine[]; allWords: LyricWord[] } {
  const lines: LyricLine[] = [];
  const allWords: LyricWord[] = [];

  captions.forEach((cap, lineIndex) => {
    const lineStartMs = cap.start * 1000;
    const lineDurMs = cap.dur * 1000;
    const lineEndMs = lineStartMs + lineDurMs;

    let lineWords: LyricWord[];

    if (cap.words && cap.words.length > 1) {
      // Word-level timing available (YouTube JSON3)
      lineWords = cap.words
        .filter(w => w.text.trim().length > 0)
        .map((w, wordIndex, arr) => {
          const wordStartMs = lineStartMs + w.offset * 1000;
          const nextWordStart = wordIndex < arr.length - 1
            ? lineStartMs + arr[wordIndex + 1].offset * 1000
            : lineEndMs;

          return {
            text: w.text.trim(),
            startMs: wordStartMs,
            endMs: nextWordStart,
            lineIndex,
            wordIndex,
          };
        });
    } else {
      // Line-level only — distribute across words proportionally
      const words = cap.text.split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) return;

      // Longer words get proportionally more time
      const totalChars = words.reduce((sum, w) => sum + w.length, 0);
      let cursor = lineStartMs;

      lineWords = words.map((w, wordIndex) => {
        const wordDur = (w.length / totalChars) * lineDurMs;
        const word: LyricWord = {
          text: w,
          startMs: cursor,
          endMs: cursor + wordDur,
          lineIndex,
          wordIndex,
        };
        cursor += wordDur;
        return word;
      });
    }

    lines.push({
      startMs: lineStartMs,
      endMs: lineEndMs,
      text: cap.text,
      words: lineWords,
    });

    allWords.push(...lineWords);
  });

  return { lines, allWords };
}
