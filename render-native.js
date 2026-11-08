const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { drawFilm } = require('./dist/film.cjs');

// Register fonts (CJK)
try {
  const collect = (d) => {
    let out = [];
    if (!fs.existsSync(d)) return out;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) out = out.concat(collect(p));
      else if (/\.(ttf|otf|ttc)$/i.test(e.name)) out.push(p);
    }
    return out;
  };
  for (const f of collect('/usr/share/fonts')) {
    try { GlobalFonts.registerFromPath(f, path.basename(f, path.extname(f))); } catch (e) {}
  }
  console.log('fonts:', GlobalFonts.families.map((f) => f.family).join(', '));
} catch (e) { console.log('font err', e.message); }

const W_OUT = 1912;
const H_OUT = 800;
const FPS_OUT = 120;
const TOTAL = FPS_OUT * 32;

const canvas = createCanvas(W_OUT, H_OUT);
const ctx = canvas.getContext('2d');
const frameBuffer = Buffer.alloc(W_OUT * H_OUT * 4);

const outPath = '/root/movie/mini_battle_elite.mp4';
const progressFile = '/root/movie/render_progress.txt';

const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'rawvideo',
  '-pix_fmt', 'rgba',
  '-s', `${W_OUT}x${H_OUT}`,
  '-r', String(FPS_OUT),
  '-i', '-',
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  outPath,
], { stdio: ['pipe', 'inherit', 'inherit'] });

let startTime = Date.now();

async function renderAll() {
  for (let f = 0; f < TOTAL; f++) {
    const t = f / FPS_OUT;
    ctx.clearRect(0, 0, W_OUT, H_OUT);
    drawFilm(ctx, f, t);
    const raw = ctx.getImageData(0, 0, W_OUT, H_OUT).data;
    frameBuffer.set(raw);
    const ok = ffmpeg.stdin.write(frameBuffer);
    if (!ok) {
      await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    }
    if (f % 240 === 0 || f === TOTAL - 1) {
      const pct = ((f + 1) / TOTAL * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (f + 1) / elapsed;
      const eta = ((TOTAL - f - 1) / rate / 60).toFixed(1);
      const msg = `frame ${f + 1}/${TOTAL} (${pct}%) rate=${rate.toFixed(1)}fps eta=${eta}min`;
      console.log(msg);
      fs.writeFileSync(progressFile, msg);
    }
  }
  ffmpeg.stdin.end();
  console.log('all frames done');
}

ffmpeg.on('error', (e) => { console.log('ffmpeg error', e.message); });
ffmpeg.on('close', (code) => {
  console.log('ffmpeg exited', code);
  const size = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
  console.log('output size:', (size / 1024 / 1024).toFixed(2), 'MB');
});

renderAll().catch((e) => {
  console.log('render err', e);
  try { ffmpeg.stdin.end(); } catch (e2) {}
});