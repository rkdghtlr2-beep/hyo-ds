// 두더지 콩콩: 8개 구멍에서 튀어나오는 두더지를 30초 동안 뿅망치로 때리기
//  0~7초   : 한 마리씩 정상 속도
//  7~15초  : 한 마리씩 1.5배 빠르게
//  15~20초 : 두 마리씩
//  20~25초 : 세 마리씩
//  25~30초 : 피버 타임 (모든 구멍에 기절한 두더지, 때릴 때마다 점수)
import { drawSprite, pixelEllipse, PAL } from '../sprites.js';
import { sfx, buzz, unlockSound } from '../sfx.js';

const W = 180;
const H = 320;
const TIME_LIMIT = 30;
const FAST = 7;            // 1.5배 빨라지기 시작
const STAGE2 = 15;         // 두 마리씩 시작
const STAGE3 = 20;         // 세 마리씩 시작
const FEVER = 25;          // 피버 타임 시작
const SCALE = 2;           // 두더지를 2배로 크게
const MOLE_W = 16 * SCALE;
const MOLE_H = 14 * SCALE;
const RISE = MOLE_H - 2;   // 최대로 올라오는 높이
const POP = 0.12;          // 올라오고 내려가는 데 걸리는 시간 (정상 속도)
const SPEED = 1.5;         // 7초 이후 빨라지는 배수
const SQUASH = 0.14;       // 맞았을 때 찌그러지는 시간
const GOLD = { N: '#ffcd75', Y: '#f4f4f4', P: '#ef7d57' };
const POP_WORDS = ['뿅!', '콩!', '뿅!', '퐁!'];

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
    s = {
      time: 0, score: 0, combo: 0, spawn: 0.4,
      moles: [], fx: [], hammers: [],
      shake: 0, shakeMag: 0, freeze: 0,
      fever: false, banner: null, over: false,
    };
  }

  // ---------- 두더지 출현 ----------
  function spawnMole(stay, pop) {
    const busy = new Set(s.moles.map((m) => m.hole));
    const free = HOLES.map((_, i) => i).filter((i) => !busy.has(i));
    if (!free.length) return;
    const hole = free[(Math.random() * free.length) | 0];
    const gold = Math.random() < 0.1;
    s.moles.push({ hole, age: 0, pop, stay: stay * (gold ? 0.75 : 1), gold, hit: false, squash: 0 });
  }

  function startFever() {
    s.fever = true;
    // 황금 두더지 0~2마리를 무작위 구멍에
    const goldCount = (Math.random() * 3) | 0;
    const order = HOLES.map((_, i) => i).sort(() => Math.random() - 0.5);
    const golds = new Set(order.slice(0, goldCount));
    s.moles = HOLES.map((_, i) => ({ hole: i, age: 0, pop: POP, stay: Infinity, gold: golds.has(i), fever: true, squash: 0 }));
    s.shake = 0.7; s.shakeMag = 5;
    s.banner = { text: '피버타임!', t: Infinity, big: true }; // 피버 동안 계속 표시
    sfx.fever();
    buzz([90, 40, 90, 40, 90]);
  }

  // 지금 올라와 있는 높이 (0 ~ RISE)
  function riseOf(m) {
    const end = m.stay + m.pop;
    if (m.age < m.pop) return (m.age / m.pop) * RISE;
    if (m.age < end) return RISE;
    return Math.max(0, (1 - (m.age - end) / m.pop) * RISE);
  }

  // ---------- 때리기 ----------
  function onDown(e) {
    if (s.over) return;
    unlockSound();
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;

    // 손가락 위치에서 가장 가까운 두더지 찾기 (손가락 크기를 고려해 넉넉하게)
    let target = null, best = Infinity;
    for (const m of s.moles) {
      if (m.hit) continue;
      const h = HOLES[m.hole];
      const rise = riseOf(m);
      if (rise < 8) continue;
      if (Math.abs(x - h.x) < 24 && y > h.y - rise - 10 && y < h.y + 12) {
        const d = Math.abs(x - h.x) + Math.abs(y - (h.y - rise / 2));
        if (d < best) { best = d; target = m; }
      }
    }

    if (!target) {
      s.hammers.push({ x, y, t: 0, hit: false });
      s.fx.push({ type: 'dust', x, y: y + 4, t: 0.25 });
      sfx.miss();
      if (!s.fever) s.combo = 0; // 헛손질하면 연속 보너스 끊김
      // 헛손질하면 10점 감점 (0점 아래로는 내려가지 않음)
      const loss = Math.min(10, s.score);
      if (loss > 0) {
        s.score -= loss;
        onScore(s.score);
      }
      s.fx.push({ type: 'text', x, y: y - 10, text: '-10', t: 0.6, miss: true });
      return;
    }

    const h = HOLES[target.hole];
    const rise = riseOf(target);
    const headY = h.y + 2 - rise + 6;
    s.hammers.push({ x: h.x, y: headY, t: 0, hit: true });

    let gain;
    if (target.fever) {
      gain = target.gold ? 30 : 10;
    } else {
      target.hit = true;
      target.age = Math.max(target.age, target.pop);
      target.stay = target.age - target.pop + 0.28; // 잠깐 기절했다가 내려감
      s.combo++;
      gain = (target.gold ? 30 : 10) + Math.min(s.combo - 1, 5) * 2;
    }
    target.squash = SQUASH;
    s.score += gain;
    onScore(s.score);

    // 타격 효과: 멈칫 + 화면 흔들림 + 충격 원 + 별 + 뿅! 글자 + 점수
    s.freeze = target.fever ? 0.02 : 0.045;
    if (s.shake < 0.1) { s.shake = 0.1; s.shakeMag = target.gold ? 3 : 2; }
    s.fx.push({ type: 'ring', x: h.x, y: headY, t: 0.2, gold: target.gold });
    s.fx.push({ type: 'word', x: h.x + (Math.random() < 0.5 ? -20 : 20), y: headY - 2, text: POP_WORDS[(Math.random() * POP_WORDS.length) | 0], t: 0.35 });
    s.fx.push({ type: 'text', x: h.x, y: headY - 20, text: '+' + gain, t: 0.6, gold: target.gold });
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.3;
      const v = 60 + Math.random() * 40;
      s.fx.push({ type: 'star', x: h.x, y: headY, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0.4, gold: target.gold });
    }
    sfx.pyong(target.gold);
    buzz(target.gold ? 25 : 12);
  }

  // ---------- 진행 ----------
  function update(dt) {
    // 남은 시간은 항상 그대로 흘러감
    s.time += dt;
    if (s.time >= TIME_LIMIT) return finish();

    // 맞는 순간 두더지와 효과만 아주 잠깐 멈춰서 손맛을 줌
    if (s.freeze > 0) { s.freeze -= dt; return; }

    if (!s.fever && s.time >= FEVER) startFever();
    if (!s.fever) {
      s.spawn -= dt;
      if (s.spawn <= 0) {
        if (s.time < FAST) {
          // 0~7초: 한 마리씩, 정상 속도
          s.spawn = 0.8 + Math.random() * 0.25;
          spawnMole(1.1, POP);
        } else if (s.time < STAGE2) {
          // 7~15초: 한 마리씩, 1.5배 빠르게
          s.spawn = (0.8 + Math.random() * 0.25) / SPEED;
          spawnMole(1.1 / SPEED, POP / SPEED);
        } else {
          // 15~20초: 두 마리씩, 20~25초: 세 마리씩
          const count = s.time < STAGE3 ? 2 : 3;
          s.spawn = 0.8 + Math.random() * 0.2;
          for (let i = 0; i < count; i++) spawnMole(0.75, POP / SPEED);
        }
      }
    }

    for (const m of s.moles) {
      m.age += dt;
      if (m.squash > 0) m.squash -= dt;
      if (m.age > m.stay + m.pop * 2) {
        m.done = true;
        if (!m.hit) s.combo = 0; // 놓치면 연속 보너스 끊김
      }
    }
    s.moles = s.moles.filter((m) => !m.done);

    for (const f of s.fx) {
      f.t -= dt;
      if (f.type === 'star') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; }
      else if (f.type === 'text') f.y -= 24 * dt;
    }
    s.fx = s.fx.filter((f) => f.t > 0);

    for (const hm of s.hammers) hm.t += dt;
    s.hammers = s.hammers.filter((hm) => hm.t < 0.2);

    if (s.shake > 0) s.shake -= dt;
    if (s.banner && (s.banner.t -= dt) <= 0) s.banner = null;
  }

  // ---------- 그리기 ----------
  function drawField() {
    // 흔들릴 때 가장자리가 비지 않도록 조금 넓게 칠함
    ctx.fillStyle = s.fever ? '#ffcd75' : PAL.B; ctx.fillRect(-8, -8, W + 16, 78);
    ctx.fillStyle = PAL.W;
    ctx.fillRect(20, 30, 24, 6); ctx.fillRect(26, 26, 12, 4);
    ctx.fillRect(120, 40, 30, 6); ctx.fillRect(128, 36, 14, 4);
    ctx.fillStyle = PAL.E; ctx.fillRect(-8, 70, W + 16, H - 62);
    ctx.fillStyle = PAL.G; ctx.fillRect(-8, 70, W + 16, 3);
    ctx.fillStyle = '#257179';
    for (let y = 84; y < H; y += 14) for (let x = (y / 14) % 2 ? 4 : 11; x < W; x += 16) { ctx.fillRect(x, y, 1, 2); ctx.fillRect(x + 2, y, 1, 2); }
  }

  function drawTimer() {
    const left = Math.max(0, TIME_LIMIT - s.time);
    ctx.fillStyle = PAL.K; ctx.fillRect(10, 8, W - 20, 10);
    let color = left < 10 ? PAL.O : PAL.Y;
    if (s.fever) color = Math.floor(s.time * 10) % 2 ? PAL.P : PAL.R;
    ctx.fillStyle = color;
    ctx.fillRect(12, 10, Math.round((W - 24) * (left / TIME_LIMIT)), 6);
    ctx.fillStyle = s.fever ? PAL.R : PAL.W;
    ctx.font = '10px Galmuri9, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(left) + '초', W / 2, 32);
  }

  function drawMole(m, h) {
    const rise = riseOf(m);
    const top = h.y + 2 - rise;
    ctx.save();
    ctx.beginPath(); ctx.rect(h.x - 30, h.y - 60, 60, 62); ctx.clip();
    // 맞으면 납작하게 찌그러졌다가 돌아옴
    if (m.squash > 0) {
      const k = m.squash / SQUASH;
      const bottom = top + MOLE_H;
      ctx.translate(h.x, bottom);
      ctx.scale(1 + 0.3 * k, 1 - 0.38 * k);
      ctx.translate(-h.x, -bottom);
    }
    const dazed = m.hit || m.fever;
    drawSprite(ctx, dazed ? 'moleHit' : 'mole', h.x - MOLE_W / 2, top, SCALE, m.gold ? GOLD : null);
    ctx.restore();

    // 기절한 두더지 머리 위에 빙글빙글 별
    if (m.fever && rise > RISE - 2) {
      for (let k = 0; k < 3; k++) {
        const a = s.time * 6 + (k * Math.PI * 2) / 3;
        ctx.fillStyle = k === 0 ? PAL.W : PAL.Y;
        ctx.fillRect(Math.round(h.x + Math.cos(a) * 11), Math.round(top - 3 + Math.sin(a) * 3), 2, 2);
      }
    }
  }

  // 뿅망치: 들어 올렸다가 내려찍고 다시 들림
  function drawHammer(hm) {
    let a;
    if (hm.t < 0.03) a = 1.0;
    else if (hm.t < 0.06) a = 0.5;
    else if (hm.t < 0.14) a = 0;
    else a = 0.35;
    const press = hm.t >= 0.06 && hm.t < 0.14 && hm.hit ? 2 : 0;
    ctx.save();
    ctx.translate(Math.round(hm.x), Math.round(hm.y + 21 + press));
    ctx.rotate(a);
    drawSprite(ctx, 'hammer', -15, -28, 2);
    ctx.restore();
  }

  function drawFx() {
    ctx.textAlign = 'center';
    for (const f of s.fx) {
      if (f.type === 'star') {
        ctx.fillStyle = f.gold ? PAL.W : (f.t > 0.2 ? PAL.Y : PAL.O);
        ctx.fillRect(f.x | 0, f.y | 0, 2, 2);
      } else if (f.type === 'ring') {
        // 도트로 그린 충격 원
        const r = 6 + (1 - f.t / 0.2) * 14;
        ctx.fillStyle = f.gold ? PAL.Y : PAL.W;
        for (let i = 0; i < 16; i++) {
          const a = (Math.PI * 2 * i) / 16;
          ctx.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r * 0.7), 2, 2);
        }
      } else if (f.type === 'dust') {
        const r = 3 + (1 - f.t / 0.25) * 8;
        ctx.fillStyle = '#c2a37a';
        ctx.fillRect(Math.round(f.x - r), Math.round(f.y), 3, 2);
        ctx.fillRect(Math.round(f.x + r - 3), Math.round(f.y), 3, 2);
        ctx.fillRect(Math.round(f.x - 1), Math.round(f.y - r / 2), 2, 2);
      } else if (f.type === 'word') {
        ctx.font = '14px Galmuri11, monospace';
        ctx.fillStyle = PAL.K; ctx.fillText(f.text, f.x + 1, f.y + 1);
        ctx.fillStyle = PAL.W; ctx.fillText(f.text, f.x, f.y);
      } else {
        ctx.font = '12px Galmuri11, monospace';
        ctx.fillStyle = PAL.K; ctx.fillText(f.text, f.x + 1, f.y + 1);
        ctx.fillStyle = f.miss ? '#ff4d4d' : f.gold ? PAL.Y : PAL.W; ctx.fillText(f.text, f.x, f.y);
      }
    }
  }

  function drawBanner() {
    const b = s.banner;
    if (!b) return;
    const top = 82, height = 22;          // 검은 테두리 포함한 띠 위치
    const mid = top + height / 2;         // 띠의 세로 가운데
    const flash = Math.floor(s.time * 6) % 2; // 피버 동안 깜빡깜빡
    ctx.fillStyle = PAL.K; ctx.fillRect(0, top, W, height);
    ctx.fillStyle = b.big ? (flash ? PAL.R : PAL.O) : PAL.D; ctx.fillRect(0, top + 2, W, height - 4);
    ctx.font = (b.big ? '16px' : '12px') + ' Galmuri11, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // 실제 글자 높이를 재서 띠의 정가운데에 오도록 맞춤
    const m = ctx.measureText(b.text);
    const base = Math.round(mid + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    ctx.fillStyle = PAL.K; ctx.fillText(b.text, W / 2 + 1, base + 1);
    ctx.fillStyle = PAL.Y; ctx.fillText(b.text, W / 2, base);
  }

  function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    // 화면 흔들림 (피버 중에는 계속 땅이 울림)
    let mag = s.shake > 0 ? s.shakeMag * Math.min(1, s.shake / 0.3 + 0.3) : 0;
    if (s.fever && !s.over) mag = Math.max(mag, 1);
    if (mag) ctx.translate(Math.round((Math.random() - 0.5) * 2 * mag), Math.round((Math.random() - 0.5) * 2 * mag));

    drawField();
    drawTimer();

    for (let i = 0; i < HOLES.length; i++) {
      const h = HOLES[i];
      pixelEllipse(ctx, h.x, h.y, 22, 7, PAL.K);
      pixelEllipse(ctx, h.x, h.y + 1, 19, 5, '#1b1424');
      const m = s.moles.find((mm) => mm.hole === i);
      if (m) drawMole(m, h);
      // 구멍 앞쪽 흙
      pixelEllipse(ctx, h.x, h.y + 1, 22, 7, PAL.N, 'bottom');
      ctx.fillStyle = '#5c3a28'; ctx.fillRect(h.x - 18, h.y + 6, 36, 2);
    }

    drawFx();
    for (const hm of s.hammers) drawHammer(hm);

    if (!s.fever && s.combo >= 3) {
      ctx.font = '10px Galmuri9, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = PAL.O;
      ctx.fillText(s.combo + '연속!', W / 2, 50);
    }
    if (s.fever) {
      ctx.font = '10px Galmuri9, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = Math.floor(s.time * 6) % 2 ? PAL.R : PAL.K;
      ctx.fillText('마구 때리세요!', W / 2, 50);
    }
    drawBanner();
    ctx.restore();
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
    s.hammers = [];
    s.banner = null;
    onGameOver(s.score);
  }

  const bind = (on) => canvas[on ? 'addEventListener' : 'removeEventListener']('pointerdown', onDown);

  reset();
  draw();

  return {
    start() {
      unlockSound();
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
