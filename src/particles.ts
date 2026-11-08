import { mulberry32, W, TAU, easeOutCubic } from './engine';

export interface P {
  x: number; y: number; vx: number; vy: number;
  start: number; life: number; size: number; color: string;
  g?: number; shape?: 'dot' | 'spark' | 'shard';
  rot?: number; vrot?: number; w?: number; h?: number;
}

export function makeAmbient(
  count: number, seed: number,
  o: { yMin: number; yMax: number; speed: [number, number]; size: [number, number]; colors: string[]; rise?: boolean; g?: number }
): P[] {
  const r = mulberry32(seed);
  const ps: P[] = [];
  for (let i = 0; i < count; i++) {
    const sp = o.speed[0] + r() * (o.speed[1] - o.speed[0]);
    ps.push({
      x: r() * W,
      y: o.yMin + r() * (o.yMax - o.yMin),
      vx: (r() - 0.5) * sp * 0.6,
      vy: (o.rise ? -1 : 1) * sp,
      start: -r() * 18,
      life: 6 + r() * 9,
      size: o.size[0] + r() * (o.size[1] - o.size[0]),
      color: o.colors[Math.floor(r() * o.colors.length)],
      g: o.g ?? (o.rise ? -2 : 0.5),
      shape: 'dot',
    });
  }
  return ps;
}

export function makeBurst(
  count: number, cx: number, cy: number, start: number, seed: number,
  o: { speed: [number, number]; size: [number, number]; life: [number, number]; colors: string[]; g?: number; shape?: 'dot' | 'spark' | 'shard'; dir?: [number, number]; spread?: number }
): P[] {
  const r = mulberry32(seed);
  const ps: P[] = [];
  const base = o.dir ? Math.atan2(o.dir[1], o.dir[0]) : 0;
  const spread = o.spread ?? Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const ang = base + (r() - 0.5) * spread;
    const sp = o.speed[0] + r() * (o.speed[1] - o.speed[0]);
    ps.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      start,
      life: o.life[0] + r() * (o.life[1] - o.life[0]),
      size: o.size[0] + r() * (o.size[1] - o.size[0]),
      color: o.colors[Math.floor(r() * o.colors.length)],
      g: o.g ?? 300,
      shape: o.shape ?? 'dot',
      rot: r() * TAU,
      vrot: (r() - 0.5) * 12,
    });
  }
  return ps;
}

export function drawParticles(ctx: any, ps: P[], t: number, additive = true) {
  ctx.save();
  if (additive) ctx.globalCompositeOperation = 'lighter';
  for (const p of ps) {
    const age = t - p.start;
    if (age < 0 || age > p.life) continue;
    const k = age / p.life;
    const alpha = 1 - k;
    if (alpha <= 0) continue;
    const x = p.x + p.vx * age;
    const y = p.y + p.vy * age + 0.5 * (p.g ?? 0) * age * age;
    const s = Math.max(0.5, p.size * (1 - k * 0.7));
    ctx.globalAlpha = alpha;
    if (p.shape === 'spark') {
      const len = s * 4 * (1 - k * 0.5);
      const ang = Math.atan2(p.vy + (p.g ?? 0) * age, p.vx);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, s * 0.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
      ctx.stroke();
    } else if (p.shape === 'shard') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((p.rot ?? 0) + (p.vrot ?? 0) * age);
      ctx.fillStyle = p.color;
      ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawShockwave(
  ctx: any, cx: number, cy: number, start: number, dur: number, maxR: number, t: number,
  color = '#7fe9ff', width = 6
) {
  const age = t - start;
  if (age < 0 || age > dur) return;
  const k = age / dur;
  const r = maxR * easeOutCubic(k);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (1 - k) * 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, width * (1 - k));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = (1 - k) * 0.4;
  ctx.lineWidth = Math.max(1, width * 3 * (1 - k));
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.86, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

export function drawFlash(ctx: any, cx: number, cy: number, radius: number, color: string, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawGlow(ctx: any, x: number, y: number, radius: number, color: string, alpha: number) {
  drawFlash(ctx, x, y, radius, color, alpha);
}

export function drawTracer(
  ctx: any, x0: number, y0: number, x1: number, y1: number, start: number, dur: number, t: number,
  color = '#ffe08a', width = 5
) {
  const age = t - start;
  if (age < 0 || age > dur) return;
  const k = age / dur;
  const x = x0 + (x1 - x0) * k;
  const y = y0 + (y1 - y0) * k;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x0, y0, x, y);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.4, color);
  g.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.strokeStyle = g;
  ctx.lineWidth = width * (1 - k * 0.5);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

export function drawMuzzle(
  ctx: any, x: number, y: number, ang: number, start: number, dur: number, t: number,
  color = '#ffd166', scale = 1
) {
  const age = t - start;
  if (age < 0 || age > dur) return;
  const k = age / dur;
  const a = 1 - k;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';
  const r1 = 26 * scale * a;
  const r2 = 60 * scale * a;
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r1);
  ctx.lineTo(r2, 0);
  ctx.lineTo(0, r1);
  ctx.lineTo(-r2, 0);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 34 * scale * a);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 34 * scale * a, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawExplosion(
  ctx: any, cx: number, cy: number, start: number, dur: number, t: number, scale = 1, colors: string[] = ['#fff3c4', '#ffd166', '#ff9f43', '#ff5e3a']
) {
  const age = t - start;
  if (age < 0 || age > dur) return;
  const k = age / dur;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const r = (40 + 150 * easeOutCubic(k)) * scale;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.35, colors[1]);
  g.addColorStop(0.7, colors[2]);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = (1 - k) * 0.95;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = (1 - k) * 0.9;
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.32, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawBulletStreak(
  ctx: any, x: number, y: number, vx: number, vy: number, start: number, dur: number, t: number,
  color = '#ffe08a', len = 60
) {
  const age = t - start;
  if (age < 0 || age > dur) return;
  const k = age / dur;
  const x1 = x + vx * age;
  const y1 = y + vy * age;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const mag = Math.hypot(vx, vy) || 1;
  const nx = (vx / mag) * len;
  const ny = (vy / mag) * len;
  ctx.beginPath();
  ctx.moveTo(x1 - nx, y1 - ny);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}