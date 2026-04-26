"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { ParticlePool } from '@/lib/particlePool';
import { createGridState, updateGrid, drawGrid, emitShockwave, type GridState } from '@/lib/gridPhysics';
import { parseApiLyrics, type LyricLine, type LyricWord } from '@/lib/lrcParser';
import { ChordSynth } from '@/lib/chordSynth';
import { useTypingVelocity } from '@/hooks/useTypingVelocity';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';
import { useLyricSync } from '@/hooks/useLyricSync';
import LyricRiver from './LyricRiver';
import KeystrokeConstel from './KeystrokeConstel';
import BpmOrb from './BpmOrb';
import StudioOverlay from './StudioOverlay';
import { motion, AnimatePresence } from 'framer-motion';

interface StageProps {
  videoId: string;
  title: string;
  lyrics: any[];
  onExit?: () => void;
}

export default function Stage({ videoId, title, lyrics: rawLyrics, onExit }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastTime = useRef(0);
  const gridState = useRef<GridState | null>(null);
  const particlePool = useRef<ParticlePool | null>(null);
  const chordSynth = useRef<ChordSynth | null>(null);
  const lastKeyTime = useRef(0);
  const keystrokeBoost = useRef(0);
  const [lastKeyEvent, setLastKeyEvent] = useState<{ code: string; timestamp: number } | null>(null);

  const [isSilent, setIsSilent] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [showLyrics, setShowLyrics] = useState(true);
  const [volume, setVolume] = useState(70);

  const { recordKeystroke, getVelocity, getKeystrokeCount } = useTypingVelocity();
  const yt = useYouTubePlayer();
  const { pulseBass, update: updateBass, getBassEnergy } = useAudioAnalyzer();
  const { sync } = useLyricSync();

  // Parse lyrics
  const { lines, allWords } = parseApiLyrics(rawLyrics);

  // Initialize systems
  useEffect(() => {
    particlePool.current = new ParticlePool();
    chordSynth.current = new ChordSynth();

    return () => {
      chordSynth.current?.destroy();
    };
  }, []);

  // Cue the video
  useEffect(() => {
    if (yt.ready && videoId) {
      yt.cueVideo(videoId);
      // Initializing Grid Flash
      pulseBass(0.8);
      if (gridState.current) emitShockwave(gridState.current);
    }
  }, [yt.ready, videoId, pulseBass]);

  // Dynamic Tab Title
  useEffect(() => {
    if (!title) return;
    const syncState = sync(currentTimeMs, lines, allWords);
    const word = syncState.currentWord?.text || "...";
    document.title = isSilent ? `[PAUSED] ${title}` : `[${word}] - ${title}`;
    return () => { document.title = "Clacktave"; };
  }, [currentTimeMs, title, isSilent, sync, lines, allWords]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gridState.current = createGridState(canvas.width, canvas.height);
      particlePool.current?.initAmbient(canvas.width, canvas.height, 600);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Silence detection
  useEffect(() => {
    const check = setInterval(() => {
      const timeSinceKey = Date.now() - lastKeyTime.current;
      if (timeSinceKey > 1200 && !isSilent && lastKeyTime.current > 0) {
        setIsSilent(true);
        yt.pause();
      }
    }, 200);
    return () => clearInterval(check);
  }, [isSilent, yt]);

  // Key handling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === 'Tab') { 
      e.preventDefault(); 
      setIsHudOpen(prev => !prev);
      return; 
    }
    if (e.key === 'Escape') { 
      if (isHudOpen) { setIsHudOpen(false); return; }
      e.preventDefault(); 
      onExit?.(); 
      return; 
    }

    e.preventDefault();
    lastKeyTime.current = Date.now();
    setLastKeyEvent({ code: e.code, timestamp: Date.now() });
    recordKeystroke();

    // Resume from silence
    if (isSilent) {
      setIsSilent(false);
      yt.play();
      // Burst of sparks on resume
      const canvas = canvasRef.current;
      if (canvas && particlePool.current && gridState.current) {
        particlePool.current.emitSparks(gridState.current.vanishingX, gridState.current.vanishingY, 40, 500);
        emitShockwave(gridState.current);
      }
    } else {
      // Normal playback
      yt.play();
    }

    // Velocity-based playback rate
    const vel = getVelocity();
    const targetRate = 0.6 + (vel / 10) * 0.8;
    yt.setPlaybackRate(Math.round(targetRate * 10) / 10);
    
    // Master volume + Velocity modulation
    const modVolume = Math.min(100, volume + (vel * 3));
    yt.setVolume(modVolume);

    // Chord synthesis
    chordSynth.current?.playNote();

    // Visual effects
    pulseBass(0.3 + vel * 0.07);
    keystrokeBoost.current = Math.min(1.0, keystrokeBoost.current + 0.2);

    if (gridState.current) {
      gridState.current.intensity = Math.min(1, gridState.current.intensity + 0.2);
      emitShockwave(gridState.current);
    }

    // Sparks
    if (particlePool.current && gridState.current) {
      const count = vel > 6 ? 60 : (15 + vel * 2);
      const hue = vel > 6 ? 0 : 190; // Red super-sparks on fast typing
      particlePool.current.emitSparks(
        gridState.current.vanishingX,
        gridState.current.vanishingY,
        count,
        200 + vel * 30,
        hue
      );
    }
  }, [isSilent, yt, recordKeystroke, getVelocity, pulseBass, onExit]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    // Check if ALL keys released
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Mouse tracking & Volume Scroll
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (gridState.current) {
        gridState.current.mouseX = e.clientX;
        gridState.current.mouseY = e.clientY;
      }
    };
    const handleWheel = (e: WheelEvent) => {
      setVolume(v => Math.max(0, Math.min(100, v - (e.deltaY / 10))));
    };
    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Main render loop
  useEffect(() => {
    const animate = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) { requestRef.current = requestAnimationFrame(animate); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { requestRef.current = requestAnimationFrame(animate); return; }

      const dt = Math.min(0.05, (timestamp - (lastTime.current || timestamp)) / 1000);
      lastTime.current = timestamp;

      // Update current time from YouTube
      const ytTime = yt.getCurrentTime() * 1000;
      setCurrentTimeMs(ytTime);

      // End of song detection
      const duration = yt.getDuration() * 1000;
      if (duration > 0 && ytTime > duration - 2000 && !isFinished) {
        setIsFinished(true);
      }

      // Update systems
      updateBass();
      if (gridState.current) {
        gridState.current.bassEnergy = getBassEnergy();
        updateGrid(gridState.current, dt, canvas.width, canvas.height);
      }
      particlePool.current?.update(dt);
      keystrokeBoost.current *= 0.92;

      // Lyric sync — emit echo particles on word change
      const syncState = sync(ytTime, lines, allWords);
      if (syncState.wordChanged && syncState.previousWord && particlePool.current && gridState.current) {
        particlePool.current.emitEcho(
          canvas.width / 2,
          canvas.height * 0.45,
          syncState.previousWord.text
        );
      }

      // Clear
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      if (gridState.current) {
        drawGrid(ctx, gridState.current, canvas.width, canvas.height);
      }

      // Draw particles
      particlePool.current?.draw(ctx);

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [yt, updateBass, getBassEnergy, sync, lines, allWords]);

  return (
    <>
      {/* Canvas layer — grid + particles */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ background: '#000000', cursor: isSilent ? 'default' : 'none' }}
      />

      {/* Hidden YouTube player */}
      <div id={yt.containerRef} className="fixed" style={{ left: '-9999px', width: '1px', height: '1px' }} />

      {/* DOM Lyric River layer */}
      {showLyrics && lines.length > 0 && (
        <LyricRiver
          lines={lines}
          allWords={allWords}
          currentTimeMs={currentTimeMs}
          keystrokeIntensity={keystrokeBoost.current}
        />
      )}

      {/* Analytics & HUD Layer (Phase 2) */}
      <BpmOrb 
        lastKeystroke={lastKeyEvent?.timestamp} 
        intensity={keystrokeBoost.current} 
      />
      
      <KeystrokeConstel lastEvent={lastKeyEvent} />
      
      <StudioOverlay 
        isOpen={isHudOpen}
        title={title}
        artist="CLACKTAVE_PERFORMANCE"
        velocity={getVelocity()}
        kps={getVelocity()} // Using velocity as KPS for now
        bassEnergy={getBassEnergy()}
      />

      {/* Silence Vignette */}
      <AnimatePresence>
        {isSilent && (
          <motion.div
            className="silence-vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="fixed inset-0 flex items-center justify-end pb-[25vh] flex-col">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.3em',
                }}
              >
                · · ·
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End-of-Song Performance Wrap */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center"
          >
             <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '80px', color: 'white' }}>
               PERFORMANCE_COMPLETE
             </h2>
             <div className="flex gap-20 mt-8">
                <div className="text-center">
                   <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>AVG_VELOCITY</p>
                   <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '48px', color: 'var(--high-cold)' }}>{getVelocity().toFixed(1)}</p>
                </div>
                <div className="text-center">
                   <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>TOTAL_KEYSTROKES</p>
                   <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '48px', color: 'white' }}>{getKeystrokeCount()}</p>
                </div>
             </div>
             <motion.button
                onClick={onExit}
                className="mt-20 px-12 py-4 border border-white/20 uppercase hover:bg-white hover:text-black transition-colors"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}
             >
                return_to_void
             </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Film grain overlay */}
      <div className="film-grain" />

      {/* Minimal track info — bottom left */}
      <motion.div
        className="fixed bottom-8 left-8 z-[200] flex flex-col"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
          {title}
        </p>
      </motion.div>
    </>
  );
}
