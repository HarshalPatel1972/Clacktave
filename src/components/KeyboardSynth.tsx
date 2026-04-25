"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';

const SCALE = [130.81, 146.83, 155.56, 174.61, 196.00, 207.65, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25];
const PROGRESSION = [0, 5, 6, 4];

class Particle {
  x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; decay: number;
  constructor(x: number, y: number, color: string, intensity: number) {
    this.x = x; this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 5 + 1) * (1 + intensity);
    this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
    this.size = Math.random() * 2 + 1; this.color = color;
    this.life = 1.0; this.decay = 0.015;
  }
  update() { this.x += this.vx; this.y += this.vy; this.vx *= 0.98; this.vy *= 0.98; this.life -= this.decay; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color; ctx.globalAlpha = this.life * 0.6;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
  }
}

class Glyph {
  char: string; x: number; y: number; life: number; color: string;
  constructor(char: string, x: number, y: number, color: string) {
    this.char = char; this.x = x; this.y = y; this.life = 1.0; this.color = color;
  }
  update() { this.life -= 0.02; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.globalAlpha = this.life * 0.3;
    const size = 150 * (1.5 - this.life);
    ctx.font = `600 ${size}px Inter, -apple-system, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = this.color; ctx.fillText(this.char, this.x, this.y);
    ctx.restore();
  }
}

export default function KeyboardSynth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const glyphsRef = useRef<Glyph[]>([]);
  const requestRef = useRef<number>(0);
  const mousePos = useRef({ x: -1000, y: -1000 });
  const intensity = useRef(0);
  const lyricImpact = useRef(0);
  const activeKeys = useRef(new Set<string>());
  
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeTrack, setActiveTrack] = useState<{title: string} | null>(null);
  const [isManuallyPlaying, setIsManuallyPlaying] = useState(false);
  const [lyrics, setLyrics] = useState<any[]>([]);
  const [showLyrics, setShowLyrics] = useState(true);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const ytPlayer = useRef<any>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  };

  const playChord = (charCode: number) => {
    if (activeTrack) return;
    initAudio();
    const ctx = audioCtxRef.current!;
    const rootFreq = SCALE[charCode % SCALE.length];
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(rootFreq, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 1.5);
  };

  const spawnVisuals = (char: string, keyCode: number) => {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const color = 'rgba(255, 255, 255, 0.8)';
    glyphsRef.current.push(new Glyph(char, x, y, color));
    for (let i = 0; i < 15; i++) particlesRef.current.push(new Particle(x, y, color, intensity.current));
    intensity.current = Math.min(1.0, intensity.current + 0.1);
    lyricImpact.current = 1.0;
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const spacing = 100;
    for (let x = 0; x <= width; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y <= height; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.restore();
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
      const words = text.split(' '); const lines = []; let currentLine = words[0];
      for (let i = 1; i < words.length; i++) {
          const word = words[i]; const width = ctx.measureText(currentLine + " " + word).width;
          if (width < maxWidth) currentLine += " " + word; else { lines.push(currentLine); currentLine = word; }
      }
      lines.push(currentLine); return lines;
  };

  const drawLyrics = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!showLyrics || lyrics.length === 0 || !ytPlayer.current || !ytPlayer.current.getCurrentTime) return;
      const currentTime = ytPlayer.current.getCurrentTime();
      
      // STRICT SINGLE-LINE SELECTION TO PREVENT OVERLAP
      const currentLine = lyrics.find(line => currentTime >= line.start && currentTime < (line.start + line.dur));
      if (!currentLine) return;

      const text = currentLine.text.toUpperCase();
      const maxWidth = width * 0.7;
      
      const lineLength = text.length;
      const energy = Math.min(1.5, (lineLength / currentLine.dur) / 10);
      const pulse = Math.sin(Date.now() * 0.01 * (1 + energy)) * 0.02;
      const scale = 1 + pulse + (lyricImpact.current * 0.1);
      
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const baseSize = text.length > 50 ? 32 : 48;
      ctx.font = `600 ${baseSize}px Inter, -apple-system, sans-serif`;
      ctx.letterSpacing = '4px';
      
      const lines = wrapText(ctx, text, maxWidth);
      const lineHeight = baseSize * 1.6; // INCREASED LINE HEIGHT FOR CLARITY
      const startY = -(lines.length * lineHeight) / 2 + lineHeight / 2;

      lines.forEach((line, i) => {
          ctx.fillStyle = 'white';
          ctx.globalAlpha = 1.0; // FULL OPACITY FOR CLARITY
          ctx.fillText(line, 0, startY + (i * lineHeight));
      });
      ctx.restore();
      lyricImpact.current *= 0.95;
  };

  const updatePlayback = useCallback(() => {
    if (!ytPlayer.current || !ytPlayer.current.playVideo) return;
    if (activeKeys.current.size > 0 || isManuallyPlaying) {
        ytPlayer.current.playVideo();
        ytPlayer.current.setVolume(100);
    } else {
        ytPlayer.current.pauseVideo();
        ytPlayer.current.setVolume(0);
    }
  }, [isManuallyPlaying]);

  const animate = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width, canvas.height);
    drawLyrics(ctx, canvas.width, canvas.height);
    glyphsRef.current.forEach(g => { g.update(); g.draw(ctx); }); glyphsRef.current = glyphsRef.current.filter(g => g.life > 0);
    particlesRef.current.forEach(p => { p.update(); p.draw(ctx); }); particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    intensity.current *= 0.98;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    (window as any).onYouTubeIframeAPIReady = () => {
        ytPlayer.current = new (window as any).YT.Player('yt-player', { height: '0', width: '0', videoId: 'dQw4w9WgXcQ', events: { 'onReady': (event: any) => event.target.setVolume(0) } });
    };
    const handleResize = () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; } };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSearch) return;
      if (e.key === '/') { e.preventDefault(); setShowSearch(true); return; }
      if (e.repeat) return;
      activeKeys.current.add(e.code); updatePlayback();
      const charCode = e.key.toUpperCase().charCodeAt(0);
      if ((charCode >= 65 && charCode <= 90) || (charCode >= 48 && charCode <= 57)) { playChord(charCode); spawnVisuals(e.key.toUpperCase(), charCode); }
    };
    const handleKeyUp = (e: KeyboardEvent) => { activeKeys.current.delete(e.code); updatePlayback(); };
    window.addEventListener('resize', handleResize); window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    handleResize(); requestRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('resize', handleResize); window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [showSearch, updatePlayback]);

  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault(); if (!searchQuery.trim()) return;
      setLoadingStep("Searching"); setProgress(20);
      try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
          const data = await res.json();
          if (data.videoId && ytPlayer.current) {
              setLoadingStep("Loading Lyrics"); setProgress(60);
              ytPlayer.current.loadVideoById(data.videoId);
              ytPlayer.current.pauseVideo();
              const cleanTitle = data.title.replace(/\(Official.*?\)/gi, '').replace(/\[Official.*?\]/gi, '').trim();
              setActiveTrack({ title: cleanTitle });
              const lyrRes = await fetch(`/api/lyrics?videoId=${data.videoId}&title=${encodeURIComponent(cleanTitle)}`);
              const lyrData = await lyrRes.json();
              setLyrics(lyrData.lyrics || []);
              setLoadingStep("Syncing"); setProgress(90);
              setTimeout(() => { setLoadingStep(null); setShowSearch(false); setSearchQuery(''); setProgress(0); }, 500);
          }
      } catch (err) { setLoadingStep(null); }
  };

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full bg-black" />
      <div id="yt-player" className="hidden" />
      
      {showSearch && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <form onSubmit={handleSearch} className="w-full max-w-xl px-12">
                <input autoFocus disabled={loadingStep !== null} type="text" placeholder="Search a song..." className="w-full bg-transparent text-white text-4xl font-light tracking-tight focus:outline-none placeholder:text-white/20 text-center" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)} />
                {loadingStep && (
                    <div className="mt-12 flex flex-col items-center gap-4">
                        <div className="w-48 h-[1px] bg-white/10 overflow-hidden relative">
                            <div className="absolute inset-0 bg-white transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-white/40 font-light text-xs tracking-widest uppercase">{loadingStep}</p>
                    </div>
                )}
            </form>
        </div>
      )}

      {activeTrack && !showSearch && (
          <div className="fixed bottom-12 left-12 z-[500] flex items-center gap-8">
              <div className="flex items-center gap-3 bg-white/5 backdrop-blur-2xl border border-white/10 p-2 rounded-2xl shadow-2xl">
                  <button onClick={() => setIsManuallyPlaying(!isManuallyPlaying)} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors">
                      {isManuallyPlaying ? (
                          <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="3" height="16" rx="1" /><rect x="15" y="4" width="3" height="16" rx="1" /></svg>
                      ) : (
                          <svg className="w-4 h-4 text-white fill-current translate-x-0.5" viewBox="0 0 24 24"><path d="M7 6v12l10-6z" /></svg>
                      )}
                  </button>
                  <div className="w-[1px] h-4 bg-white/10" />
                  <button onClick={() => setShowLyrics(!showLyrics)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showLyrics ? 'bg-white text-black' : 'text-white/40 hover:bg-white/10'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  </button>
                  <button onClick={() => setShowSearch(true)} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:bg-white/10 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  </button>
              </div>
              <div className="flex flex-col">
                  <p className="text-white font-medium tracking-tight text-sm mb-0.5">{activeTrack.title}</p>
                  <p className="text-white/30 text-[10px] font-medium tracking-widest uppercase">System Ready</p>
              </div>
          </div>
      )}

      {!showSearch && !activeTrack && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <p className="text-white/20 font-light text-xs tracking-[0.8em] uppercase">Press [/] to search</p>
          </div>
      )}
    </>
  );
}
