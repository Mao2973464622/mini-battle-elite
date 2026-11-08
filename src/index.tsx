import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  W, H, FPS, DUR, TOTAL_FRAMES, TAU,
  mulberry32, clamp, lerp, smoothstep, easeOutCubic, easeInCubic,
  easeInOut, easeOutBack, easeOutElastic, easeOutQuint, easeInQuint,
  rgba, fmt, rr, poly,
} from './engine';
import {
  P, makeAmbient, makeBurst, drawParticles, drawShockwave, drawFlash,
  drawGlow, drawTracer, drawMuzzle, drawExplosion, drawBulletStreak,
} from './particles';
import { drawSoldier, drawTank, drawDrone } from './characters';

// ============================================================
// 全局常量
// ============================================================
const CX = W / 2;
const CY = H / 2;

// 调色板
const C = {
  bg0: '#04070c',
  bg1: '#081020',
  bg2: '#0e1c33',
  cyan: '#35f0ff',
  cyanSoft: '#7fe9ff',
  blue: '#2b6cff',
  magenta: '#ff3d81',
  orange: '#ff9f43',
  red: '#ff4d3d',
  yellow: '#ffd166',
  white: '#ffffff',
  green: '#7dff9a',
};

// ============================================================
// 工具
// ============================================================
function useShake(f: number, seed: number, amp: number, freq: number) {
  const r = mulberry32(seed);
  // 用确定性伪随机基于帧
  const n = Math.sin(f * freq * 0.13 + seed) + Math.sin(f * freq * 0.071 + seed * 2);
  const n2 = Math.cos(f * freq * 0.17 + seed * 3) + Math.sin(f * freq * 0.11 + seed * 5);
  const k = amp;
  return { x: n * k, y: n2 * k, r: (n * 0.4) * k * 0.02 };
}

function drawBackground(ctx: any, t: number) {
  // 深空渐变
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.bg0);
  g.addColorStop(0.5, C.bg1);
  g.addColorStop(1, C.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 远处星点
  const r = mulberry32(1234);
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 160; i++) {
    const x = r() * W;
    const y = r() * H * 0.6;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.5 + i));
    ctx.globalAlpha = 0.25 * tw;
    ctx.fillStyle = i % 3 === 0 ? C.cyanSoft : '#cfe8ff';
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.restore();

  // 城市天际线（两层）
  drawCity(ctx, t, 0.72, '#0a1526', 0, 140);
  drawCity(ctx, t, 0.92, '#0d1b30', 60, 90);
}

function drawCity(ctx: any, t: number, yBase: number, color: string, seedOff: number, hMax: number) {
  const r = mulberry32(77 + seedOff);
  ctx.save();
  ctx.fillStyle = color;
  let x = -40;
  while (x < W + 40) {
    const bw = 40 + r() * 90;
    const bh = 20 + r() * hMax;
    ctx.fillRect(x, yBase - bh, bw, bh + 40);
    // 窗点
    ctx.fillStyle = 'rgba(120,180,255,0.18)';
    for (let wy = yBase - bh + 8; wy < yBase - 6; wy += 14) {
      for (let wx = x + 6; wx < x + bw - 6; wx += 16) {
        if (r() > 0.72) ctx.fillRect(wx, wy, 3, 5);
      }
    }
    ctx.fillStyle = color;
    x += bw + 10;
  }
  ctx.restore();
}

