"use client";

import { useEffect, useRef, useMemo } from 'react';
import type { LyricWord, LyricLine } from '@/lib/lrcParser';

interface LyricRiverProps {
  lines: LyricLine[];
  allWords: LyricWord[];
  currentTimeMs: number;
  keystrokeIntensity: number; // 0-1, from typing velocity
}

const MAX_FUTURE_WINDOW = 8000;
const MAX_PAST_WINDOW = 4000;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export default function LyricRiver({ lines, allWords, currentTimeMs, keystrokeIntensity }: LyricRiverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Map<number, HTMLSpanElement>>(new Map());

  // Sliding window of visible words
  const visibleWords = useMemo(() => {
    return allWords.filter(w => {
      const delta = w.startMs - currentTimeMs;
      return delta > -MAX_PAST_WINDOW && delta < MAX_FUTURE_WINDOW;
    });
  }, [allWords, currentTimeMs]);

  // Update word styles each frame (direct DOM manipulation — no React re-renders)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let raf: number;
    const update = () => {
      for (const word of visibleWords) {
        const el = wordRefs.current.get(word.startMs);
        if (!el) continue;

        const delta = word.startMs - currentTimeMs;
        const isActive = currentTimeMs >= word.startMs && currentTimeMs < word.endMs;

        let translateZ = 0;
        let scale = 1;
        let opacity = 0;
        let fontWeight = 400;
        let blur = 0;
        let x = 0;

        if (isActive) {
          // ACTIVE WORD
          const wordProgress = (currentTimeMs - word.startMs) / (word.endMs - word.startMs);
          scale = 1.0 + keystrokeIntensity * 0.08;
          // Weight breathes: 400 → 900 → 400
          const sinWeight = Math.sin(wordProgress * Math.PI);
          fontWeight = Math.min(900, Math.round(400 + sinWeight * 500 + keystrokeIntensity * 150));
          opacity = 1.0;
          translateZ = 0;
          blur = 0;
        } else if (delta > 0 && delta < MAX_FUTURE_WINDOW) {
          // FUTURE WORD
          const progress = delta / MAX_FUTURE_WINDOW;
          translateZ = -1200 * progress;
          scale = lerp(1.0, 0.15, progress);
          opacity = lerp(0.45, 0, smoothstep(0.5, 1.0, progress));
          fontWeight = Math.round(lerp(600, 400, progress));
          blur = lerp(0, 6, progress);
        } else if (delta < 0 && delta > -MAX_PAST_WINDOW) {
          // PAST WORD
          const pastProgress = Math.abs(delta) / MAX_PAST_WINDOW;
          translateZ = pastProgress * 300;
          scale = lerp(1.0, 0.3, pastProgress);
          opacity = lerp(0.35, 0, pastProgress);
          fontWeight = 300;
          blur = lerp(0, 3, pastProgress);
        }

        // Position words in their lines
        const lineY = word.lineIndex * 80; // Line spacing in the river
        const currentLineIndex = allWords.findIndex(w => currentTimeMs >= w.startMs && currentTimeMs < w.endMs);
        const currentLineIdx = currentLineIndex >= 0 ? allWords[currentLineIndex].lineIndex : -1;
        const lineDelta = word.lineIndex - currentLineIdx;
        const yOffset = lineDelta * 80;

        el.style.transform = `translate3d(0px, ${yOffset}px, ${translateZ}px) scale(${scale})`;
        el.style.opacity = `${opacity}`;
        el.style.fontWeight = `${fontWeight}`;
        el.style.filter = blur > 0.1 ? `blur(${blur}px)` : 'none';
        el.style.fontSize = isActive ? 'clamp(48px, 7vw, 100px)' : 'clamp(24px, 3.5vw, 48px)';
        el.style.color = isActive ? 'var(--word-active)' : delta > 0 ? 'var(--word-near)' : 'var(--word-far)';
      }

      raf = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(raf);
  }, [visibleWords, currentTimeMs, keystrokeIntensity, allWords]);

  return (
    <div ref={containerRef} className="lyric-river">
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: '800px', perspectiveOrigin: '50% 45%' }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 max-w-[80vw]" style={{ transformStyle: 'preserve-3d' }}>
          {visibleWords.map((word) => (
            <span
              key={`${word.lineIndex}-${word.wordIndex}-${word.startMs}`}
              ref={(el) => {
                if (el) wordRefs.current.set(word.startMs, el);
              }}
              className="lyric-word"
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 400,
                willChange: 'transform, opacity, font-weight, font-size, filter',
              }}
            >
              {word.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
