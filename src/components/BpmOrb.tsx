"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

interface BpmOrbProps {
  bpm?: number;
  lastKeystroke?: number;
  intensity?: number;
}

export default function BpmOrb({ bpm = 120, lastKeystroke, intensity = 0 }: BpmOrbProps) {
  const [pulse, setPulse] = useState(0);
  const [isSynced, setIsSynced] = useState(false);
  const beatInterval = (60 / bpm) * 1000;
  const lastBeatTime = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => p + 1);
      lastBeatTime.current = Date.now();
    }, beatInterval);
    return () => clearInterval(interval);
  }, [beatInterval]);

  // Rhythm Check: Was the last keystroke within 100ms of a beat?
  useEffect(() => {
    if (!lastKeystroke) return;
    const offset = Math.abs(lastKeystroke - lastBeatTime.current);
    const halfBeat = beatInterval / 2;
    const actualOffset = offset > halfBeat ? Math.abs(offset - beatInterval) : offset;

    if (actualOffset < 120) {
      setIsSynced(true);
      const timer = setTimeout(() => setIsSynced(false), 200);
      return () => clearTimeout(timer);
    }
  }, [lastKeystroke, beatInterval]);

  return (
    <div className="fixed top-8 left-8 z-[500] pointer-events-none flex items-center gap-4">
      <div className="relative flex items-center justify-center">
        {/* The Core Orb */}
        <motion.div
          className="w-4 h-4 rounded-full bg-white/20 border border-white/40"
          animate={{
            scale: [1, 1.3, 1],
            borderColor: isSynced ? 'rgba(0, 229, 255, 1)' : 'rgba(255, 255, 255, 0.4)',
            backgroundColor: isSynced ? 'rgba(0, 229, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)',
          }}
          transition={{
            duration: beatInterval / 1000,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />

        {/* Rhythm Ring Eruption */}
        <AnimatePresence>
          {isSynced && (
            <motion.div
              key={pulse}
              className="absolute w-4 h-4 rounded-full border border-[var(--high-cold)]"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* Ambient Glow */}
        <motion.div
          className="absolute inset-0 blur-md rounded-full"
          style={{ background: isSynced ? 'var(--high-cold)' : 'white' }}
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: beatInterval / 500, repeat: Infinity }}
        />
      </div>

      {/* Label */}
      <div className="flex flex-col">
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
          RHYTHM_SYNC
        </span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', color: isSynced ? 'var(--high-cold)' : 'white', opacity: 0.8 }}>
          {bpm} BPM
        </span>
      </div>
    </div>
  );
}
