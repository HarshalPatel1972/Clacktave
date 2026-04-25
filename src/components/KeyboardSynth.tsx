"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';

const SCALE = [130.81, 146.83, 155.56, 174.61, 196.00, 207.65, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25];

class Spark {
  x: number; y: number; vx: number; vy: number; life: number; color: string;
  constructor(x: number, y: number, color: string) {
    this.x = x; this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 15 + 5;
    this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
    this.life = 1.0; this.color = color;
  }
  update() { this.x += this.vx; this.y += this.vy; this.life -= 0.05; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = this.color; ctx.globalAlpha = this.life; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 0.2, this.y - this.vy * 0.2); ctx.stroke();
  }
}

class Glyph {
  char: string; x: number; y: number; life: number;
  constructor(char: string, x: number, y: number) {
    this.char = char; this.x = x; this.y = y; this.life = 1.0;
  }
  update() { this.life -= 0.04; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.globalAlpha = this.life * 0.4;
    const size = 100 * (1.2 - this.life);
    ctx.font = `900 ${size}px Outfit, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.fillText(this.char, this.x, this.y);
    ctx.restore();
  }
}

export default function KeyboardSynth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sparksRef = useRef<Spark[]>([]);
  const glyphsRef = useRef<Glyph[]>([]);
  const requestRef = useRef<number>(0);
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
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.8);
  };

  const spawnVisuals = (char: string) => {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    glyphsRef.current.push(new Glyph(char, x, y));
    for (let i = 0; i < 8; i++) sparksRef.current.push(new Spark(x, y, '#00f2ff'));
    intensity.current = Math.min(1.0, intensity.current + 0.15);
    lyricImpact.current = 1.0;
  };

  const drawLaserGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.strokeStyle = `rgba(0, 242, 255, ${0.05 + intensity.current * 0.15})`;
    ctx.lineWidth = 0.5;
    const spacing = 100;
    for (let x = 0; x <= width; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y <= height; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.restore();
  };

  const drawLyrics = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (!showLyrics || lyrics.length === 0 || !ytPlayer.current || !ytPlayer.current.getCurrentTime) return;
      const currentTime = ytPlayer.current.getCurrentTime();
      const currentIndex = lyrics.findIndex(l => currentTime >= l.start && currentTime < (l.start + l.dur));
      const targetScroll = currentIndex === -1 ? scrollPos.current : currentIndex;
      scrollPos.current += (targetScroll - scrollPos.current) * 0.15; // Faster scroll

      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lineHeight = 110;
      const centerY = height / 2;

      for (let i = Math.max(0, Math.floor(scrollPos.current - 2)); i <= Math.min(lyrics.length - 1, Math.ceil(scrollPos.current + 2)); i++) {
          const line = lyrics[i];
          const y = centerY + (i - scrollPos.current) * lineHeight;
          const dist = Math.abs(i - scrollPos.current);
          const opacity = Math.max(0, 1 - dist * 0.9);
          if (opacity <= 0) continue;

          ctx.save(); ctx.translate(width / 2, y);
          
          const isActive = i === currentIndex;
          // KINETIC WEIGHT SHIFTING
          const energy = Math.min(1, (line.text.length / line.dur) / 8);
          const weight = isActive ? Math.floor(400 + (lyricImpact.current + energy) * 500) : 200;
          
          ctx.font = `${weight} ${isActive ? 64 : 40}px Outfit, sans-serif`;
          ctx.letterSpacing = isActive ? '0px' : '4px';

          if (isActive && line.words) {
              let currentX = -ctx.measureText(line.text.toUpperCase()).width / 2;
              line.words.forEach((word: any) => {
                  const wordText = word.text.toUpperCase();
                  const wordWidth = ctx.measureText(wordText).width;
                  const isWordActive = (currentTime - line.start) >= word.offset;
                  ctx.globalAlpha = isWordActive ? 1.0 : 0.1;
                  ctx.fillStyle = '#ffffff';
                  ctx.fillText(wordText, currentX + wordWidth / 2, 0);
                  currentX += wordWidth;
              });
          } else {
              ctx.globalAlpha = opacity * 0.2; ctx.fillStyle = '#ffffff';
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
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawLaserGrid(ctx, canvas.width, canvas.height);
    drawLyrics(ctx, canvas.width, canvas.height);
    glyphsRef.current.forEach(g => { g.update(); g.draw(ctx); }); glyphsRef.current = glyphsRef.current.filter(g => g.life > 0);
    sparksRef.current.forEach(s => { s.update(); s.draw(ctx); }); sparksRef.current = sparksRef.current.filter(s => s.life > 0);
    intensity.current *= 0.95; lyricImpact.current *= 0.92;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    (window as any).onYouTubeIframeAPIReady = () => {
        ytPlayer.current = new (window as any).YT.Player('yt-player', { height: '0', width: '0', videoId: 'dQw4w9WgXcQ' });
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSearch) return;
      if (e.key === '/') { e.preventDefault(); setShowSearch(true); return; }
      if (e.repeat) return;
      activeKeys.current.add(e.code); updatePlayback();
      const charCode = e.key.toUpperCase().charCodeAt(0);
      if ((charCode >= 65 && charCode <= 90) || (charCode >= 48 && charCode <= 57)) { playChord(charCode); spawnVisuals(e.key.toUpperCase()); }
    };
    const handleKeyUp = (e: KeyboardEvent) => { activeKeys.current.delete(e.code); updatePlayback(); };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    const handleResize = () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; } };
    window.addEventListener('resize', handleResize); handleResize(); 
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [showSearch, updatePlayback]);

  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault(); if (!searchQuery.trim()) return;
      setLoadingStep("Search"); setProgress(30);
      try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
          const data = await res.json();
          if (data.videoId && ytPlayer.current) {
              setLoadingStep("Sync"); setProgress(70);
              ytPlayer.current.cueVideoById(data.videoId);
              const cleanTitle = data.title.replace(/\(Official.*?\)/gi, '').replace(/\[Official.*?\]/gi, '').trim();
              setActiveTrack({ title: cleanTitle });
              const lyrRes = await fetch(`/api/lyrics?videoId=${data.videoId}&title=${encodeURIComponent(cleanTitle)}`);
              const lyrData = await lyrRes.json();
              setLyrics(lyrData.lyrics || []);
              setLoadingStep("Ready"); setProgress(100);
              setTimeout(() => { setLoadingStep(null); setShowSearch(false); setSearchQuery(''); setProgress(0); }, 300);
          }
      } catch (err) { setLoadingStep(null); }
  };

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" />
      <div id="yt-player" className="hidden" />
      
      <div className={`fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-xl transition-all duration-300 ${showSearch ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <form onSubmit={handleSearch} className="w-full max-w-xl px-12 snap-in">
              <input autoFocus disabled={loadingStep !== null} type="text" placeholder="Track search..." className="w-full bg-transparent text-white text-5xl font-extralight tracking-tight focus:outline-none placeholder:text-white/10 text-center" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)} />
              {loadingStep && (
                  <div className="mt-12 flex flex-col items-center gap-4">
                      <div className="w-48 h-[1px] bg-white/10 overflow-hidden relative">
                          <div className="absolute inset-0 bg-white transition-all duration-300" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-white/30 font-bold text-[10px] tracking-[0.3em] uppercase">{loadingStep}</p>
                  </div>
              )}
          </form>
      </div>

