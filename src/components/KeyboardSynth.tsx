"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';

const SCALE = [130.81, 146.83, 155.56, 174.61, 196.00, 207.65, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25];

class Particle {
  x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; decay: number;
  constructor(x: number, y: number, color: string, intensity: number) {
    this.x = x; this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 4 + 1) * (1 + intensity);
    this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
    this.size = Math.random() * 2.5 + 0.5; this.color = color;
    this.life = 1.0; this.decay = 0.01 + Math.random() * 0.01;
  }
  update(mouse: {x: number, y: number}) {
    // MAGNETIC FLUID DYNAMICS
    const dx = mouse.x - this.x; const dy = mouse.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 300) {
        this.vx += (dx / dist) * 0.2; this.vy += (dy / dist) * 0.2;
    }
    this.x += this.vx; this.y += this.vy;
    this.vx *= 0.97; this.vy *= 0.97; // Viscosity
    this.life -= this.decay;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color; ctx.globalAlpha = this.life * 0.4;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    if (this.life > 0.8) { // Inner glow
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fill(); ctx.shadowBlur = 0;
    }
  }
}

class Glyph {
  char: string; x: number; y: number; life: number; color: string;
  constructor(char: string, x: number, y: number, color: string) {
    this.char = char; this.x = x; this.y = y; this.life = 1.0; this.color = color;
  }
  update() { this.life -= 0.02; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.globalAlpha = this.life * 0.15;
    const size = 180 * (1.6 - this.life);
    ctx.font = `700 ${size}px Outfit, sans-serif`;
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
  const scrollPos = useRef(0);
  const activeKeys = useRef(new Set<string>());
  
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
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 1.2);
  };

  const spawnVisuals = (char: string, keyCode: number) => {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const color = 'rgba(255, 255, 255, 0.7)';
    glyphsRef.current.push(new Glyph(char, x, y, color));
    for (let i = 0; i < 12; i++) particlesRef.current.push(new Particle(x, y, color, intensity.current));
    intensity.current = Math.min(1.0, intensity.current + 0.12);
    lyricImpact.current = 1.0;
  };

  const draw3DFabricGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const spacing = 120;
    const centerX = width / 2; const centerY = height / 2;

    for (let x = -width; x <= width * 2; x += spacing) {
      ctx.beginPath();
      for (let y = 0; y <= height; y += 20) {
        // Warp based on mouse and key intensity
        const dx = x - mousePos.current.x; const dy = y - mousePos.current.y;
        const dist = Math.hypot(dx, dy);
        const warp = (Math.exp(-dist / 200) * 80 + (intensity.current * 40)) * (1 + Math.sin(Date.now() * 0.001) * 0.1);
        const perspective = 1 + (y / height) * 0.5;
        ctx.lineTo(x + (dx / dist) * warp * perspective, y + (dy / dist) * warp);
      }
      ctx.stroke();
    }
    for (let y = -height; y <= height * 2; y += spacing) {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 20) {
        const dx = x - mousePos.current.x; const dy = y - mousePos.current.y;
        const dist = Math.hypot(dx, dy);
        const warp = (Math.exp(-dist / 200) * 80 + (intensity.current * 40)) * (1 + Math.sin(Date.now() * 0.001) * 0.1);
        ctx.lineTo(x + (dx / dist) * warp, y + (dy / dist) * warp);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawLyrics = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!showLyrics || lyrics.length === 0 || !ytPlayer.current || !ytPlayer.current.getCurrentTime) return;
      const currentTime = ytPlayer.current.getCurrentTime();
      const currentIndex = lyrics.findIndex(l => currentTime >= l.start && currentTime < (l.start + l.dur));
      const targetScroll = currentIndex === -1 ? scrollPos.current : currentIndex;
      scrollPos.current += (targetScroll - scrollPos.current) * 0.07;

      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lineHeight = 100;
      const centerY = height / 2;
      const windowSize = 2;
      const startLine = Math.max(0, Math.floor(scrollPos.current - windowSize));
      const endLine = Math.min(lyrics.length - 1, Math.ceil(scrollPos.current + windowSize));

      for (let i = startLine; i <= endLine; i++) {
          const line = lyrics[i];
          const y = centerY + (i - scrollPos.current) * lineHeight;
          const dist = Math.abs(i - scrollPos.current);
          const opacity = Math.max(0, 1 - dist * 0.8);
          if (opacity <= 0) continue;

          ctx.save(); ctx.translate(width / 2, y);
          const scale = 1 - dist * 0.2 + (lyricImpact.current * 0.05);
          ctx.scale(scale, scale);
          
          // DEPTH OF FIELD BLUR
          if (dist > 0.2) {
              const blurAmt = Math.min(10, dist * 8);
              ctx.filter = `blur(${blurAmt}px)`;
          }

          const isActive = i === currentIndex;
          const baseSize = isActive ? 56 : 38;
          ctx.font = `700 ${baseSize}px Outfit, sans-serif`;
          ctx.letterSpacing = isActive ? '0px' : '4px';

          if (isActive && line.words) {
              let currentX = -ctx.measureText(line.text.toUpperCase()).width / 2;
              line.words.forEach((word: any) => {
                  const wordText = word.text.toUpperCase();
                  const wordWidth = ctx.measureText(wordText).width;
                  const isWordActive = (currentTime - line.start) >= word.offset;
                  ctx.globalAlpha = isWordActive ? 1.0 : 0.15;
                  ctx.fillStyle = 'white';
                  ctx.fillText(wordText, currentX + wordWidth / 2, 0);
                  currentX += wordWidth;
              });
          } else {
              ctx.globalAlpha = opacity * 0.2; ctx.fillStyle = 'white';
              ctx.fillText(line.text.toUpperCase(), 0, 0);
          }
          ctx.restore();
      }
      ctx.restore();
  };

  const updatePlayback = useCallback(() => {
    if (!ytPlayer.current || !ytPlayer.current.playVideo) return;
    if (activeKeys.current.size > 0 || isManuallyPlaying) {
        ytPlayer.current.playVideo(); ytPlayer.current.setVolume(100);
    } else {
        ytPlayer.current.pauseVideo(); ytPlayer.current.setVolume(0);
    }
  }, [isManuallyPlaying]);

  const animate = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Let Aurora-BG show through
    draw3DFabricGrid(ctx, canvas.width, canvas.height);
    drawLyrics(ctx, canvas.width, canvas.height);
    glyphsRef.current.forEach(g => { g.update(); g.draw(ctx); }); glyphsRef.current = glyphsRef.current.filter(g => g.life > 0);
    particlesRef.current.forEach(p => { p.update(mousePos.current); p.draw(ctx); }); particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    intensity.current *= 0.97; lyricImpact.current *= 0.94;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    (window as any).onYouTubeIframeAPIReady = () => {
        ytPlayer.current = new (window as any).YT.Player('yt-player', { height: '0', width: '0', videoId: 'dQw4w9WgXcQ' });
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
    const handleMouseMove = (e: MouseEvent) => { mousePos.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('resize', handleResize); window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); window.addEventListener('mousemove', handleMouseMove);
    handleResize(); requestRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('resize', handleResize); window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); window.removeEventListener('mousemove', handleMouseMove);
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
              setLoadingStep("Syncing Lyrics"); setProgress(60);
              ytPlayer.current.cueVideoById(data.videoId);
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
      <div className="grain-overlay" />
      <div className="aurora-bg">
          <div className="aurora-blob bg-blue-600 top-[-10%] left-[-10%]" />
          <div className="aurora-blob bg-purple-600 bottom-[-10%] right-[-10%] animation-delay-2000" />
      </div>
      
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" />
      <div id="yt-player" className="hidden" />
      
      <div className={`fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-3xl transition-all duration-1000 ${showSearch ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <form onSubmit={handleSearch} className={`w-full max-w-xl px-12 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${showSearch ? 'scale-100 translate-y-0 opacity-100' : 'scale-90 translate-y-12 opacity-0'}`}>
              <input autoFocus disabled={loadingStep !== null} type="text" placeholder="Search a track..." className="w-full bg-transparent text-white text-5xl font-extralight tracking-tight focus:outline-none placeholder:text-white/5 text-center" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)} />
              {loadingStep && (
                  <div className="mt-16 flex flex-col items-center gap-6">
                      <div className="w-64 h-[1px] bg-white/5 overflow-hidden relative">
                          <div className="absolute inset-0 bg-white transition-all duration-1000 ease-in-out" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-white/30 font-light text-[10px] tracking-[0.5em] uppercase">{loadingStep}</p>
                  </div>
              )}
          </form>
      </div>

      <div className={`fixed bottom-12 left-12 z-[500] flex items-center gap-10 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${activeTrack && !showSearch ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="prismatic-glass p-2.5 rounded-[2rem] flex items-center gap-4">
              <button onClick={() => setIsManuallyPlaying(!isManuallyPlaying)} className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-all active:scale-90">
                  {isManuallyPlaying ? (
                      <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="3" height="16" rx="1.5" /><rect x="15" y="4" width="3" height="16" rx="1.5" /></svg>
                  ) : (
                      <svg className="w-5 h-5 text-white fill-current translate-x-0.5" viewBox="0 0 24 24"><path d="M7 6v12l10-6z" /></svg>
                  )}
              </button>
              <div className="w-[1px] h-5 bg-white/10" />
              <button onClick={() => setShowLyrics(!showLyrics)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${showLyrics ? 'bg-white text-black' : 'text-white/20 hover:bg-white/10'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </button>
              <button onClick={() => setShowSearch(true)} className="w-12 h-12 rounded-full flex items-center justify-center text-white/20 hover:bg-white/10 transition-all active:scale-90">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </button>
          </div>
          <div className="flex flex-col">
              <p className="text-white text-lg font-semibold tracking-tight leading-none mb-1.5">{activeTrack?.title}</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-white/30 text-[10px] font-bold tracking-[0.2em] uppercase">Hyper Fidelity</p>
              </div>
          </div>
      </div>

      {!showSearch && !activeTrack && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none transition-opacity duration-1000">
              <p className="text-white/5 font-light text-xs tracking-[1.5em] uppercase">Initiate Stream</p>
          </div>
      )}
    </>
  );
}
