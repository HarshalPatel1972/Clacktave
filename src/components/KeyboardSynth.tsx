"use client";

import React, { useEffect, useRef } from 'react';

// Musical Scale: Minor Pentatonic (C, Eb, F, G, Bb)
const SCALE = [130.81, 155.56, 174.61, 196.00, 233.08, 261.63, 311.13, 349.23, 392.00, 466.16];

class Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  speed: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 40 + 10;
    this.color = '#ffffff';
    this.opacity = 1;
    this.speed = 0.015;
  }

  update() {
    this.size += 3;
    this.opacity -= this.speed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export default function KeyboardSynth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const requestRef = useRef<number>(0);
  const mouseDroneRef = useRef<{ osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null>(null);

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

  const playNote = (frequency: number) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Cinematic timbre selection
    osc.type = Math.random() > 0.7 ? 'sawtooth' : (Math.random() > 0.5 ? 'triangle' : 'sine');
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 2.0);
  };

  const spawnParticle = (keyCode: number) => {
    const x = Math.random() * window.innerWidth;
    // Map rows roughly by keycode ranges for vertical distribution
    const y = ((keyCode % 30) / 30) * window.innerHeight;
    particlesRef.current.push(new Particle(x, y));
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear with slight trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.update();
      p.draw(ctx);
      if (p.opacity <= 0) {
        particlesRef.current.splice(i, 1);
      }
    }

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
      // Prevent all default browser behaviors (scrolling, shortcuts, etc.)
      e.preventDefault();

      if (e.repeat) return;
      
      const charCode = e.key.toUpperCase().charCodeAt(0);
      // A-Z and 0-9
      if ((charCode >= 65 && charCode <= 90) || (charCode >= 48 && charCode <= 57)) {
        const index = charCode % SCALE.length;
        playNote(SCALE[index]);
        spawnParticle(charCode);
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
      
      // Sustain while moving
      drone.gain.gain.setTargetAtTime(0.06, ctx.currentTime, 0.05);

      // Fade out when movement stops
      if ((drone as any)._timeout) clearTimeout((drone as any)._timeout);
      (drone as any)._timeout = setTimeout(() => {
        if (audioCtxRef.current) {
          drone.gain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.3);
        }
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
