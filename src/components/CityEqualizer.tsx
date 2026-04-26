"use client";

import React, { useEffect, useRef, useCallback } from 'react';

interface CityEqualizerProps {
  bassEnergy: number;
  velocity: number;
}

export default function CityEqualizer({ bassEnergy, velocity }: CityEqualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const heightsRef = useRef<number[]>(new Array(12).fill(0));
  const windowsRef = useRef<boolean[][]>(new Array(12).fill(0).map(() => new Array(10).fill(false)));

  // Randomize windows occasionally
  useEffect(() => {
    const interval = setInterval(() => {
      windowsRef.current = windowsRef.current.map(building => 
        building.map(() => Math.random() > 0.7)
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const numBuildings = 12;
    const bWidth = canvas.width / numBuildings;
    const maxHeight = canvas.height * 0.8;

    for (let i = 0; i < numBuildings; i++) {
      // Target height based on bass + random jitter
      const jitter = Math.sin(Date.now() * 0.01 + i) * 10;
      const targetHeight = (bassEnergy * maxHeight * (0.5 + Math.random() * 0.5)) + (velocity * 2) + jitter;
      
      // Smooth interpolation
      heightsRef.current[i] += (targetHeight - heightsRef.current[i]) * 0.2;
      const h = Math.max(10, heightsRef.current[i]);
      const x = i * bWidth + 2;
      const w = bWidth - 4;
      const y = canvas.height - h;

      // Draw Reflection (Glow)
      const grad = ctx.createLinearGradient(x, canvas.height, x, canvas.height + 20);
      grad.addColorStop(0, `rgba(0, 229, 255, ${0.1 * bassEnergy})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(x, canvas.height, w, 20);

      // Draw Building Silhouette
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + bassEnergy * 0.2})`;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, w, h);

      // Draw Windows
      const winRows = Math.floor(h / 8);
      const winCols = 2;
      const winW = (w - 6) / winCols;
      const winH = 4;

      for (let r = 0; r < winRows; r++) {
        for (let c = 0; c < winCols; c++) {
          const winActive = windowsRef.current[i][(r + c) % 10];
          if (winActive) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + bassEnergy * 0.4})`;
            ctx.fillRect(x + 3 + c * (winW + 2), y + 4 + r * (winH + 4), winW, winH);
          }
        }
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [bassEnergy, velocity]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  return (
    <div className="w-full h-32 opacity-60">
      <canvas ref={canvasRef} width="240" height="128" className="w-full h-full" />
    </div>
  );
}