function drawGridFloor(ctx: any, t: number, alpha = 0.5) {
  // 透视地面网格
  const horizon = CY + 130;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(53,240,255,0.35)';
  ctx.lineWidth = 1.2;
  // 横线
  for (let i = 0; i < 26; i++) {
    const p = i / 26;
    const y = horizon + Math.pow(p, 2.2) * (H - horizon + 80);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // 纵线（消失点）
  const vpx = CX + Math.sin(t * 0.02) * 40;
  const vpy = horizon;
  for (let i = -16; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(vpx + i * 60, vpy);
    ctx.lineTo(vpx + i * 260, H + 80);
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================
// 文字
// ============================================================
function drawTextGlow(
  ctx: any, text: string, x: number, y: number, size: number,
  color: string, glowColor: string, blur: number, weight = 900, align: CanvasTextAlign = 'center',
  font = 'sans-serif', alpha = 1, letterSpacing = 0
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  if (letterSpacing) {
    // 手动字距
    const chars = text.split('');
    let total = 0;
    for (const ch of chars) total += ctx.measureText(ch).width + letterSpacing;
    let sx = x - total / 2;
    for (const ch of chars) {
      ctx.fillText(ch, sx + ctx.measureText(ch).width / 2, y);
      sx += ctx.measureText(ch).width + letterSpacing;
    }
  } else {
    ctx.fillText(text, x, y);
  }
  // 双层辉光
  ctx.shadowBlur = blur * 2.4;
  ctx.globalAlpha = alpha * 0.4;
  ctx.fillStyle = glowColor;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawSubtitle(ctx: any, zh: string, en: string, t: number, local: number, dur: number) {
  const a = smoothstep(0, 0.15, local) * (1 - smoothstep(dur - 0.3, dur, local));
  if (a <= 0) return;
  const yy = H - 96;
  ctx.save();
  // 中文
  drawTextGlow(ctx, zh, CX, yy, 40, '#ffffff', 'rgba(0,200,255,0.8)', 12, 700, 'center', 'sans-serif', a * 0.95, 2);
  // 英文
  drawTextGlow(ctx, en, CX, yy + 44, 22, C.cyanSoft, 'rgba(0,200,255,0.5)', 8, 500, 'center', 'sans-serif', a * 0.8, 1);
  ctx.restore();
}

// ============================================================
// 主组件
// ============================================================
const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps; // 秒

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', width, height }}>
      <FilmCanvas frame={frame} t={t} />
    </AbsoluteFill>
  );
};

const FilmCanvas: React.FC<{ frame: number; t: number }> = ({ frame, t }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFilm(ctx, frame, t);
  }, [frame, t]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
    />
  );
};

