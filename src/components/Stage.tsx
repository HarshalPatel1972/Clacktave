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

  const [isSilent, setIsSilent] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [showLyrics, setShowLyrics] = useState(true);

  const { recordKeystroke, getVelocity } = useTypingVelocity();
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
    }
  }, [yt.ready, videoId]);

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
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); onExit?.(); return; }

    e.preventDefault();
    lastKeyTime.current = Date.now();
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
    yt.setVolume(30 + (vel / 10) * 70);

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

  // Mouse tracking for grid gravity
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (gridState.current) {
        gridState.current.mouseX = e.clientX;
        gridState.current.mouseY = e.clientY;
      }
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
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
