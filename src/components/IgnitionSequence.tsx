"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IgnitionProps {
  title: string;
  artist: string;
  thumbnail?: string;
  loaded: boolean;
  progress: number; // 0-100
  onReady: () => void;
}

export default function IgnitionSequence({ title, artist, thumbnail, loaded, progress, onReady }: IgnitionProps) {
  const [phase, setPhase] = useState<'helix' | 'assembly' | 'waiting'>('helix');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('assembly'), 1200);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (loaded && phase === 'assembly') {
      const t = setTimeout(() => setPhase('waiting'), 600);
      return () => clearTimeout(t);
    }
  }, [loaded, phase]);

  // When in waiting state, capture any keypress
  useEffect(() => {
    if (phase !== 'waiting') return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      onReady();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, onReady]);

  return (
    <div className="fixed inset-0 z-[900] flex flex-col items-center justify-center bg-black overflow-hidden">
      {/* Phase A: Waveform / Helix */}
      <AnimatePresence>
        {phase === 'helix' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.4 } }}
          >
            <svg width="100%" height="120" className="max-w-2xl">
              {[...Array(60)].map((_, i) => {
                const x = (i / 60) * 100;
                const y1 = 60 + Math.sin(i * 0.3) * 30;
                const y2 = 60 - Math.sin(i * 0.3) * 30;
                return (
                  <g key={i}>
                    <motion.circle
                      cx={`${x}%`} cy={y1} r="1.5"
                      fill="var(--bass-pulse)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.8, 0.4] }}
                      transition={{ delay: i * 0.02, duration: 0.6 }}
                    />
                    <motion.circle
                      cx={`${x}%`} cy={y2} r="1.5"
                      fill="var(--high-cold)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.8, 0.4] }}
                      transition={{ delay: i * 0.02 + 0.1, duration: 0.6 }}
                    />
                  </g>
                );
              })}
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase B+C: Album Art + Title Assembly */}
      <AnimatePresence>
        {(phase === 'assembly' || phase === 'waiting') && (
          <motion.div
            className="flex flex-col items-center gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            {/* Album Art Circle */}
            {thumbnail && (
              <motion.img
                src={thumbnail}
                alt=""
                className="w-20 h-20 rounded-full object-cover"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              />
            )}

            {/* Title — letters land like sparks */}
            <div className="flex items-center justify-center flex-wrap">
              {title.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ y: -60, scaleY: 2.5, opacity: 0 }}
                  animate={{ y: 0, scaleY: 1, opacity: char === ' ' ? 0 : 1 }}
                  transition={{
                    delay: 0.3 + i * 0.04,
                    duration: 0.35,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 700,
                    fontSize: 'clamp(24px, 4vw, 48px)',
                    color: 'white',
                    display: 'inline-block',
                    width: char === ' ' ? '0.4em' : undefined,
                  }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>
              ))}
            </div>

            {/* Artist */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 1.0 }}
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: '14px',
                color: 'white',
              }}
            >
              {artist}
            </motion.p>

            {/* Progress bar */}
            {!loaded && (
              <div className="w-48 h-[2px] bg-white/5 overflow-hidden mt-4">
                <motion.div
                  className="h-full"
                  style={{ background: 'var(--high-cold)' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}

            {/* Type to begin */}
            {phase === 'waiting' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.35)',
                  marginTop: '24px',
                }}
              >
                type to begin
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
