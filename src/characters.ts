import { rr, TAU } from './engine';

export interface SoldierOpts {
  flip?: number;
  t?: number;
  fire?: number; // 0..1 recoil
  pose?: 'idle' | 'run' | 'aim';
  accent?: string;
  armor?: string;
  trim?: string;
  visor?: string;
  glow?: number;
}

export function drawSoldier(ctx: any, x: number, y: number, s: number, o: SoldierOpts = {}) {
  const flip = o.flip ?? 1;
  const t = o.t ?? 0;
  const fire = o.fire ?? 0;
  const pose = o.pose ?? 'idle';
  const accent = o.accent ?? '#2ee6ff';
  const armor = o.armor ?? '#0c2536';
  const trim = o.trim ?? '#0a4a66';
  const visor = o.visor ?? '#9ff5ff';
  const glow = o.glow ?? 16;
  const bob = pose === 'run' ? Math.abs(Math.sin(t * 16)) * 4 : Math.sin(t * 3) * 1.5;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * flip, s);

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, bob, 24, 6, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.translate(0, -bob);

  ctx.strokeStyle = '#081018';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  const step = pose === 'run' ? Math.sin(t * 16) * 6 : 0;
  ctx.beginPath();
  ctx.moveTo(-2, -40);
  ctx.lineTo(-9 + step, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3, -40);
  ctx.lineTo(8 - step, 0);
  ctx.stroke();
  ctx.fillStyle = '#0a0f14';
  ctx.fillRect(-15 + step, -6, 14, 6);
  ctx.fillRect(2 - step, -6, 14, 6);

  ctx.fillStyle = trim;
  rr(ctx, -25, -66, 15, 26, 4);
  ctx.fill();

  ctx.fillStyle = armor;
  rr(ctx, -16, -70, 32, 34, 8);
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2;
  rr(ctx, -16, -70, 32, 34, 8);
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = glow;
  ctx.fillStyle = accent;
  rr(ctx, -4, -62, 8, 8, 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = trim;
  rr(ctx, -21, -73, 14, 12, 4);
  ctx.fill();

  ctx.strokeStyle = '#0a1520';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-8, -58);
  ctx.lineTo(-19, -40);
  ctx.stroke();

  const recoil = fire * 7;
  ctx.strokeStyle = armor;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(8, -58);
  ctx.lineTo(16 - recoil, 4 - recoil * 0.3);
  ctx.stroke();

  ctx.save();
  ctx.translate(14 - recoil, 2 - recoil * 0.3);
  ctx.fillStyle = '#0d1117';
  rr(ctx, -8, -5, 36, 9, 3);
  ctx.fill();
  ctx.fillStyle = '#1a2029';
  ctx.fillRect(24, -3, 18, 4);
  ctx.fillStyle = accent;
  ctx.fillRect(4, -2, 6, 3);
  ctx.restore();

  ctx.fillStyle = armor;
  ctx.beginPath();
  ctx.arc(2, -84, 17, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-15, -84, 34, 8);

  ctx.save();
  ctx.shadowColor = visor;
  ctx.shadowBlur = glow;
  ctx.fillStyle = visor;
  rr(ctx, 3, -82, 17, 8, 3);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

export function drawTank(ctx: any, x: number, y: number, s: number, o: { fire?: number; t?: number } = {}) {
  const t = o.t ?? 0;
  const recoil = o.fire ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#0a0d10';
  rr(ctx, -72, -14, 152, 28, 12);
  ctx.fill();
  ctx.fillStyle = '#141a20';
  for (let i = -60; i < 70; i += 12) {
    ctx.beginPath();
    ctx.arc(i, 0, 5, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#12202b';
  rr(ctx, -62, -42, 122, 30, 8);
  ctx.fill();
  ctx.strokeStyle = '#0a141c';
  ctx.lineWidth = 2;
  rr(ctx, -62, -42, 122, 30, 8);
  ctx.stroke();
  ctx.fillStyle = '#152733';
  rr(ctx, -12, -60, 54, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#0e1620';
  ctx.fillRect(28 - recoil * 10, -54, 82, 8);
  ctx.fillStyle = '#223140';
  ctx.fillRect(96 - recoil * 10, -56, 16, 12);
  ctx.save();
  ctx.shadowColor = '#ff4d3d';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ff4d3d';
  ctx.fillRect(6, -54, 12, 6);
  ctx.restore();
  ctx.restore();
}

export function drawDrone(ctx: any, x: number, y: number, s: number, o: { t?: number; hover?: number } = {}) {
  const t = o.t ?? 0;
  const hover = o.hover ?? 14;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 6) * hover * 0.3);
  ctx.scale(s, s);
  ctx.strokeStyle = '#0e1620';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-26, -10);
  ctx.lineTo(-6, -10);
  ctx.moveTo(6, -10);
  ctx.lineTo(26, -10);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,220,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(-16, -12, 14, 3, 0, 0, TAU);
  ctx.ellipse(16, -12, 14, 3, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#152733';
  rr(ctx, -14, -6, 28, 14, 6);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = '#ff4d3d';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ff4d3d';
  ctx.beginPath();
  ctx.arc(0, 1, 4, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}