      <div className={`fixed bottom-12 left-12 z-[500] flex items-center gap-8 transition-all duration-300 ${activeTrack && !showSearch ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="studio-glass p-2 rounded-2xl flex items-center gap-3">
              <button onClick={() => setIsManuallyPlaying(!isManuallyPlaying)} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all active:scale-90">
                  {isManuallyPlaying ? (
                      <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="3" height="16" rx="1" /><rect x="15" y="4" width="3" height="16" rx="1" /></svg>
                  ) : (
                      <svg className="w-4 h-4 text-white fill-current translate-x-0.5" viewBox="0 0 24 24"><path d="M7 6v12l10-6z" /></svg>
                  )}
              </button>
              <div className="w-[1px] h-4 bg-white/10" />
              <button onClick={() => setShowLyrics(!showLyrics)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showLyrics ? 'studio-btn-active' : 'text-white/30 hover:bg-white/10'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </button>
              <button onClick={() => setShowSearch(true)} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/30 hover:bg-white/10">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </button>
          </div>
          <div className="flex flex-col">
              <p className="text-white text-base font-bold tracking-tight mb-0.5">{activeTrack?.title}</p>
              <p className="text-[#00f2ff] text-[10px] font-black tracking-[0.1em] uppercase">Studio Active</p>
          </div>
      </div>

      {!showSearch && !activeTrack && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <p className="text-white/10 font-bold text-xs tracking-[1em] uppercase">Connect System</p>
          </div>
      )}
    </>
  );
}
