"use client";

import React, { useEffect, useRef, useCallback } from 'react';

interface KeyPos {
  x: number;
  y: number;
  lastPress: number;
  frequency: number;
}

const KEY_MAP: Record<string, { r: number; c: number }> = {
  'KeyQ': { r: 0, c: 0 }, 'KeyW': { r: 0, c: 1 }, 'KeyE': { r: 0, c: 2 }, 'KeyR': { r: 0, c: 3 }, 'KeyT': { r: 0, c: 4 }, 'KeyY': { r: 0, c: 5 }, 'KeyU': { r: 0, c: 6 }, 'KeyI': { r: 0, c: 7 }, 'KeyO': { r: 0, c: 8 }, 'KeyP': { r: 0, c: 9 },
  'KeyA': { r: 1, c: 0.2 }, 'KeyS': { r: 1, c: 1.2 }, 'KeyD': { r: 1, c: 2.2 }, 'KeyF': { r: 1, c: 3.2 }, 'KeyG': { r: 1, c: 4.2 }, 'KeyH': { r: 1, c: 5.2 }, 'KeyJ': { r: 1, c: 6.2 }, 'KeyK': { r: 1, c: 7.2 }, 'KeyL': { r: 1, c: 8.2 },
  'KeyZ': { r: 2, c: 0.5 }, 'KeyX': { r: 2, c: 1.5 }, 'KeyC': { r: 2, c: 2.5 }, 'KeyV': { r: 2, c: 3.5 }, 'KeyB': { r: 2, c: 4.5 }, 'KeyN': { r: 2, c: 5.5 }, 'KeyM': { r: 2, c: 6.5 }
};

interface KeystrokeConstelProps {
  lastEvent?: { code: string; timestamp: number } | null;
}

export default function KeystrokeConstel({ lastEvent }: KeystrokeConstelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, KeyPos>>({});
  const historyRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const requestRef = useRef<number>(0);

  // Initialize key positions
  useEffect(() => {
    const keyWidth = 10;
    const keyHeight = 8;
    const padding = 2;
    
    Object.keys(KEY_MAP).forEach(code => {
      const { r, c } = KEY_MAP[code];
      keysRef.current[code] = {
        x: c * (keyWidth + padding),
        y: r * (keyHeight + padding),
        lastPress: 0,
        frequency: 0
      };
    });
  }, []);

  // Handle incoming keystroke
  useEffect(() => {
    if (lastEvent && keysRef.current[lastEvent.code]) {
      const k = keysRef.current[lastEvent.code];
      k.lastPress = lastEvent.timestamp;
      k.frequency = Math.min(1.0, k.frequency + 0.1);
      
      // Add to constellation history
      historyRef.current.push({ x: k.x + 5, y: k.y + 4, time: lastEvent.timestamp });
      if (historyRef.current.length > 10) historyRef.current.shift();
    }
  }, [lastEvent]);

  const animate = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = Date.now();

    // Draw Heatmap Layer (cumulative frequency)
    Object.values(keysRef.current).forEach(k => {
      k.frequency *= 0.995; // Decay heatmap
      if (k.frequency > 0.01) {
        ctx.fillStyle = `rgba(255, 45, 85, ${k.frequency * 0.4})`;
        ctx.fillRect(k.x, k.y, 10, 8);
      }
    });

    // Draw Keyboard Grid
    ctx.lineWidth = 0.5;
    Object.keys(keysRef.current).forEach(code => {
      const k = keysRef.current[code];
      const timeSincePress = now - k.lastPress;
      const flash = Math.max(0, 1 - timeSincePress / 400);

      ctx.strokeStyle = flash > 0 
        ? `rgba(0, 229, 255, ${0.1 + flash * 0.6})`
        : 'rgba(255, 255, 255, 0.08)';
      
      ctx.fillStyle = flash > 0 
        ? `rgba(0, 229, 255, ${flash * 0.7})`
        : 'rgba(255, 255, 255, 0.03)';

      ctx.beginPath();
      // Round rect polyfill/manual
      ctx.rect(k.x, k.y, 10, 8);
      ctx.fill();
      ctx.stroke();
    });

    // Draw Constellation (Lines between recent key-dots)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.lineWidth = 0.5;
    
    historyRef.current.forEach((pt, i) => {
      const age = now - pt.time;
      if (age > 4000) return;
      const opacity = 1 - age / 4000;
      
      // Draw Dot
      ctx.fillStyle = `rgba(0, 229, 255, ${opacity})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1, 0, Math.PI * 2);
      ctx.fill();

      // Draw Line to previous
      if (i > 0) {
        const prev = historyRef.current[i - 1];
        if (now - prev.time < 4000) {
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
        }
      }
    });

    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  return (
    <div className="fixed top-8 right-8 z-[500] pointer-events-none">
      <canvas 
        ref={canvasRef} 
        width="140" 
        height="40" 
        className="opacity-80"
        style={{ width: '220px', height: '80px' }}
      />
    </div>
  );
}
