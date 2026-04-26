// Grid Physics — Perspective tunnel grid with gravity, shockwaves, and bass pulse

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  life: number;
  speed: number;
}

export interface GridState {
  vanishingX: number;
  vanishingY: number;
  shockwaves: Shockwave[];
  bassEnergy: number;
  mouseX: number;
  mouseY: number;
  intensity: number;
}

export function createGridState(width: number, height: number): GridState {
  return {
    vanishingX: width * 0.5,
    vanishingY: height * 0.45,
    shockwaves: [],
    bassEnergy: 0,
    mouseX: width * 0.5,
    mouseY: height * 0.5,
    intensity: 0,
  };
}

export function emitShockwave(state: GridState) {
  state.shockwaves.push({
    x: state.vanishingX,
    y: state.vanishingY,
    radius: 0,
    life: 1.0,
    speed: 400,
  });
}

export function updateGrid(state: GridState, dt: number, width: number, height: number) {
  // Vanishing point follows mouse subtly
  const targetVX = width * 0.5 + (state.mouseX - width * 0.5) * 0.08;
  const targetVY = height * 0.45 + (state.mouseY - height * 0.5) * 0.08;
  state.vanishingX += (targetVX - state.vanishingX) * 0.05;
  state.vanishingY += (targetVY - state.vanishingY) * 0.05;

  // Update shockwaves
  for (const sw of state.shockwaves) {
    sw.radius += sw.speed * dt;
    sw.life -= dt * 0.8;
  }
  state.shockwaves = state.shockwaves.filter(sw => sw.life > 0);

  // Decay
  state.bassEnergy *= 0.92;
  state.intensity *= 0.95;
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  state: GridState,
  width: number,
  height: number
) {
  ctx.save();

  const vx = state.vanishingX;
  const vy = state.vanishingY;
  const gridAmplitude = 1 + state.bassEnergy * 0.15;

  // Draw radial lines from vanishing point to edges
  const numRadials = 32;
  for (let i = 0; i < numRadials; i++) {
    const angle = (i / numRadials) * Math.PI * 2;
    const endX = vx + Math.cos(angle) * width * 1.5 * gridAmplitude;
    const endY = vy + Math.sin(angle) * height * 1.5 * gridAmplitude;

    // Check if this line is near a shockwave
    let brightness = 0.06;
    for (const sw of state.shockwaves) {
      // Sample at midpoint of the line
      const midDist = Math.hypot((vx + endX) / 2 - sw.x, (vy + endY) / 2 - sw.y);
      if (Math.abs(midDist - sw.radius) < 60) {
        brightness = Math.max(brightness, 0.55 * sw.life);
      }
    }

    // Mouse gravity effect on brightness
    const midX = (vx + endX) / 2;
    const midY = (vy + endY) / 2;
    const mouseDist = Math.hypot(midX - state.mouseX, midY - state.mouseY);
    if (mouseDist < 200) {
      brightness = Math.max(brightness, 0.15 * (1 - mouseDist / 200));
    }

    ctx.strokeStyle = `rgba(0,229,255,${brightness})`;
    ctx.lineWidth = 0.5 + state.intensity * 1.5;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  // Draw concentric rings (perspective foreshortening)
  const numRings = 12;
  for (let i = 1; i <= numRings; i++) {
    const t = i / numRings;
    const radius = Math.pow(t, 1.8) * Math.max(width, height) * 0.8 * gridAmplitude;

    let brightness = 0.04 + t * 0.04;

    // Shockwave brightness on rings
    for (const sw of state.shockwaves) {
      if (Math.abs(radius - sw.radius) < 40) {
        brightness = Math.max(brightness, 0.5 * sw.life * (1 - Math.abs(radius - sw.radius) / 40));
      }
    }

    // Bass pulse: flash red briefly
    if (state.bassEnergy > 0.7) {
      ctx.strokeStyle = `rgba(255,45,85,${brightness * 0.5})`;
    } else {
      ctx.strokeStyle = `rgba(0,229,255,${brightness})`;
    }

    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(vx, vy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw shockwave rings
  for (const sw of state.shockwaves) {
    ctx.strokeStyle = `rgba(0,229,255,${0.3 * sw.life})`;
    ctx.lineWidth = 2 * sw.life;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
