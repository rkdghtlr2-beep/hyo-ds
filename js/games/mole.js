// 두더지 콩콩: 8개 구멍에서 튀어나오는 두더지를 제한시간 안에 최대한 많이 터치
import { drawSprite, pixelEllipse, PAL } from '../sprites.js';

const W = 180;
const H = 320;
const TIME_LIMIT = 30;     // 제한시간(초)
const SCALE = 2;           // 두더지를 2배로 크게
const MOLE_W = 16 * SCALE;
const MOLE_H = 14 * SCALE;
const RISE = MOLE_H - 2;   // 최대로 올라오는 높이
const POP = 0.12;          // 올라오고 내려가는 데 걸리는 시간
const GOLD = { N: '#ffcd75', Y: '#f4f4f4', P: '#ef7d57' };

// 구멍 8개: 3개 - 2개 - 3개 배치
const HOLES = [
  [30, 130], [90, 130], [150, 130],
  [60, 196], [120, 196],
  [30, 262], [90, 262], [150, 262],
].map(([x, y]) => ({ x, y }));

export function createMole(canvas, { onScore, onGameOver }) {
  const ctx = canvas.getContext('2d');
  let s, raf, last;

  function reset() {
    s = { time: 0, score: 0, combo: 0, spawn: 0.5, moles: [], fx: [], hammer: null, over: false };
  }

  // 시간이 지날수록 빨라짐
  const level = () => Math.min(s.time / TIME_LIMIT, 1);

  function spawnMole() {
    const busy = new Set(s.moles.map((m) => m.hole));
    const free = HOLES.map((_, i) => i).filter((i) => !busy.has(i));
    if (!free.length) return;
    const hole = free[(Math.random() * free.length) | 0];
    const gold = Math.random() < 0.1;
    s.moles.push({ hole, age: 0, stay: (1.1 - level() * 0.55) * (gold ? 0.7 : 1), gold, hit: false });
  }

  // 지금 올라와 있는 높이 (0 ~ RISE)
  function riseOf(m) {
    const end = m.stay + POP;
    if (m.age < POP) return (m.age / POP) * RISE;
    if (m.age < end) return RISE;
    return Math.max(0, (1 - (m.age - end) / POP) * RISE);
  }

  function onDown(e) {
    if (s.over) return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    s.hammer = { x, y, t: 0.12 };

    for (const m of s.moles) {
      if (m.hit) continue;
      const h = HOLES[m.hole];
      const rise = riseOf(m);
      if (rise < 8) continue;
      // 손가락 크기를 고려해 넉넉하게 판정
      if (Math.abs(x - h.x) < 24 && y > h.y - rise - 8 && y < h.y + 10) {
        m.hit = true;
        m.age = Math.max(m.age, POP);
        m.stay = m.age - POP + 0.25; // 잠깐 기절했다가 내려감
        s.combo++;
        const gain = (m.gold ? 30 : 10) + Math.min(s.combo - 1, 5) * 2;
        s.score += gain;
        onScore(s.score);
        s.fx.push({ type: 'text', x: h.x, y: h.y - rise - 6, text: '+' + gain, t: 0.6, gold: m.gold });
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6;
          s.fx.push({ type: 'star', x: h.x, y: h.y - rise / 2, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, t: 0.35 });
        }
        return;
      }
    }
    s.combo = 0; // 헛손질하면 연속 보너스 끊김
  }

  function update(dt) {
    s.time += dt;
    if (s.time >= TIME_LIMIT) return finish();

    s.spawn -= dt;
    if (s.spawn <= 0) {
      s.spawn = 0.8 - level() * 0.45 + Math.random() * 0.25;
      spawnMole();
      if (level() > 0.5 && Math.random() < 0.35) spawnMole(); // 후반엔 두 마리씩
    }

    for (const m of s.moles) {
      m.age += dt;
      if (!m.hit && m.age > m.stay + POP * 2) { m.done = true; s.combo = 0; }
      if (m.hit && m.age > m.stay + POP * 2) m.done = true;
    }
    s.moles = s.moles.filter((m) => !m.done);

    for (const f of s.fx) {
      f.t -= dt;
      if (f.type === 'star') { f.x += f.vx * dt; f.y += f.vy * dt; }
      else f.y -= 20 * dt;
    }
    s.fx = s.fx.filter((f) => f.t > 0);
    if (s.hammer && (s.hammer.t -= dt) <= 0) s.hammer = null;
  }

  function drawField() {
    // 하늘
    ctx.fillStyle = PAL.B; ctx.fillRect(0, 0, W, 70);
    ctx.fillStyle = PAL.W;
    ctx.fillRect(20, 30, 24, 6); ctx.fillRect(26, 26, 12, 4);
    ctx.fillRect(120, 40, 30, 6); ctx.fillRect(128, 36, 14, 4);
    // 언덕과 잔디
    ctx.fillStyle = PAL.E; ctx.fillRect(0, 70, W, H - 70);
    ctx.fillStyle = PAL.G; ctx.fillRect(0, 70, W, 3);
    ctx.fillStyle = '#257179';
    for (let y = 84; y < H; y += 14) for (let x = (y / 14) % 2 ? 4 : 11; x < W; x += 16) { ctx.fillRect(x, y, 1, 2); ctx.fillRect(x + 2, y, 1, 2); }
  }

  function drawTimer() {
    const left = Math.max(0, TIME_LIMIT - s.time);
    const ratio = left / TIME_LIMIT;
    ctx.fillStyle = PAL.K; ctx.fillRect(10, 8, W - 20, 10);
    ctx.fillStyle = left < 5 ? PAL.R : PAL.Y;
    ctx.fillRect(12, 10, Math.round((W - 24) * ratio), 6);
    ctx.fillStyle = PAL.W;
    ctx.font = '10px Galmuri9, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(left) + '초', W / 2, 32);
  }

  function draw() {
    drawField();
    drawTimer();

    for (let i = 0; i < HOLES.length; i++) {
      const h = HOLES[i];
      pixelEllipse(ctx, h.x, h.y, 22, 7, PAL.K);
      pixelEllipse(ctx, h.x, h.y + 1, 19, 5, '#1b1424');

      const m = s.moles.find((mm) => mm.hole === i);
      if (m) {
        const rise = riseOf(m);
        ctx.save();
        ctx.beginPath(); ctx.rect(h.x - 30, h.y - 60, 60, 60 + 2); ctx.clip();
        drawSprite(ctx, m.hit ? 'moleHit' : 'mole', h.x - MOLE_W / 2, h.y + 2 - rise, SCALE, m.gold ? GOLD : null);
        ctx.restore();
      }
      // 구멍 앞쪽 흙
      pixelEllipse(ctx, h.x, h.y + 1, 22, 7, PAL.N, 'bottom');
      ctx.fillStyle = '#5c3a28'; ctx.fillRect(h.x - 18, h.y + 6, 36, 2);
    }

    ctx.textAlign = 'center';
    for (const f of s.fx) {
      if (f.type === 'star') { ctx.fillStyle = PAL.Y; ctx.fillRect(f.x | 0, f.y | 0, 2, 2); }
      else {
        ctx.font = '12px Galmuri11, monospace';
        ctx.fillStyle = PAL.K; ctx.fillText(f.text, f.x + 1, f.y + 1);
        ctx.fillStyle = f.gold ? PAL.Y : PAL.W; ctx.fillText(f.text, f.x, f.y);
      }
    }
    if (s.combo >= 3) {
      ctx.font = '10px Galmuri9, monospace';
      ctx.fillStyle = PAL.O;
      ctx.fillText(s.combo + '연속!', W / 2, 50);
    }
    if (s.hammer) drawSprite(ctx, 'hammer', s.hammer.x - 6, s.hammer.y - 12, 2);
  }

  function loop(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    if (!s.over) update(dt);
    draw();
    if (!s.over) raf = requestAnimationFrame(loop);
  }

  function finish() {
    s.over = true;
    s.moles = [];
    onGameOver(s.score);
  }

  const bind = (on) => canvas[on ? 'addEventListener' : 'removeEventListener']('pointerdown', onDown);

  reset();
  draw();

  return {
    start() {
      reset();
      onScore(0);
      bind(false); bind(true);
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); bind(false); },
  };
}
