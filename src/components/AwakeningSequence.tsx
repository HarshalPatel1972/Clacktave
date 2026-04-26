"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface AwakeningSequenceProps {
  onComplete: () => void;
}

export default function AwakeningSequence({ onComplete }: AwakeningSequenceProps) {
  const letters = "CLACKTAVE".split("");
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    // Total sequence duration is ~6 seconds
    const t1 = setTimeout(() => setShowFlash(true), 5200);
    const t2 = setTimeout(onComplete, 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden">
      {/* Cinematic Letters */}
      <div className="flex gap-4 md:gap-8">
        {letters.map((char, i) => (
          <motion.span
            key={i}
            initial={{ y: -800, scaleY: 4, opacity: 0, filter: 'blur(20px)' }}
            animate={{ 
              y: 0, 
              scaleY: 1, 
              opacity: 1, 
              filter: 'blur(0px)',
            }}
            transition={{ 
              delay: i * 0.4, 
              duration: 0.6, 
              type: 'spring', 
              damping: 15,
              stiffness: 100 
            }}
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(60px, 12vw, 180px)',
              color: 'white',
              textShadow: '0 0 40px rgba(0, 229, 255, 0.4)',
            }}
          >
            {char}
          </motion.span>
        ))}
      </div>

      {/* Rhythmic Grid Shockwaves (Simulated) */}
      <div className="absolute inset-0 pointer-events-none">
        {letters.map((_, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 border-[2px] border-[var(--high-cold)] rounded-full opacity-0"
            style={{ left: '50%', top: '50%', x: '-50%', y: '-50%' }}
            animate={{ 
              scale: [1, 10], 
              opacity: [0, 0.3, 0] 
            }}
            transition={{ 
              delay: i * 0.4 + 0.6, 
              duration: 1.5, 
              ease: "easeOut" 
            }}
          />
        ))}
      </div>

      {/* Final Ignition Flash */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[1100]"
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ delay: 4.5, duration: 1 }}
        className="absolute bottom-20 uppercase tracking-[1em] text-white/50 text-[10px]"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        initializing_terminal_protocol
      </motion.p>
    </div>
  );
}
