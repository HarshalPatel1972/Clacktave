"use client";

import React, { useEffect, useRef } from 'react';

const SCALE = [130.81, 155.56, 174.61, 196.00, 233.08, 261.63, 311.13, 349.23, 392.00, 466.16];
const COLORS = ['#ffffff', '#00f2ff', '#7000ff', '#ff0055'];

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  decay: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.size = Math.random() * 3 + 1;
    this.color = color;
    this.life = 1.0;
    this.decay = Math.random() * 0.02 + 0.01;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.life -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.life;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Glyph {
  char: string;
  x: number;
  y: number;
  life: number;
  color: string;

  constructor(char: string, x: number, y: number, color: string) {
    this.char = char;
    this.x = x;
    this.y = y;
    this.life = 1.0;
    this.color = color;
  }

  update() {
    this.life -= 0.04;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.life * 0.3;
    ctx.font = `bold ${200 * (2 - this.life)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Chromatic Aberration Effect
    ctx.fillStyle = '#ff0055';
    ctx.fillText(this.char, this.x - 5, this.y);
    ctx.fillStyle = '#00f2ff';
    ctx.fillText(this.char, this.x + 5, this.y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.char, this.x, this.y);
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
  const screenShake = useRef(0);

  const initMouseDrone = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sine';
    filter.type = 'lowpass';
    gain.gain.setValueAtTime(0, ctx.currentTime);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    mouseDroneRef.current = { osc, gain, filter };
  };

  const playChord = (frequency: number) => {
    if (!audioCtxRef.current) initMouseDrone();
    const ctx = audioCtxRef.current!;
    
    // Generative Harmony: Minor 9th / Major 7th based on frequency
    const isHigh = frequency > 300;
    const intervals = isHigh ? [1, 1.25, 1.5, 1.875, 2.25] : [1, 1.2, 1.5, 1.75, 2.2];

    intervals.forEach((interval, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = i === 0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(frequency * interval, ctx.currentTime);
      
      // Dynamic velocity per harmonic
      const volume = (0.1 / (i + 1)) * (1.0 - (i * 0.1));
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 2.5);
    });
  };

  const spawnVisuals = (char: string, keyCode: number) => {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const color = COLORS[keyCode % COLORS.length];

    glyphsRef.current.push(new Glyph(char, x, y, color));
    for (let i = 0; i < 15; i++) {
      particlesRef.current.push(new Particle(x, y, color));
    }
    screenShake.current = 15;
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background fade with silky trails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (screenShake.current > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake.current, (Math.random() - 0.5) * screenShake.current);
      screenShake.current *= 0.9;
    }

    // Draw Neural Network Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < particlesRef.current.length; i++) {
      for (let j = i + 1; j < particlesRef.current.length; j++) {
        const p1 = particlesRef.current[i];
        const p2 = particlesRef.current[j];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < 150) {
          ctx.globalAlpha = (1 - dist / 150) * p1.life * p2.life * 0.5;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    // Update & Draw Glyphs
    for (let i = glyphsRef.current.length - 1; i >= 0; i--) {
      const g = glyphsRef.current[i];
      g.update();
      g.draw(ctx);
      if (g.life <= 0) glyphsRef.current.splice(i, 1);
    }

    // Update & Draw Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.update();
      p.draw(ctx);
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }

    ctx.restore();
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.repeat) return;
      const charCode = e.key.toUpperCase().charCodeAt(0);
      if ((charCode >= 65 && charCode <= 90) || (charCode >= 48 && charCode <= 57)) {
        playChord(SCALE[charCode % SCALE.length]);
        spawnVisuals(e.key.toUpperCase(), charCode);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseDroneRef.current) initMouseDrone();
      const drone = mouseDroneRef.current;
      const ctx = audioCtxRef.current;
      if (!drone || !ctx) return;
      const xRatio = e.clientX / window.innerWidth;
      const yRatio = e.clientY / window.innerHeight;
      drone.osc.frequency.setTargetAtTime(110 + (xRatio * 440), ctx.currentTime, 0.1);
      drone.filter.frequency.setTargetAtTime(400 + (yRatio * 2000), ctx.currentTime, 0.1);
      drone.gain.gain.setTargetAtTime(0.06, ctx.currentTime, 0.05);
      if ((drone as any)._timeout) clearTimeout((drone as any)._timeout);
      (drone as any)._timeout = setTimeout(() => {
        if (audioCtxRef.current) drone.gain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.3);
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    handleResize();
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full bg-black touch-none"
      style={{ cursor: 'auto' }}
      id="clacktave-canvas"
    />
  );
}
