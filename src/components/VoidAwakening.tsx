"use client";

import { motion, AnimatePresence } from 'framer-motion';

interface VoidAwakeningProps {
  onAwaken: () => void;
}

export default function VoidAwakening({ onAwaken }: VoidAwakeningProps) {
  return (
    <div
      className="center-full bg-black cursor-none"
      onKeyDown={(e) => { onAwaken(); }}
      onClick={onAwaken}
      tabIndex={0}
      autoFocus
    >
      {/* The Breathing Circle */}
      <div className="flex-center gap-6">
        <motion.div
          className="breathing-circle"
          animate={{ scale: [1.0, 1.4, 1.0] }}
          transition={{
            duration: 2.8,
            ease: [0.45, 0, 0.55, 1],
            repeat: Infinity,
          }}
          exit={{
            scale: 0,
            opacity: 0,
            transition: { duration: 0.18, ease: [0.68, -0.55, 0.265, 1.55] },
          }}
        />

        {/* Brand */}
        <p
          className="uppercase text-white/20"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '11px',
            letterSpacing: '0.35em',
          }}
        >
          clacktave
        </p>
      </div>

      {/* Expanding ring (on exit) */}
      <AnimatePresence>
        {/* Ring is triggered by parent unmounting this component */}
      </AnimatePresence>
    </div>
  );
}
