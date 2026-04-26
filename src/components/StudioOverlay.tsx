"use client";

import { motion } from 'framer-motion';
import CityEqualizer from './CityEqualizer';

interface StudioOverlayProps {
  isOpen: boolean;
  title: string;
  artist: string;
  velocity: number;
  bassEnergy: number;
  kps: number;
}

export default function StudioOverlay({ isOpen, title, artist, velocity, bassEnergy, kps }: StudioOverlayProps) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: isOpen ? 0 : '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 h-full w-[320px] z-[800] studio-glass border-l border-white/10 flex flex-col p-8 overflow-hidden"
    >
      {/* City Skyline Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
            SPECTRAL_CITY_V1
          </span>
          <span className="w-2 h-2 rounded-full bg-[var(--high-cold)] animate-pulse" />
        </div>
        <CityEqualizer bassEnergy={bassEnergy} velocity={velocity} />
      </div>

      {/* Track Info */}
      <div className="mb-10">
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', color: 'white', lineHeight: '1', marginBottom: '4px' }}>
          {title}
        </h2>
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
          {artist}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="p-4 bg-white/5 border border-white/5 rounded-lg">
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
            VELOCITY_INDEX
          </p>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', color: 'white' }}>
            {velocity.toFixed(1)}
          </p>
        </div>
        <div className="p-4 bg-white/5 border border-white/5 rounded-lg">
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
            KEYSTROKES_SEC
          </p>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', color: 'var(--high-cold)' }}>
            {kps}
          </p>
        </div>
      </div>

      {/* Lyric Progress Placeholder */}
      <div className="flex-1 overflow-hidden">
         <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', marginBottom: '16px' }}>
            SIGNAL_FEED
         </p>
         <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-white/5 rounded w-full opacity-50 overflow-hidden relative">
                <motion.div 
                  className="absolute inset-0 bg-white/10"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                />
              </div>
            ))}
         </div>
      </div>

      {/* Branding Footer */}
      <div className="mt-auto pt-8 border-t border-white/5 opacity-30">
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', color: 'white', letterSpacing: '0.5em' }}>
          CLACKTAVE STUDIO
        </p>
      </div>
    </motion.div>
  );
}