// ============================================================
// 场景编排
// ============================================================
function drawFilm(ctx: any, frame: number, t: number) {
  const sec = t;
  // 相机震动基础
  const shake = { x: 0, y: 0, r: 0 };
  const addShake = (amp: number, freq: number, seed: number) => {
    const s = useShake(frame, seed, amp, freq);
    shake.x += s.x; shake.y += s.y; shake.r += s.r;
  };

  ctx.save();
  // 全局黑场
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // ---------------- 场景定义 ----------------
  // S1 片头 0 - 2.2s
  // S2 世界观 2.2 - 5.5
  // S3 空降 5.5 - 9
  // S4 战斗 9 - 16
  // S5 高潮 16 - 23
  // S6 胜利 23 - 28
  // S7 结尾 28 - 32
  const scenes: { start: number; end: number; fn: (c: any, lt: number, fr: number) => void }[] = [
    { start: 0, end: 2.2, fn: (c: any, lt: number) => sceneIntro(c, lt, frame) },
    { start: 2.2, end: 5.5, fn: (c: any, lt: number) => sceneWorld(c, lt, frame, addShake) },
    { start: 5.5, end: 9.0, fn: (c: any, lt: number) => sceneDrop(c, lt, frame, addShake) },
    { start: 9.0, end: 16.0, fn: (c: any, lt: number) => sceneBattle(c, lt, frame, addShake) },
    { start: 16.0, end: 23.0, fn: (c: any, lt: number) => sceneClimax(c, lt, frame, addShake) },
    { start: 23.0, end: 28.0, fn: (c: any, lt: number) => sceneVictory(c, lt, frame, addShake) },
    { start: 28.0, end: 32.0, fn: (c: any, lt: number) => sceneEnd(c, lt, frame) },
  ];

  // 找当前场景
  let cur = scenes.find((s) => t >= s.start && t < s.end);
  if (!cur) cur = scenes[scenes.length - 1];
  const local = t - cur.start;
  const dur = cur.end - cur.start;

  // 转场闪光在场景边界
  const transition = (edge: number) => {
    const d = Math.abs(t - edge);
    if (d < 0.35) {
      return 1 - smoothstep(0, 0.35, d);
    }
    return 0;
  };

  cur.fn(ctx, local, frame);

  // 场景间白色闪切
  const flash = Math.max(
    transition(2.2), transition(5.5), transition(9.0),
    transition(16.0), transition(23.0), transition(28.0)
  );
  if (flash > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(190,240,255,${flash * 0.55})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 电影黑边（letterbox 内嵌 2.39:1 已有，再加轻微上下暗角）
  ctx.save();
  const lg = ctx.createLinearGradient(0, 0, 0, 90);
  lg.addColorStop(0, 'rgba(0,0,0,0.55)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, 90);
  const lg2 = ctx.createLinearGradient(0, H, 0, H - 90);
  lg2.addColorStop(0, 'rgba(0,0,0,0.55)');
  lg2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg2;
  ctx.fillRect(0, H - 90, W, 90);
  ctx.restore();

  // 胶片颗粒
  ctx.save();
  const r = mulberry32(frame % 1000 + 7);
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 60; i++) {
    ctx.fillRect(r() * W, r() * H, 1, 1);
  }
  ctx.restore();

  ctx.restore();
}

// ============================================================
// 场景1：片头
// ============================================================
function sceneIntro(ctx: any, lt: number, frame: number) {
  const a = smoothstep(0, 0.6, lt);
  const out = smoothstep(1.6, 2.2, lt);
  const alpha = a * (1 - out);
  if (alpha <= 0) return;
  drawBackground(ctx, frame / FPS);
  // 光柱
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(CX - 300, 0, CX + 300, 0);
  g.addColorStop(0, 'rgba(53,240,255,0)');
  g.addColorStop(0.5, 'rgba(53,240,255,0.25)');
  g.addColorStop(1, 'rgba(53,240,255,0)');
  ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(lt * 3));
  ctx.fillStyle = g;
  ctx.fillRect(CX - 300, 0, 600, H);
  ctx.restore();

  // 大标题弹入
  const pop = easeOutBack(clamp(lt / 0.9, 0, 1));
  const scale = 0.6 + 0.4 * pop;
  ctx.save();
  ctx.translate(CX, CY - 60);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  drawTextGlow(ctx, '迷你枪战精英', 0, 0, 130, '#ffffff', C.cyan, 40, 900, 'center', 'sans-serif', 1, 6);
  ctx.restore();

  // 副标题
  const subA = smoothstep(0.7, 1.2, lt) * (1 - out);
  drawTextGlow(ctx, 'MINI BATTLE ELITE', CX, CY + 60, 46, C.cyanSoft, C.cyan, 20, 300, 'center', 'sans-serif', subA, 8);
  drawTextGlow(ctx, '—— 电影版 · CINEMATIC ——', CX, CY + 120, 24, '#cfe8ff', 'rgba(0,150,255,0.6)', 10, 400, 'center', 'sans-serif', subA * 0.9, 2);

  // 扫光条
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const sx = (lt * 2.2) % 1.6 - 0.3;
  const sg = ctx.createLinearGradient(CX - 500 + sx * 500, 0, CX - 500 + sx * 500 + 200, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)');
  sg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = sg;
  ctx.fillRect(0, CY - 110, W, 220);
  ctx.restore();

  // 底部提示
  drawTextGlow(ctx, '点击开始 · PRESS START', CX, H - 140, 22, '#9fd8ff', 'rgba(0,150,255,0.5)', 8, 500, 'center', 'sans-serif', alpha * (0.5 + 0.5 * Math.sin(lt * 4)));
}

