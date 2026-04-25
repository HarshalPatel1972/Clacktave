"use client";

import React, { useEffect, useRef, useState } from 'react';

const SCALE = [130.81, 146.83, 155.56, 174.61, 196.00, 207.65, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25];
const PROGRESSION = [0, 5, 6, 4];
const COLORS_CALM = ['#ffffff', '#00f2ff', '#7000ff'];
const COLORS_HOT = ['#ff0055', '#ffaa00', '#ff00ff'];

class Particle {
  x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; decay: number;
  constructor(x: number, y: number, color: string, intensity: number) {
    this.x = x; this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 8 + 2) * (1 + intensity * 2);
    this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
    this.size = Math.random() * 3 + 1; this.color = color;
    this.life = 1.0; this.decay = (Math.random() * 0.02 + 0.01) * (0.5 + intensity);
  }
  update() { this.x += this.vx; this.y += this.vy; this.vx *= 0.96; this.vy *= 0.96; this.life -= this.decay; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color; ctx.globalAlpha = this.life;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
  }
}

class Glyph {
  char: string; x: number; y: number; life: number; color: string; intensity: number;
  constructor(char: string, x: number, y: number, color: string, intensity: number) {
    this.char = char; this.x = x; this.y = y; this.life = 1.0; this.color = color; this.intensity = intensity;
  }
  update() { this.life -= 0.04 * (1 + this.intensity); }
  draw(ctx: CanvasRenderingContext2D, glitch: boolean) {
    ctx.save(); ctx.globalAlpha = this.life * (glitch ? 0.8 : 0.4);
    const size = 200 * (2 - this.life);
    ctx.font = `bold ${size}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (this.intensity > 0.4) {
      ctx.fillStyle = '#ff0055'; ctx.fillText(this.char, this.x - (15 * this.intensity), this.y);
      ctx.fillStyle = '#00f2ff'; ctx.fillText(this.char, this.x + (15 * this.intensity), this.y);
    }
    ctx.fillStyle = glitch ? '#000000' : this.color; ctx.fillText(this.char, this.x, this.y);
    ctx.restore();
  }
}

export default function KeyboardSynth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const glyphsRef = useRef<Glyph[]>([]);
  const requestRef = useRef<number>(0);
  const mouseDroneRef = useRef<{ osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null>(null);
  const mousePos = useRef({ x: -1000, y: -1000 });
  const screenShake = useRef(0);
  const gridWarp = useRef(0);
  const keystrokes = useRef<number[]>([]);
  const intensity = useRef(0);
  const chordStep = useRef(0);
  const activeKeys = useRef(new Set<string>());
  
  // YouTube Logic
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const ytPlayer = useRef<any>(null);
  const isYTServing = useRef(false);

  const initMouseDrone = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtxRef.current; if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator(); const gain = ctx.createGain(); const filter = ctx.createBiquadFilter();
    osc.type = 'sine'; filter.type = 'lowpass'; gain.gain.setValueAtTime(0, ctx.currentTime);
    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    osc.start(); mouseDroneRef.current = { osc, gain, filter };
  };

  const playChord = (charCode: number) => {
    if (!audioCtxRef.current) initMouseDrone();
    const ctx = audioCtxRef.current!;
    chordStep.current++;
    const progIndex = Math.floor(chordStep.current / 8) % PROGRESSION.length;
    const rootFreq = SCALE[PROGRESSION[progIndex]];
    const intervals = [1, 1.2, 1.5, 1.8, 2.2];

    intervals.forEach((interval, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = intensity.current > 0.6 ? (Math.random() > 0.5 ? 'sawtooth' : 'square') : (i === 0 ? 'sawtooth' : 'sine');
      osc.frequency.setValueAtTime(rootFreq * interval * (1 + (charCode % 12) / 12), ctx.currentTime);
      const volume = (0.08 / (i + 1)) * (1.0 + intensity.current * 2);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 3.0);
    });
  };

  const spawnVisuals = (char: string, keyCode: number) => {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const palette = intensity.current > 0.4 ? COLORS_HOT : COLORS_CALM;
    const color = palette[keyCode % palette.length];
    glyphsRef.current.push(new Glyph(char, x, y, color, intensity.current));
    for (let i = 0; i < 20 * (1 + intensity.current * 2); i++) {
      particlesRef.current.push(new Particle(x, y, color, intensity.current));
    }
    screenShake.current = 20 * (1 + intensity.current * 2);
    gridWarp.current = 150 * (1 + intensity.current);
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, isGlitch: boolean) => {
    ctx.save();
    ctx.strokeStyle = isGlitch ? 'rgba(0, 0, 0, 0.4)' : (intensity.current > 0.4 ? 'rgba(255, 0, 85, 0.15)' : 'rgba(255, 255, 255, 0.05)');
    ctx.lineWidth = 0.5 + intensity.current * 2;
    const spacing = 80 - (intensity.current * 30);
    for (let x = 0; x <= width; x += spacing) {
      ctx.beginPath();
      for (let y = 0; y <= height; y += 25) {
        const dMouse = Math.hypot(x - mousePos.current.x, y - mousePos.current.y);
        const warp = (Math.exp(-dMouse / 150) * 50 + (Math.random() * gridWarp.current * 0.1)) * (1 + intensity.current);
        ctx.lineTo(x + warp * (x - mousePos.current.x) / 150, y + warp * (y - mousePos.current.y) / 150);
      }
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += spacing) {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 25) {
        const dMouse = Math.hypot(x - mousePos.current.x, y - mousePos.current.y);
        const warp = (Math.exp(-dMouse / 150) * 50 + (Math.random() * gridWarp.current * 0.1)) * (1 + intensity.current);
        ctx.lineTo(x + warp * (x - mousePos.current.x) / 150, y + warp * (y - mousePos.current.y) / 150);
      }
      ctx.stroke();
    }
    ctx.restore();
    gridWarp.current *= 0.94;
  };

  const animate = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const isGlitch = intensity.current > 0.9 && Math.random() > 0.8;
    
    ctx.fillStyle = isGlitch ? 'white' : (intensity.current > 0.7 ? 'rgba(15, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.2)');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    if (screenShake.current > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake.current, (Math.random() - 0.5) * screenShake.current);
      screenShake.current *= 0.85;
    }

    drawGrid(ctx, canvas.width, canvas.height, isGlitch);

    ctx.strokeStyle = isGlitch ? 'rgba(0,0,0,0.2)' : (intensity.current > 0.4 ? 'rgba(255, 0, 85, 0.2)' : 'rgba(255, 255, 255, 0.1)');
    for (let i = 0; i < particlesRef.current.length; i++) {
      for (let j = i + 1; j < Math.min(i + 5, particlesRef.current.length); j++) {
        const p1 = particlesRef.current[i]; const p2 = particlesRef.current[j];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < 150) {
          ctx.globalAlpha = (1 - dist / 150) * p1.life * p2.life * 0.5;
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
      }
    }
    glyphsRef.current.forEach(g => { g.update(); g.draw(ctx, isGlitch); });
    glyphsRef.current = glyphsRef.current.filter(g => g.life > 0);
    particlesRef.current.forEach(p => { p.update(); p.draw(ctx); });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    ctx.restore();
    intensity.current *= 0.992;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    // Load YouTube API
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
        ytPlayer.current = new (window as any).YT.Player('yt-player', {
            height: '0',
            width: '0',
            videoId: 'dQw4w9WgXcQ', // Default demo
            events: {
                'onReady': (event: any) => event.target.setVolume(0)
            }
        });
    };

    const handleResize = () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; } };
    const updatePlayback = () => {
        if (!ytPlayer.current || !ytPlayer.current.playVideo) return;
        if (activeKeys.current.size > 0) {
            ytPlayer.current.playVideo();
            ytPlayer.current.setVolume(100);
        } else {
            ytPlayer.current.pauseVideo();
            ytPlayer.current.setVolume(0);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSearch) return;
      if (e.key === '/') {
          e.preventDefault();
          setShowSearch(true);
          return;
      }
      e.preventDefault();
      
      activeKeys.current.add(e.code);
      updatePlayback();

      if (e.repeat) return;
      const now = Date.now(); keystrokes.current.push(now);
      keystrokes.current = keystrokes.current.filter(t => now - t < 4000);
      intensity.current = Math.min(1.0, intensity.current + 0.08 + (keystrokes.current.length / 40));
      const charCode = e.key.toUpperCase().charCodeAt(0);
      if ((charCode >= 65 && charCode <= 90) || (charCode >= 48 && charCode <= 57)) {
        playChord(charCode);
        spawnVisuals(e.key.toUpperCase(), charCode);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        activeKeys.current.delete(e.code);
        updatePlayback();
    };
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (!mouseDroneRef.current) initMouseDrone();
      const drone = mouseDroneRef.current; const ctx = audioCtxRef.current;
      if (!drone || !ctx) return;
      const xRatio = e.clientX / window.innerWidth; const yRatio = e.clientY / window.innerHeight;
      drone.osc.frequency.setTargetAtTime(110 + (xRatio * 440), ctx.currentTime, 0.1);
      drone.filter.frequency.setTargetAtTime(400 + (yRatio * 2000), ctx.currentTime, 0.1);
      drone.gain.gain.setTargetAtTime(0.06, ctx.currentTime, 0.05);
      if ((drone as any)._timeout) clearTimeout((drone as any)._timeout);
      (drone as any)._timeout = setTimeout(() => { if (audioCtxRef.current) drone.gain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.3); }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    handleResize();
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [showSearch]);

  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;

      setIsSearching(true);
      try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
          const data = await res.json();
          
          if (data.videoId && ytPlayer.current) {
              ytPlayer.current.loadVideoById(data.videoId);
              ytPlayer.current.pauseVideo();
          }
      } catch (err) {
          console.error("Search failed:", err);
      } finally {
          setIsSearching(false);
          setShowSearch(false);
          setSearchQuery('');
      }
  };

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full bg-black touch-none" style={{ cursor: 'auto' }} id="clacktave-canvas" />
      <div id="yt-player" className="hidden" />
      
      {showSearch && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <form onSubmit={handleSearch} className="w-full max-w-2xl px-8">
                <input
                    autoFocus
                    disabled={isSearching}
                    type="text"
                    placeholder={isSearching ? "FINDING YOUR TRACK..." : "ENTER SONG NAME AND PRESS ENTER..."}
                    className="w-full bg-transparent border-b-2 border-white text-white text-3xl font-mono uppercase focus:outline-none placeholder:text-white/20 disabled:opacity-50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)}
                />
                <p className="mt-4 text-white/40 font-mono text-sm uppercase">
                    {isSearching ? "SEARCHING..." : "ESC TO CANCEL • ENTER TO SEARCH"}
                </p>
            </form>
        </div>
      )}
    </>
  );
}
