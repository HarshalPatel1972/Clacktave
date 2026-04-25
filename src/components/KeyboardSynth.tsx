"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';

const SCALE = [130.81, 146.83, 155.56, 174.61, 196.00, 207.65, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25];

class Particle {
  x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; decay: number;
  constructor(x: number, y: number, color: string, intensity: number) {
    this.x = x; this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 5 + 1) * (1 + intensity);
    this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
    this.size = Math.random() * 2 + 0.5; this.color = color;
    this.life = 1.0; this.decay = 0.02;
  }
  update() { this.x += this.vx; this.y += this.vy; this.vx *= 0.98; this.vy *= 0.98; this.life -= this.decay; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color; ctx.globalAlpha = this.life * 0.4;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
  }
}

class Glyph {
  char: string; x: number; y: number; life: number; color: string;
  constructor(char: string, x: number, y: number, color: string) {
    this.char = char; this.x = x; this.y = y; this.life = 1.0; this.color = color;
  }
  update() { this.life -= 0.025; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.globalAlpha = this.life * 0.2;
    const size = 120 * (1.5 - this.life);
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
  const intensity = useRef(0);
  const lyricImpact = useRef(0);
  const scrollPos = useRef(0);
  const activeKeys = useRef(new Set<string>());
  const [playerReady, setPlayerReady] = useState(false);
  
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeTrack, setActiveTrack] = useState<{title: string} | null>(null);
  const [isManuallyPlaying, setIsManuallyPlaying] = useState(false);
  const [lyrics, setLyrics] = useState<any[]>([]);
  const [showLyrics, setShowLyrics] = useState(true);
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
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 1.2);
  };

  const spawnVisuals = (char: string, keyCode: number) => {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const color = 'rgba(255, 255, 255, 0.6)';
    glyphsRef.current.push(new Glyph(char, x, y, color));
    for (let i = 0; i < 10; i++) particlesRef.current.push(new Particle(x, y, color, intensity.current));
    intensity.current = Math.min(1.0, intensity.current + 0.1);
    lyricImpact.current = 1.0;
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'; ctx.lineWidth = 1;
    const spacing = 120;
    for (let x = 0; x <= width; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y <= height; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.restore();
  };

  const updatePlayback = useCallback(() => {
    if (!ytPlayer.current || !ytPlayer.current.playVideo) return;
    const shouldPlay = activeKeys.current.size > 0 || isManuallyPlaying;
    if (shouldPlay) {
        ytPlayer.current.playVideo();
        ytPlayer.current.setVolume(100);
    } else {
        ytPlayer.current.pauseVideo();
        ytPlayer.current.setVolume(0);
    }
  }, [isManuallyPlaying]);

  useEffect(() => { updatePlayback(); }, [isManuallyPlaying, updatePlayback]);

  const drawLyrics = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!showLyrics || lyrics.length === 0 || !ytPlayer.current || !ytPlayer.current.getCurrentTime) return;
      const currentTime = ytPlayer.current.getCurrentTime();
      const currentIndex = lyrics.findIndex(l => currentTime >= l.start && currentTime < (l.start + l.dur));
      const targetScroll = currentIndex === -1 ? scrollPos.current : currentIndex;
      scrollPos.current += (targetScroll - scrollPos.current) * 0.08;

      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lineHeight = 90;
      const centerY = height / 2;
      const windowSize = 2;
      const startLine = Math.max(0, Math.floor(scrollPos.current - windowSize));
      const endLine = Math.min(lyrics.length - 1, Math.ceil(scrollPos.current + windowSize));

      for (let i = startLine; i <= endLine; i++) {
          const line = lyrics[i];
          const y = centerY + (i - scrollPos.current) * lineHeight;
          const dist = Math.abs(i - scrollPos.current);
          const opacity = Math.max(0, 1 - dist * 0.7);
          if (opacity <= 0) continue;

          ctx.save(); ctx.translate(width / 2, y);
          const scale = 1 - dist * 0.15;
          ctx.scale(scale, scale);
          
          const isActive = i === currentIndex;
          const baseSize = isActive ? 52 : 36;
          ctx.font = `600 ${baseSize}px Inter, -apple-system, sans-serif`;
          
          if (isActive && line.words) {
              let currentX = -ctx.measureText(line.text.toUpperCase()).width / 2;
              line.words.forEach((word: any) => {
                  const wordText = word.text.toUpperCase();
                  const wordWidth = ctx.measureText(wordText).width;
                  const isWordActive = (currentTime - line.start) >= word.offset;
                  ctx.globalAlpha = isWordActive ? 1.0 : 0.2;
                  // CINEMATIC BLUR ENTRANCE FOR WORDS
                  if (isWordActive && (currentTime - line.start - word.offset) < 0.3) {
                      const blurAmt = Math.max(0, 10 - (currentTime - line.start - word.offset) * 33);
                      ctx.filter = `blur(${blurAmt}px)`;
                  } else { ctx.filter = 'none'; }
                  ctx.fillStyle = 'white';
                  ctx.fillText(wordText, currentX + wordWidth / 2, 0);
                  currentX += wordWidth;
              });
          } else {
              ctx.globalAlpha = opacity * 0.3; ctx.fillStyle = 'white';
              ctx.fillText(line.text.toUpperCase(), 0, 0);
          }
          ctx.restore();
      }
      ctx.restore();
  };

  const animate = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width, canvas.height);
    drawLyrics(ctx, canvas.width, canvas.height);
    glyphsRef.current.forEach(g => { g.update(); g.draw(ctx); }); glyphsRef.current = glyphsRef.current.filter(g => g.life > 0);
    particlesRef.current.forEach(p => { p.update(); p.draw(ctx); }); particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    intensity.current *= 0.98; requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    (window as any).onYouTubeIframeAPIReady = () => {
        ytPlayer.current = new (window as any).YT.Player('yt-player', { height: '0', width: '0', videoId: 'dQw4w9WgXcQ', events: { 'onReady': () => setPlayerReady(true) } });
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
              ytPlayer.current.cueVideoById(data.videoId); // CUE INSTEAD OF LOAD
              const cleanTitle = data.title.replace(/\(Official.*?\)/gi, '').replace(/\[Official.*?\]/gi, '').trim();
              setActiveTrack({ title: cleanTitle });
              const lyrRes = await fetch(`/api/lyrics?videoId=${data.videoId}&title=${encodeURIComponent(cleanTitle)}`);
              const lyrData = await lyrRes.json();
              setLyrics(lyrData.lyrics || []);
              setLoadingStep("Ready"); setProgress(100);
              setTimeout(() => { setLoadingStep(null); setShowSearch(false); setSearchQuery(''); setProgress(0); }, 800);
          }
      } catch (err) { setLoadingStep(null); }
  };

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full bg-black" />
      <div id="yt-player" className="hidden" />
      
      <div className={`fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-700 ${showSearch ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <form onSubmit={handleSearch} className={`w-full max-w-xl px-12 transition-all duration-1000 delay-100 transform ${showSearch ? 'translate-y-0 scale-100' : 'translate-y-10 scale-95'}`}>
              <input autoFocus disabled={loadingStep !== null} type="text" placeholder="Find a track..." className="w-full bg-transparent text-white text-4xl font-light tracking-tight focus:outline-none placeholder:text-white/10 text-center" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)} />
              {loadingStep && (
                  <div className="mt-16 flex flex-col items-center gap-6">
                      <div className="w-64 h-[1px] bg-white/5 overflow-hidden relative">
                          <div className="absolute inset-0 bg-white transition-all duration-700 ease-in-out" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-white/30 font-light text-[10px] tracking-[0.4em] uppercase">{loadingStep}</p>
                  </div>
              )}
          </form>
      </div>

      <div className={`fixed bottom-12 left-12 z-[500] flex items-center gap-8 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${activeTrack && !showSearch ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-2xl border border-white/10 p-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <button onClick={() => setIsManuallyPlaying(!isManuallyPlaying)} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all active:scale-90">
                  {isManuallyPlaying ? (
                      <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="3" height="16" rx="1" /><rect x="15" y="4" width="3" height="16" rx="1" /></svg>
                  ) : (
                      <svg className="w-4 h-4 text-white fill-current translate-x-0.5" viewBox="0 0 24 24"><path d="M7 6v12l10-6z" /></svg>
                  )}
              </button>
              <div className="w-[1px] h-4 bg-white/5" />
              <button onClick={() => setShowLyrics(!showLyrics)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${showLyrics ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-white/30 hover:bg-white/10'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </button>
              <button onClick={() => setShowSearch(true)} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/30 hover:bg-white/10 transition-all active:scale-90">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </button>
          </div>
          <div className="flex flex-col">
              <p className="text-white font-medium tracking-tight text-sm mb-0.5 max-w-[200px] truncate">{activeTrack?.title}</p>
              <p className="text-white/20 text-[10px] font-medium tracking-widest uppercase">Streaming Fidelity</p>
          </div>
      </div>

      {!showSearch && !activeTrack && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none transition-opacity duration-1000">
              <p className="text-white/10 font-light text-[10px] tracking-[1em] uppercase animate-pulse">PRESS [/] TO START</p>
          </div>
      )}
    </>
  );
}