// ============================================================
// 场景2：世界观
// ============================================================
function sceneWorld(ctx: any, lt: number, frame: number, addShake: any) {
  drawBackground(ctx, frame / FPS);
  drawGridFloor(ctx, frame / FPS, 0.35);
  const t = frame / FPS;
  // 缓慢横移镜头
  ctx.save();
  ctx.translate(Math.sin(t * 0.1) * 20, 0);

  // 两侧哨塔
  ctx.fillStyle = '#0d1b30';
  rr(ctx, 60, H - 300, 40, 260, 6); ctx.fill();
  rr(ctx, W - 100, H - 300, 40, 260, 6); ctx.fill();
  ctx.fillStyle = '#12233c';
  rr(ctx, 40, H - 340, 80, 50, 8); ctx.fill();
  rr(ctx, W - 120, H - 340, 80, 50, 8); ctx.fill();

  // 探照灯
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const la = 0.15 + 0.1 * Math.sin(t * 2);
  const lg = ctx.createLinearGradient(120, H - 320, 600, H - 600);
  lg.addColorStop(0, `rgba(255,220,120,${la})`);
  lg.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(100, H - 330);
  ctx.lineTo(700, H - 640);
  ctx.lineTo(760, H - 560);
  ctx.closePath();
  ctx.fill();
  const lg2 = ctx.createLinearGradient(W - 100, H - 320, W - 560, H - 600);
  lg2.addColorStop(0, `rgba(120,220,255,${la})`);
  lg2.addColorStop(1, 'rgba(120,220,255,0)');
  ctx.fillStyle = lg2;
  ctx.beginPath();
  ctx.moveTo(W - 80, H - 330);
  ctx.lineTo(W - 680, H - 640);
  ctx.lineTo(W - 740, H - 560);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 中央大标牌
  const pop = easeOutBack(clamp(lt / 0.8, 0, 1));
  ctx.save();
  ctx.translate(CX, CY - 40);
  ctx.scale(pop, pop);
  ctx.fillStyle = 'rgba(10,25,45,0.8)';
  rr(ctx, -320, -90, 640, 180, 18); ctx.fill();
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 3;
  ctx.shadowColor = C.cyan; ctx.shadowBlur = 22;
  rr(ctx, -320, -90, 640, 180, 18); ctx.stroke();
  ctx.shadowBlur = 0;
  drawTextGlow(ctx, 'MINI BATTLE', 0, -20, 78, '#ffffff', C.cyan, 26, 900);
  drawTextGlow(ctx, '迷你枪战精英 · 世界', 0, 50, 30, C.cyanSoft, C.cyan, 12, 600);
  ctx.restore();

  // 浮动无人机
  const droneY = H - 280 + Math.sin(t * 3) * 14;
  drawDrone(ctx, CX + 380, droneY, 1.2, { t, hover: 10 });
  drawDrone(ctx, CX - 380, droneY - 60, 1.0, { t: t + 0.7, hover: 8 });

  // 环境粒子
  const ambient = makeAmbient(60, 42, { yMin: 0, yMax: H, speed: [40, 120], size: [1, 2.5], colors: ['#35f0ff', '#7fe9ff', '#cfe8ff'], rise: true });
  drawParticles(ctx, ambient, t);

  // 字幕
  drawSubtitle(ctx, '欢迎来到迷你战场', 'Welcome to the Mini Battlefield', t, lt, 3.3);
}

