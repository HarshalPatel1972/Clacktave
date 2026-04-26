// Particle Pool — Zero-allocation particle system
// Pre-allocates 3000 particle objects. Reuses them. Never allocates in the render loop.

export type ParticleType = 'ambient' | 'spark' | 'echo';

export interface PoolParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  type: ParticleType;
  active: boolean;
  char?: string; // For echo particles (letter dissolution)
}

const POOL_SIZE = 3000;

export class ParticlePool {
  pool: PoolParticle[];
  private nextIndex: number = 0;

  constructor() {
    this.pool = Array.from({ length: POOL_SIZE }, () => ({
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1, size: 1, hue: 190,
      type: 'ambient' as ParticleType,
      active: false,
    }));
  }

  acquire(
    x: number, y: number,
    vx: number, vy: number,
    size: number, maxLife: number,
    type: ParticleType,
    hue: number = 190,
    char?: string
  ): PoolParticle | null {
    // Search from nextIndex forward for an inactive particle
    for (let i = 0; i < POOL_SIZE; i++) {
      const idx = (this.nextIndex + i) % POOL_SIZE;
      const p = this.pool[idx];
      if (!p.active) {
        p.x = x; p.y = y;
        p.vx = vx; p.vy = vy;
        p.size = size;
        p.life = 1.0;
        p.maxLife = maxLife;
        p.type = type;
        p.hue = hue;
        p.active = true;
        p.char = char;
        this.nextIndex = (idx + 1) % POOL_SIZE;
        return p;
      }
    }
    return null; // Pool exhausted — skip this particle
  }

  releaseAll() {
    for (const p of this.pool) p.active = false;
  }

  getActive(): PoolParticle[] {
    return this.pool.filter(p => p.active);
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.type === 'spark') {
        p.vx *= 0.94;
        p.vy *= 0.94;
      } else if (p.type === 'echo') {
        p.vy -= 30 * dt; // float upward
        p.vx *= 0.98;
      } else {
        // ambient: gentle swirl
        p.vx += (Math.random() - 0.5) * 2 * dt;
        p.vy += (Math.random() - 0.5) * 2 * dt;
        p.vx *= 0.99;
        p.vy *= 0.99;
      }

      p.life -= dt / p.maxLife;
      if (p.life <= 0) p.active = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.pool) {
      if (!p.active) continue;

      if (p.type === 'echo' && p.char) {
        // Letter dissolution
        ctx.save();
        ctx.globalAlpha = p.life * 0.6;
        ctx.font = `${8 + p.size * 4}px Syne, sans-serif`;
        ctx.fillStyle = `hsl(${p.hue}, 80%, 70%)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.char, p.x, p.y);
        ctx.restore();
      } else {
        ctx.globalAlpha = p.life * (p.type === 'ambient' ? 0.3 : 0.7);
        const r = p.size * p.life;

        if (p.type === 'spark' && p.life > 0.7) {
          // Hot core glow
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `hsl(${p.hue}, 90%, ${p.type === 'spark' ? 75 : 50}%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Spawn a burst of spark particles from a point
  emitSparks(x: number, y: number, count: number, speed: number = 350, hue: number = 190) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.7 + 0.3) * speed;
      this.acquire(
        x, y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        Math.random() * 2 + 0.5,
        0.6 + Math.random() * 0.4,
        'spark',
        hue
      );
    }
  }

  // Spawn echo particles from a word's letters
  emitEcho(x: number, y: number, word: string) {
    for (const char of word) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 60;
      this.acquire(
        x + (Math.random() - 0.5) * 100,
        y + (Math.random() - 0.5) * 20,
        Math.cos(angle) * spd,
        -Math.abs(Math.sin(angle) * spd), // drift upward
        Math.random() * 1.5 + 0.5,
        1.2,
        'echo',
        190,
        char
      );
    }
  }

  // Spawn ambient particles spread across the screen
  initAmbient(width: number, height: number, count: number = 800) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 5 + Math.random() * 15;
      this.acquire(
        Math.random() * width,
        Math.random() * height,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        0.5,
        10 + Math.random() * 20, // very long life
        'ambient',
        190 + Math.random() * 20
      );
    }
  }
}
