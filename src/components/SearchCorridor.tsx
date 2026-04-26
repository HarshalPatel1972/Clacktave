"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnail?: string;
}

interface SearchCorridorProps {
  onSelect: (result: SearchResult) => void;
  onCancel: () => void;
}

export default function SearchCorridor({ onSelect, onCancel }: SearchCorridorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.results) {
          setResults(data.results.slice(0, 5));
          setSelectedIndex(0);
        } else if (data.videoId) {
          setResults([{ videoId: data.videoId, title: data.title, thumbnail: data.thumbnail }]);
          setSelectedIndex(0);
        }
      } catch { /* silent */ }
      setIsSearching(false);
    }, 400);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onCancel(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && results.length > 0) { e.preventDefault(); onSelect(results[selectedIndex]); return; }
  };

  return (
    <div className="fixed inset-0 z-[900] flex flex-col items-center justify-center bg-black">
      {/* Floating letters — the query rendered as large glyphs */}
      <div className="flex items-center justify-center min-h-[120px] mb-8">
        <AnimatePresence mode="popLayout">
          {query.split('').map((char, i) => (
            <motion.span
              key={`${i}-${char}`}
              initial={{ y: 40, rotateX: -90, scale: 0.5, opacity: 0 }}
              animate={{ y: 0, rotateX: 0, scale: 1, opacity: char === ' ' ? 0 : 1 }}
              exit={{ y: -200, rotateZ: Math.random() * 60 - 30, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
              className="inline-block"
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: 'clamp(48px, 8vw, 96px)',
                color: 'white',
                textTransform: 'uppercase',
                width: char === ' ' ? '0.5em' : undefined,
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* Hidden input captures actual typing */}
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="sr-only"
        aria-label="Search for a song"
      />

      {/* Autocomplete Ring — results as pills in a semicircle */}
      <div className="flex flex-wrap items-center justify-center gap-3 max-w-2xl px-8">
        <AnimatePresence>
          {results.map((r, i) => (
            <motion.button
              key={r.videoId}
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{
                scale: i === selectedIndex ? 1.05 : 0.95,
                opacity: 1,
                y: 0,
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
              onClick={() => onSelect(r)}
              className={`search-pill ${i === selectedIndex ? 'active' : ''}`}
            >
              <span className="dot" />
              <span className="truncate max-w-[280px]">{r.title}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Hint text */}
      {query.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          className="mt-12 uppercase"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.4em',
            color: 'white',
          }}
        >
          start typing to search
        </motion.p>
      )}

      {/* Searching indicator */}
      {isSearching && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '120px' }}
          className="mt-8 h-[1px] bg-[var(--high-cold)]"
          transition={{ duration: 0.4 }}
        />
      )}
    </div>
  );
}