// ============================================================
// 场景3：空降
// ============================================================
function sceneDrop(ctx: any, lt: number, frame: number, addShake: any) {
  const t = frame / FPS;
  drawBackground(ctx, t);
  drawGridFloor(ctx, t, 0.4);
  // 高空俯冲镜头感
  const drop = easeInOut(clamp(lt / 3.5, 0, 1));
  const zoom = 1 + drop * 0.5;
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(zoom, zoom);
  ctx.translate(-CX, -CY);

  // 云层
  ctx.save();
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 12; i++) {
    const yy = (i * 90 + lt * 400) % H;
    ctx.fillStyle = i % 2 ? '#3a5a86' : '#24405f';
    ctx.beginPath();
    ctx.ellipse((i * 170 + lt * 120) % W, yy, 200 + i * 10, 40, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 空降士兵（降落伞）
  for (let i = 0; i < 4; i++) {
    const px = CX - 320 + i * 210 + Math.sin(t * 2 + i) * 20;
    const py = 120 + i * 120 + drop * 520 + Math.sin(t * 4 + i) * 6;
    if (py > H - 120) continue;
    // 降落伞
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = `rgba(53,240,255,${0.7 - drop * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, 44, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,230,255,0.6)';
    ctx.lineWidth = 1.5;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 16, 0);
      ctx.lineTo(0, 70);
      ctx.stroke();
    }
    drawSoldier(ctx, 0, 70, 0.9, { t, pose: 'idle', accent: C.cyan });
    ctx.restore();
  }
  ctx.restore();

  // 地面爆炸（着陆冲击波）
  const land = smoothstep(2.6, 3.0, lt);
  if (land > 0) {
    drawShockwave(ctx, CX, H - 120, 2.6, 1.2, 500, t, C.cyan, 8);
    drawFlash(ctx, CX, H - 120, 300 * land, 'rgba(120,240,255,0.9)', land * 0.8);
    addShake(6 * land, 2.4, 91);
  }

  // 粒子
  const ambient = makeAmbient(80, 7, { yMin: 0, yMax: H, speed: [60, 200], size: [1, 3], colors: ['#35f0ff', '#7fe9ff', '#ffd166'], rise: false });
  drawParticles(ctx, ambient, t);

  drawSubtitle(ctx, '空降行动 · 开始突袭', 'Drop Operation · Commencing', t, lt, 3.4);
}

// ============================================================
// 场景4：战斗
// ============================================================
function sceneBattle(ctx: any, lt: number, frame: number, addShake: any) {
  const t = frame / FPS;
  drawBackground(ctx, t);
  drawGridFloor(ctx, t, 0.5);

  // 掩体
  ctx.fillStyle = '#12202f';
  rr(ctx, 200, H - 160, 180, 120, 12); ctx.fill();
  rr(ctx, W - 360, H - 180, 200, 140, 12); ctx.fill();
  rr(ctx, CX - 120, H - 200, 240, 160, 12); ctx.fill();

  // 敌方坦克
  drawTank(ctx, W - 280, H - 120, 1.0, { t, fire: firePulse(t, 0.5, 0.6) });

  // 敌人无人机
  drawDrone(ctx, 420, 240 + Math.sin(t * 3) * 10, 1.1, { t });

  // 我方士兵（冲锋）
  const x1 = lerp(120, 420, easeInOut(clamp(lt / 3.5, 0, 1)));
  drawSoldier(ctx, x1, H - 110, 1.5, { t, pose: 'run', accent: C.cyan, fire: firePulse(t, 0.4, 0.7) });
  const x2 = lerp(180, 540, easeInOut(clamp((lt - 0.4) / 3.5, 0, 1)));
  drawSoldier(ctx, x2, H - 105, 1.3, { t: t + 0.3, pose: 'run', accent: C.cyan, fire: firePulse(t, 0.3, 0.8) });

  // 弹道 & 枪口
  const shots = [
    { fx: x1 + 30, fy: H - 120, tx: W - 260, ty: H - 150, st: 0.4, dur: 0.35, col: '#ffe08a' },
    { fx: x2 + 26, fy: H - 118, tx: W - 260, ty: H - 150, st: 0.8, dur: 0.4, col: '#9ff5ff' },
    { fx: x1 + 30, fy: H - 122, tx: W - 250, ty: H - 130, st: 1.4, dur: 0.3, col: '#ffe08a' },
    { fx: x2 + 26, fy: H - 120, tx: W - 250, ty: H - 130, st: 2.0, dur: 0.35, col: '#9ff5ff' },
    { fx: x1 + 30, fy: H - 118, tx: W - 240, ty: H - 160, st: 2.7, dur: 0.3, col: '#ffd166' },
  ];
  for (const s of shots) {
    if (lt >= s.st && lt < s.st + s.dur) {
      drawTracer(ctx, s.fx, s.fy, s.tx, s.ty, s.st, s.dur, lt, s.col, 6);
    }
    // 枪口闪光
    if (Math.abs(lt - s.st) < 0.08) {
      drawMuzzle(ctx, s.fx, s.fy, 0.05, s.st - 0.02, 0.12, lt, s.col, 1.1);
    }
  }

  // 敌方开火
  const ef = firePulse(t, 0.9, 0.5);
  if (ef > 0.6) {
    drawMuzzle(ctx, W - 160, H - 132, Math.PI, t - 0.4, 0.12, t, '#ff5e3a', 1.2);
    drawTracer(ctx, W - 160, H - 132, 640, H - 120, t - 0.4, 0.4, t, '#ff8a5e', 5);
    addShake(3 * ef, 3, 55);
  }

  // 命中爆炸
  const hits = [{ st: 1.9, x: W - 240, y: H - 150, s: 1.0 }, { st: 3.0, x: W - 220, y: H - 140, s: 1.3 }];
  for (const h of hits) {
    if (lt >= h.st) {
      drawExplosion(ctx, h.x, h.y, h.st, 1.0, lt, h.s);
      drawShockwave(ctx, h.x, h.y, h.st, 0.9, 260 * h.s, lt, '#ffd166', 6);
      if (Math.abs(lt - h.st) < 0.15) addShake(9 * h.s, 3, 33 + h.x);
    }
  }

  // 弹壳飞溅
  const shellP = makeBurst(20, 300, H - 130, 0.5, 12, { speed: [200, 500], size: [3, 6], life: [0.5, 1], colors: ['#ffd166', '#ff9f43'], g: 900, shape: 'shard' });
  drawParticles(ctx, shellP, t);

  // 火花
  const sparkP = makeBurst(26, W - 240, H - 145, 1.9, 9, { speed: [150, 500], size: [2, 5], life: [0.3, 0.8], colors: ['#ffd166', '#fff3c4', '#ff5e3a'], g: 300, shape: 'spark' });
  drawParticles(ctx, sparkP, t);

  drawSubtitle(ctx, '迷你军团 · 火力全开', 'Mini Legion · Full Firepower', t, lt, 3.5);
}

function firePulse(t: number, phase: number, duty: number) {
  const m = ((t * 14 + phase * 7) % 1);
  return m < duty ? 1 : 0;
}

// ============================================================
// 场景5：高潮
// ============================================================
function sceneClimax(ctx: any, lt: number, frame: number, addShake: any) {
  const t = frame / FPS;
  drawBackground(ctx, t);
  drawGridFloor(ctx, t, 0.55);

  // 大范围战场剪影
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 7; i++) {
    drawSoldier(ctx, 100 + i * 260, H - 90 + Math.sin(i) * 10, 0.9, { t, pose: 'idle', accent: i % 2 ? C.cyan : C.orange, flip: i % 2 ? 1 : -1 });
  }
  ctx.restore();

  // 中央主角（慢动作前推）
  const push = easeInOut(clamp(lt / 3, 0, 1));
  const zoom = 1 + push * 0.4;
  ctx.save();
  ctx.translate(CX, CY + 120);
  ctx.scale(zoom, zoom);
  ctx.translate(-CX, -(CY + 120));
  drawSoldier(ctx, CX, H - 100, 2.2, { t, pose: 'aim', accent: C.cyan, fire: firePulse(t, 0.2, 0.6), glow: 24 });
  ctx.restore();

  // 主角前方大爆炸
  const boom = 1.2;
  if (lt >= 1.2) {
    drawExplosion(ctx, CX + 200, H - 180, 1.2, 1.4, lt, 1.8);
    drawShockwave(ctx, CX + 200, H - 180, 1.2, 1.2, 700, lt, C.orange, 10);
    if (lt < 2.0) addShake(12, 3.5, 77);
  }
  if (lt >= 2.6) {
    drawExplosion(ctx, CX - 260, H - 160, 2.6, 1.4, lt, 1.4);
    drawShockwave(ctx, CX - 260, H - 160, 2.6, 1.2, 550, lt, C.red, 9);
    if (lt < 3.4) addShake(10, 3.2, 78);
  }

  // 火花雨
  const burst = makeBurst(120, CX + 200, H - 180, 1.2, 5, { speed: [300, 900], size: [2, 6], life: [0.4, 1.2], colors: ['#fff3c4', '#ffd166', '#ff9f43', '#ff5e3a'], g: 500, shape: 'spark' });
  drawParticles(ctx, burst, t);

  // 弹道密集
  for (let i = 0; i < 6; i++) {
    const st = 0.5 + i * 0.4;
    if (lt >= st && lt < st + 0.3) {
      drawTracer(ctx, CX, H - 160, CX - 500 + i * 150, H - 300 + i * 40, st, 0.3, lt, i % 2 ? C.cyanSoft : '#ffe08a', 5);
    }
  }

  // 慢动作时间感：画面轻微缩放脉动
  const pulse = 1 + Math.sin(t * 20) * 0.004;
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(pulse, pulse); ctx.translate(-CX, -CY);

  drawSubtitle(ctx, '最终决战 · 突破防线', 'Final Showdown · Break the Line', t, lt, 3.4);

  // 中央大字提示
  const ta = smoothstep(0.5, 1.2, lt) * (1 - smoothstep(4.2, 4.8, lt));
  if (ta > 0) {
    drawTextGlow(ctx, '★ 极限火力 ★', CX, 150, 60, '#ffffff', C.orange, 30, 900, 'center', 'sans-serif', ta, 4);
  }
  ctx.restore();
}

// ============================================================
// 场景6：胜利
// ============================================================
function sceneVictory(ctx: any, lt: number, frame: number, addShake: any) {
  const t = frame / FPS;
  drawBackground(ctx, t);
  drawGridFloor(ctx, t, 0.4);

  // 庆祝烟花
  const fw = [
    { st: 0.3, x: 400, y: 300 }, { st: 0.9, x: 1500, y: 250 },
    { st: 1.6, x: 900, y: 350 }, { st: 2.4, x: 600, y: 220 },
    { st: 3.2, x: 1300, y: 380 },
  ];
  for (const f of fw) {
    if (lt >= f.st) {
      const parts = makeBurst(40, f.x, f.y, f.st, Math.round(f.st * 100), {
        speed: [150, 400], size: [2, 5], life: [0.6, 1.4],
        colors: ['#35f0ff', '#7fe9ff', '#ffd166', '#ff3d81', '#7dff9a'], g: 100, shape: 'dot',
      });
      drawParticles(ctx, parts, t);
      drawShockwave(ctx, f.x, f.y, f.st, 0.8, 200, t, C.cyanSoft, 4);
    }
  }

  // 主角胜利姿势
  const rise = easeOutBack(clamp(lt / 1.0, 0, 1));
  drawSoldier(ctx, CX, H - 90 - 40 * rise, 2.0, { t, pose: 'idle', accent: C.green, glow: 26 });
  // 举起枪
  ctx.save();
  ctx.translate(CX + 30, H - 130 - 40 * rise);
  ctx.rotate(-0.5 - rise * 0.4);
  ctx.fillStyle = '#0d1117';
  rr(ctx, -6, -4, 60, 8, 3); ctx.fill();
  ctx.restore();

  // 金色光柱
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(CX - 80, 0, CX + 80, 0);
  g.addColorStop(0, 'rgba(255,209,102,0)');
  g.addColorStop(0.5, `rgba(255,209,102,${0.3 + 0.15 * Math.sin(t * 3)})`);
  g.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = g;
  ctx.fillRect(CX - 80, 0, 160, H);
  ctx.restore();

  // 彩带
  const confetti = makeBurst(80, CX, H - 200, 0.2, 22, { speed: [80, 300], size: [3, 7], life: [1.2, 3], colors: ['#35f0ff', '#ffd166', '#ff3d81', '#7dff9a', '#7fe9ff'], g: 200, shape: 'shard' });
  drawParticles(ctx, confetti, t);

  drawSubtitle(ctx, '任务完成 · 迷你军团获胜', 'Mission Complete · Victory', t, lt, 3.4);

  const ta = smoothstep(0.8, 1.6, lt) * (1 - smoothstep(3.6, 4.4, lt));
  if (ta > 0) {
    drawTextGlow(ctx, 'VICTORY', CX, 160, 90, '#fff3c4', '#ffd166', 36, 900);
    drawTextGlow(ctx, '胜利', CX, 240, 44, '#ffffff', '#ffd166', 16, 700);
  }
}

// ============================================================
// 场景7：结尾
// ============================================================
function sceneEnd(ctx: any, lt: number, frame: number) {
  const t = frame / FPS;
  drawBackground(ctx, t);
  // 暗化
  ctx.save();
  ctx.fillStyle = 'rgba(2,4,8,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const a = smoothstep(0, 0.8, lt);

  // Logo 标志
  const pop = easeOutBack(clamp(lt / 1.1, 0, 1));
  ctx.save();
  ctx.translate(CX, CY - 120);
  ctx.scale(pop, pop);
  ctx.globalAlpha = a;
  // 徽章
  ctx.save();
  ctx.shadowColor = C.cyan; ctx.shadowBlur = 40;
  ctx.strokeStyle = C.cyan; ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU - Math.PI / 2;
    const rr2 = 70;
    const x = Math.cos(ang) * rr2, y = Math.sin(ang) * rr2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(10,30,50,0.8)';
  ctx.fill();
  ctx.restore();
  // 星
  drawTextGlow(ctx, '★', 0, -6, 70, '#ffd166', '#ffd166', 24, 700);
  ctx.restore();

  // 标题
  const ta = smoothstep(1.0, 1.8, lt);
  drawTextGlow(ctx, '迷你枪战精英', CX, CY + 60, 70, '#ffffff', C.cyan, 30, 900, 'center', 'sans-serif', a * ta, 4);
  drawTextGlow(ctx, 'MINI BATTLE ELITE', CX, CY + 120, 30, C.cyanSoft, C.cyan, 14, 400, 'center', 'sans-serif', a * ta, 3);

  // 制作信息
  const infA = smoothstep(1.6, 2.4, lt) * (1 - smoothstep(3.2, 3.8, lt));
  if (infA > 0) {
    drawTextGlow(ctx, '出品 · Operit Studio', CX, H - 180, 24, '#9fd8ff', 'rgba(0,150,255,0.5)', 8, 500, 'center', 'sans-serif', infA, 1);
    drawTextGlow(ctx, 'A Film by Operit · Powered by Remotion', CX, H - 140, 18, '#6f9fbf', 'rgba(0,150,255,0.3)', 6, 400, 'center', 'sans-serif', infA, 1);
  }

  // 结尾双语
  drawSubtitle(ctx, '感谢观看 · 期待下次战斗', 'Thanks for Watching · See You in Battle', t, lt, 3.9);
}

// ============================================================
// 注册导出
// ============================================================
export { Main as MiniBattle };
