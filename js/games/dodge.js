// 별똥별 피하기: 하늘로 날아오르는 토끼를 화면 왼쪽·오른쪽을 눌러 움직여, 쏟아지는 별똥별을 피한다
//  - 땅에서 출발해 구름, 달, 행성을 지나 우주 끝까지 날아감 (배경이 점점 바뀜)
//  - 별똥별이 나오기 직전 화면 위쪽에 빨간 느낌표로 미리 알려 줌
//  - 아슬아슬하게 피하면 추가 점수
//  - 가끔 내려오는 떡을 5개 모으면 '벌크업!' → 근육 토끼가 되어 별똥별을 쳐냄 (쳐낸 별똥별도 점수)
import { drawSprite, pixelEllipse, PAL, SPRITES } from '../sprites.js';
import { sfx, buzz, unlockSound } from '../sfx.js';

const W = 180;
const H = 320;
const FEET = 262;        // 토끼 발끝 높이 (화면에 고정)
const SC = 2;            // 토끼 기본 배율
const RW = 12 * SC;      // 토끼 너비
const RH = 16 * SC;      // 토끼 높이
const MAX_V = 130;       // 토끼 최고 속도
const CAKES_NEED = 5;    // 벌크업에 필요한 떡 개수
const FEVER_TIME = 6;    // 벌크업 시간(초)
const BUFF_SC = 3;       // 근육 토끼 배율

// ---------- 토끼 그림 (조각을 조합해 표정을 바꿈) ----------
const EARS = [
  '..KK....KK..',
  '.KWPK..KPWK.',
  '.KWPK..KPWK.',
  '.KWPK..KPWK.',
  '..KWK..KWK..',
];
const TOP = '.KKWKKKKWKK.';
const EYES = {
  normal: ['KWWWWWWWWWWK', 'KWWKWWWWKWWK', 'KWWKWWWWKWWK'],
  blink: ['KWWWWWWWWWWK', 'KWWWWWWWWWWK', 'KWKKWWWWKKWK'],
  wow: ['KWKKWWWWKKWK', 'KWKKWWWWKKWK', 'KWKKWWWWKKWK'],   // 깜짝 놀란 눈
  happy: ['KWWWWWWWWWWK', 'KWWKWWWWKWWK', 'KWKWKWWKWKWK'], // 웃는 눈 ^^
  dead: ['KWKWKWWKWKWK', 'KWWKWWWWKWWK', 'KWKWKWWKWKWK'],  // X X 눈
};
const NOSE = 'KWPWWPPWWPWK';
const MOUTH = {
  normal: 'KWWWWKKWWWWK',
  wow: 'KWWWKRRKWWWK',
  happy: 'KWWWKRRKWWWK',
  dead: 'KWWWKKKKWWWK',
};
const BODY = ['.KWWWWWWWWK.', 'KSWWWWWWWWSK', 'KWKWWWWWWKWK', '.KWWWWWWWWK.', '..KKK..KKK..'];
const rabbit = (eyes, mouth = 'normal') => [...EARS, TOP, ...EYES[eyes], NOSE, MOUTH[mouth], ...BODY];
SPRITES.rabbit = rabbit('normal');
SPRITES.rabbitBlink = rabbit('blink');
SPRITES.rabbitWow = rabbit('wow', 'wow');
SPRITES.rabbitHappy = rabbit('happy', 'happy');
SPRITES.rabbitDead = rabbit('dead', 'dead');

// 근육 토끼 (양팔 알통 자세, 부릅뜬 눈, 이를 꽉 문 입)
SPRITES.rabbitBuff = [
  '.....KK....KK.....',
  '....KWPK..KPWK....',
  '....KWPK..KPWK....',
  '....KWPK..KPWK....',
  '.....KWK..KWK.....',
  '....KKWKKKKWKK....',
  '.KK.KWWWWWWWWK.KK.',
  'KWWKKWKKWWKKWKKWWK',
  'KWWKKWWKWWKWWKKWWK',
  'KWWKKPWWPPWWPKKWWK',
  'KWWKKWKWKWKWWKKWWK',
  'KWWWKKWWWWWWKKWWWK',
  'KWWWWKWWWWWWKWWWWK',
  '.KKWWWWWKKWWWWWKK.',
  '...KWWWWKKWWWWK...',
  '...KWWWWWWWWWWK...',
  '...KWWWKKKKWWWK...',
  '...KKKK....KKKK...',
];

// 찹쌀떡
SPRITES.cake = [
  '..KKKK..',
  '.KWWWWK.',
  'KWWWWPWK',
  'KWWWWWWK',
  'KSWWWWSK',
  '.KKKKKK.',
];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 소수 배율로 그릴 때 도트 사이 틈이 생기지 않게, 작은 캔버스에 그린 뒤 통째로 늘림
const spriteCanvas = document.createElement('canvas');
function drawSpriteScaled(ctx, name, x, y, w, h, swap) {
  const rows = SPRITES[name];
  spriteCanvas.width = rows[0].length;
  spriteCanvas.height = rows.length;
  const sc = spriteCanvas.getContext('2d');
  sc.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);
  drawSprite(sc, name, 0, 0, 1, swap);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteCanvas, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// ---------- 하늘 색 (고도에 따라 낮 하늘 → 노을 → 밤 → 우주 → 우주 끝) ----------
const SKY = [
  [0, '#4a8fe0', '#a8dcff'],
  [900, '#33408f', '#e08f9a'],
  [2000, '#0e1236', '#2b2b6a'],
  [3500, '#05040e', '#140b2c'],
  [5000, '#170026', '#46104e'],
];
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};
const mixRgb = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
function skyAt(alt) {
  let i = 0;
  while (i < SKY.length - 2 && alt > SKY[i + 1][0]) i++;
  const [a0, t0, b0] = SKY[i], [a1, t1, b1] = SKY[i + 1];
  const t = clamp((alt - a0) / (a1 - a0), 0, 1);
  return [mix(t0, t1, t), mix(b0, b1, t)];
}

// 별 (깊이에 따라 흐르는 빠르기가 다름)
const STARS = Array.from({ length: 50 }, () => ({ x: Math.floor(rand(0, W)), y: rand(0, H), d: rand(0.05, 0.35), ph: rand(0, 6), big: Math.random() < 0.2 }));

export function createDodge(canvas, { onScore, onGameOver }) {
  const ctx = canvas.getContext('2d');
  let s, raf, last;
  let keys = {};
  const presses = new Map(); // 누르고 있는 손가락: 번호 → -1(왼쪽) / 1(오른쪽)

  function reset() {
    s = {
      x: W / 2, vx: 0, dir: 0,
      time: 0, bonus: 0, score: 0,
      alt: 0, climb: 0,                 // 고도, 올라가는 빠르기
      meteors: [], warns: [], cakes: [], fx: [], bg: [], lines: [],
      spawn: 1.2, cakeT: 6, bgT: 0,
      state: 'play', deadT: 0,          // play | dead | over
      wow: 0, happy: 0, shake: 0,
      cakeCount: 0, fever: 0, grow: 0,
      cakesGot: 0, nears: 0, smashed: 0, bulks: 0,
      moonDone: false,
    };
  }

  // ---------- 조작: 화면 왼쪽 절반을 누르면 왼쪽, 오른쪽 절반은 오른쪽 ----------
  const sideOf = (e) => {
    const r = canvas.getBoundingClientRect();
    return e.clientX - r.left < r.width / 2 ? -1 : 1;
  };
  function onDown(e) {
    e.preventDefault();
    unlockSound();
    presses.delete(e.pointerId);
    presses.set(e.pointerId, sideOf(e)); // 가장 최근에 누른 쪽이 우선
    canvas.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) { if (presses.has(e.pointerId)) presses.set(e.pointerId, sideOf(e)); }
  function onUp(e) { presses.delete(e.pointerId); }
  function onKey(e) { keys[e.key] = e.type === 'keydown'; }

  function inputDir() {
    const k = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    if (k) return k;
    let d = 0;
    for (const v of presses.values()) d = v;
    return d;
  }

  // ---------- 효과 ----------
  function pop(x, y, text, color, big) { s.fx.push({ type: 'text', x, y, text, color, big, t: big ? 1.2 : 0.8 }); }
  function burst(x, y, n, speed, colors) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(speed * 0.4, speed);
      s.fx.push({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 200, t: rand(0.3, 0.6), color: colors[i % colors.length] });
    }
  }

  // 토끼 크기 (벌크업 중에는 커짐)
  const bodyBox = () => {
    if (s.fever > 0) {
      const w = 18 * (SC + (BUFF_SC - SC) * s.grow);
      return { x: s.x - w / 2 + 2, y: FEET - w + 2, w: w - 4, h: w - 2 };
    }
    return { x: s.x - 9, y: FEET - 21, w: 18, h: 21 }; // 귀는 빼고 머리부터 발까지
  };

  // ---------- 별똥별: 먼저 위쪽에 느낌표로 알려 준 뒤 떨어짐 ----------
  function spawnMeteor(lv) {
    const big = s.time > 15 && Math.random() < 0.12 + lv * 0.15;
    const size = big ? 3 : 2;
    const vy = rand(80, 110) + lv * 120;
    const vx = rand(-1, 1) * lv * 35;
    const y = -20;
    let x = rand(10, W - 10);
    // 가끔은 토끼 쪽을 노리고 떨어짐 (갈수록 자주)
    if (Math.random() < 0.2 + lv * 0.3) x = s.x + rand(-24, 24) - vx * ((FEET - 14 - y) / vy);
    x = clamp(x, 8, W - 8);
    s.warns.push({ t: 0.55 - lv * 0.2, m: { x, y, vx, vy, size, r: size * 3 } });
  }

  function startFever() {
    s.fever = FEVER_TIME;
    s.cakeCount = 0;
    s.bulks++;
    s.shake = 0.3;
    pop(W / 2, 120, '벌크업!', PAL.O, true);
    burst(s.x, FEET - 20, 18, 140, [PAL.Y, PAL.O, PAL.W]);
    sfx.fever();
    buzz([60, 40, 60]);
  }

  // ---------- 배경 소품 (구름, 달, 행성, 성운) ----------
  function spawnBg() {
    const a = s.alt;
    if (a < 1600 && Math.random() < 0.8) {
      s.bg.push({ kind: 'cloud', x: rand(-10, W + 10), y: -30, d: rand(0.6, 1.1), w: rand(16, 30) });
    }
    if (a > 900 && !s.moonDone) {
      s.moonDone = true;
      s.bg.push({ kind: 'moon', x: rand(40, W - 40), y: -50, d: 0.25 });
    }
    if (a > 1800 && Math.random() < 0.25) {
      const cols = ['#e07a5f', '#81b29a', '#f2cc8f', '#9d8df1', '#5fb8e0'];
      s.bg.push({ kind: 'planet', x: rand(10, W - 10), y: -40, d: rand(0.2, 0.4), r: Math.floor(rand(6, 14)), c: cols[Math.floor(rand(0, cols.length))], ring: Math.random() < 0.5 });
    }
    if (a > 3200 && Math.random() < 0.35) {
      s.bg.push({ kind: 'nebula', x: rand(0, W), y: -50, d: rand(0.15, 0.3), hue: Math.floor(rand(260, 340)) });
    }
  }

  function update(dt) {
    if (s.state === 'play') s.time += dt;
    s.shake = Math.max(0, s.shake - dt);
    s.wow = Math.max(0, s.wow - dt);
    s.happy = Math.max(0, s.happy - dt);
    const lv = Math.min(s.time / 60, 1); // 1분에 걸쳐 점점 어려워짐

    // 올라가기
    const target = s.state === 'play' ? 55 + lv * 85 + (s.fever > 0 ? 60 : 0) : 0;
    s.climb += (target - s.climb) * Math.min(1, dt * (s.state === 'play' ? 2 : 3));
    s.alt += s.climb * dt;
    const scroll = s.climb * dt;

    // 효과 움직이기
    for (const e of s.fx) {
      e.t -= dt;
      if (e.type === 'spark') { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += e.g * dt; }
      else if (e.type === 'text') e.y -= (e.big ? 10 : 20) * dt;
    }
    s.fx = s.fx.filter((e) => e.t > 0);

    // 배경 흘려보내기
    for (const st of STARS) { st.y += scroll * st.d; if (st.y > H) { st.y -= H; st.x = Math.floor(rand(0, W)); } }
    s.bgT -= dt;
    if (s.bgT <= 0) { s.bgT = rand(0.8, 1.6); spawnBg(); }
    for (const b of s.bg) b.y += scroll * b.d;
    s.bg = s.bg.filter((b) => b.y < H + 60);
    // 빨리 올라가는 느낌을 주는 바람 줄
    if (s.climb > 20 && Math.random() < dt * 8) s.lines.push({ x: Math.floor(rand(0, W)), y: -20, len: Math.floor(rand(8, 20)) });
    for (const l of s.lines) l.y += s.climb * 3 * dt;
    s.lines = s.lines.filter((l) => l.y < H);

    if (s.state === 'dead') {
      s.deadT += dt;
      if (s.deadT > 1.4) return finish();
    }

    if (s.state === 'play') {
      // 토끼 이동 (부드럽게 빨라지고 멈춤)
      s.dir = inputDir();
      const maxV = s.fever > 0 ? 160 : MAX_V;
      s.vx += (s.dir * maxV - s.vx) * Math.min(1, dt * 14);
      const half = s.fever > 0 ? 9 * (SC + (BUFF_SC - SC) * s.grow) : RW / 2;
      s.x = clamp(s.x + s.vx * dt, half + 2, W - half - 2);

      // 벌크업 시간
      if (s.fever > 0) {
        s.fever -= dt;
        s.grow = Math.min(1, s.grow + dt / 0.3);
        if (s.fever < 0.3) s.grow = Math.max(0, s.fever / 0.3);
        if (s.fever <= 0) { s.fever = 0; s.grow = 0; }
      }

      // 별똥별 예고 → 떨어짐 (벌크업 중에는 쳐낼 거리가 많게 더 자주)
      s.spawn -= dt;
      if (s.spawn <= 0) {
        s.spawn = (rand(0.55, 0.75) - lv * 0.4) * (s.fever > 0 ? 0.5 : 1);
        spawnMeteor(lv);
      }
      // 떡: 드물게 (벌크업 중에는 안 나옴)
      if (s.fever <= 0) {
        s.cakeT -= dt;
        if (s.cakeT <= 0) {
          s.cakeT = rand(7, 10);
          s.cakes.push({ x: rand(14, W - 14), y: -16, vy: 60, ph: rand(0, 6) });
        }
      }
    }

    for (const w of s.warns) { w.t -= dt; if (w.t <= 0) s.meteors.push(w.m); }
    s.warns = s.warns.filter((w) => w.t > 0);

    const box = bodyBox();
    const hits = (m) => {
      const cx = clamp(m.x, box.x, box.x + box.w), cy = clamp(m.y, box.y, box.y + box.h);
      return (m.x - cx) ** 2 + (m.y - cy) ** 2 < (m.r - 1) ** 2;
    };

    for (const m of s.meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.smashed) { m.vy += 300 * dt; m.spin += dt * 20; continue; }
      if (Math.random() < 0.6) s.fx.push({ type: 'spark', x: m.x + rand(-2, 2), y: m.y - m.r + rand(-2, 2), vx: -m.vx * 0.3, vy: -m.vy * 0.15, g: 0, t: 0.3, color: Math.random() < 0.5 ? PAL.Y : PAL.O });
      if (s.state !== 'play') continue;
      if (hits(m)) {
        if (s.fever > 0) { smash(m); continue; }
        die(m);
        continue;
      }
      // 아슬아슬하게 비켜 감
      if (s.fever <= 0 && !m.near && m.y > FEET - 14 && m.y < FEET && Math.abs(m.x - s.x) < 9 + m.r + 8) {
        m.near = true;
        s.nears++;
        s.bonus += 5;
        s.wow = 0.45;
        pop(s.x, FEET - 44, '아슬아슬! +5', PAL.B);
        sfx.whoosh();
      }
    }
    s.meteors = s.meteors.filter((m) => !m.gone && m.y < H + 30 && m.y > -200 && m.x > -60 && m.x < W + 60);

    // 떡 먹기
    for (const c of s.cakes) {
      c.y += c.vy * dt;
      if (s.state === 'play' && Math.abs(c.x - s.x) < 15 && c.y > FEET - 36 && c.y < FEET + 4) {
        c.got = true;
        s.cakesGot++;
        s.cakeCount++;
        s.bonus += 20;
        s.happy = 0.6;
        burst(c.x, c.y, 6, 60, [PAL.W, PAL.P, PAL.S]);
        sfx.carrot();
        if (s.cakeCount >= CAKES_NEED) startFever();
        else pop(c.x, FEET - 46, `떡 ${s.cakeCount}/${CAKES_NEED}`, PAL.P);
      }
    }
    s.cakes = s.cakes.filter((c) => !c.got && c.y < H + 20);

    if (s.state === 'play') {
      s.score = Math.floor(s.time * 10) + s.bonus;
      onScore(s.score);
    }
  }

  // 근육 토끼가 별똥별을 쳐냄
  function smash(m) {
    m.smashed = true;
    m.spin = 0;
    m.vx = (m.x >= s.x ? 1 : -1) * rand(160, 260);
    m.vy = -rand(220, 320);
    s.smashed++;
    const gain = m.size > 2 ? 30 : 20;
    s.bonus += gain;
    s.shake = Math.max(s.shake, 0.1);
    pop(m.x, m.y - 10, `퍽! +${gain}`, PAL.Y);
    burst(m.x, m.y, 8, 110, [PAL.Y, PAL.O, PAL.W]);
    sfx.punch();
  }

  function die(m) {
    s.state = 'dead';
    s.deadT = 0;
    s.shake = 0.4;
    m.gone = true;
    burst(s.x, FEET - 16, 16, 120, [PAL.Y, PAL.O, PAL.R, PAL.W]);
    sfx.ko();
    buzz(200);
  }

  function finish() {
    s.state = 'over';
    onGameOver(s.score, {
      detail: `버틴 시간 ${Math.floor(s.time)}초\n최고 고도 ${Math.floor(s.alt).toLocaleString('ko-KR')}m\n떡 ${s.cakesGot}개 · 벌크업 ${s.bulks}번\n쳐낸 별똥별 ${s.smashed}개\n아슬아슬 ${s.nears}번`,
    });
  }

  // ---------- 그리기 ----------
  function drawSky() {
    const [top, bottom] = skyAt(s.alt);
    const A = top.match(/\d+/g).map(Number), B = bottom.match(/\d+/g).map(Number);
    const n = 10, bh = Math.ceil(H / n);
    for (let i = 0; i < n; i++) { ctx.fillStyle = mixRgb(A, B, i / (n - 1)); ctx.fillRect(-6, i * bh - 6, W + 12, bh + 6); }

    // 별: 높이 올라갈수록 또렷해짐
    const starA = clamp((s.alt - 400) / 900, 0, 1);
    if (starA > 0) {
      ctx.globalAlpha = starA;
      for (const st of STARS) {
        const on = Math.sin(s.time * 3 + st.ph) > -0.3;
        ctx.fillStyle = on ? PAL.W : PAL.S;
        ctx.fillRect(st.x, Math.floor(st.y), 1, st.big && on ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }

    // 배경 소품
    for (const b of s.bg) {
      const y = Math.round(b.y);
      if (b.kind === 'cloud') {
        ctx.globalAlpha = clamp(1 - (s.alt - 900) / 800, 0, 0.9);
        pixelEllipse(ctx, Math.round(b.x), y, Math.round(b.w), 5, '#ffffff');
        pixelEllipse(ctx, Math.round(b.x - b.w * 0.35), y - 4, Math.round(b.w * 0.45), 5, '#ffffff');
        pixelEllipse(ctx, Math.round(b.x + b.w * 0.3), y - 3, Math.round(b.w * 0.4), 4, '#ffffff');
        ctx.globalAlpha = 1;
      } else if (b.kind === 'moon') {
        pixelEllipse(ctx, Math.round(b.x), y, 22, 22, '#fff3c4');
        pixelEllipse(ctx, Math.round(b.x - 8), y - 6, 5, 5, '#ecdca0');
        pixelEllipse(ctx, Math.round(b.x + 9), y + 7, 6, 4, '#ecdca0');
        pixelEllipse(ctx, Math.round(b.x + 6), y - 10, 3, 3, '#ecdca0');
      } else if (b.kind === 'planet') {
        if (b.ring) { ctx.fillStyle = '#d8c8a0'; ctx.fillRect(Math.round(b.x - b.r * 1.7), y, Math.round(b.r * 3.4), 2); }
        pixelEllipse(ctx, Math.round(b.x), y, b.r, b.r, b.c);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(Math.round(b.x), y - b.r + 2, b.r, b.r * 2 - 3);
        if (b.ring) { ctx.fillStyle = '#d8c8a0'; ctx.fillRect(Math.round(b.x - b.r * 1.7), y + 1, Math.round(b.r * 3.4), 1); }
      } else if (b.kind === 'nebula') {
        ctx.globalAlpha = 0.18;
        pixelEllipse(ctx, Math.round(b.x), y, 34, 14, `hsl(${b.hue},80%,60%)`);
        pixelEllipse(ctx, Math.round(b.x + 12), y - 6, 20, 10, `hsl(${(b.hue + 40) % 360},80%,65%)`);
        ctx.globalAlpha = 1;
      }
    }

    // 바람 줄
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const l of s.lines) ctx.fillRect(l.x, Math.round(l.y), 1, l.len);

    // 출발한 땅 (올라가면 아래로 멀어짐)
    const gy = Math.round(FEET + s.alt);
    if (gy < H) {
      ctx.fillStyle = PAL.E; ctx.fillRect(-6, gy, W + 12, H - gy + 6);
      ctx.fillStyle = PAL.G; ctx.fillRect(-6, gy, W + 12, 2);
      ctx.fillStyle = '#257179';
      for (let i = 0; i < W; i += 8) ctx.fillRect(i + ((i / 8) % 2) * 3, gy + 8, 2, 2);
    }
  }

  // 별똥별 예고: 떨어질 자리 위쪽에 빨간 느낌표가 깜빡임
  function drawWarns() {
    for (const w of s.warns) {
      if (Math.floor(w.t * 12) % 2) continue;
      const x = Math.round(w.m.x);
      ctx.fillStyle = PAL.K; ctx.fillRect(x - 3, 21, 7, 13);
      ctx.fillStyle = '#ff3b5c';
      ctx.fillRect(x - 2, 22, 5, 11);
      ctx.fillStyle = PAL.W;
      ctx.fillRect(x - 0, 23, 1, 6); ctx.fillRect(x, 31, 1, 1);
    }
  }

  function drawMeteor(m) {
    if (m.smashed) {
      // 쳐낸 별똥별은 빙글빙글 날아감
      ctx.save();
      ctx.translate(Math.round(m.x), Math.round(m.y));
      ctx.rotate(m.spin);
      drawSprite(ctx, 'meteor', -4 * m.size, -4 * m.size, m.size);
      ctx.restore();
      return;
    }
    const len = Math.hypot(m.vx, m.vy);
    const ux = m.vx / len, uy = m.vy / len;
    const tail = [PAL.Y, PAL.Y, PAL.O, PAL.O, PAL.R, PAL.R];
    tail.forEach((c, i) => {
      const d = (i + 1) * m.size * 2.2;
      const w = Math.max(1, Math.round(m.size * 2 - i * 0.6));
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(m.x - ux * d - w / 2), Math.round(m.y - uy * d - w / 2), w, w);
    });
    drawSprite(ctx, 'meteor', Math.round(m.x - 4 * m.size), Math.round(m.y - 4 * m.size), m.size);
  }

  function drawCake(c) {
    const sway = Math.round(Math.sin(s.time * 5 + c.ph) * 3);
    // 반짝이는 테두리로 눈에 잘 띄게
    if (Math.floor(s.time * 6) % 2) { ctx.fillStyle = PAL.Y; ctx.fillRect(Math.round(c.x + sway + 8), Math.round(c.y - 8), 2, 2); }
    drawSprite(ctx, 'cake', Math.round(c.x - 8 + sway), Math.round(c.y - 6), SC);
  }

  function drawRabbit() {
    const dead = s.state !== 'play';
    const fall = dead && s.deadT > 0.3 ? (s.deadT - 0.3) ** 2 * 260 : 0;
    const jitter = dead && s.deadT < 0.3 ? Math.round(rand(-2, 2)) : 0;
    const float = dead ? 0 : Math.round(Math.sin(s.time * 5) * 2);
    // 벌크업이 끝나 갈 때는 원래 모습과 번갈아 보임
    const buff = s.fever > 0 && !(s.fever < 1.5 && Math.floor(s.time * 8) % 2);

    if (buff) {
      const sz = Math.round(18 * (SC + (BUFF_SC - SC) * s.grow));
      const x = Math.round(s.x - sz / 2), y = FEET - sz + float;
      drawFlame(s.x, FEET + float, 1 + s.grow * 0.6);
      // 불끈 기운
      if (Math.floor(s.time * 10) % 2) {
        ctx.fillStyle = PAL.Y;
        ctx.fillRect(x - 4, y + sz * 0.4, 2, 2); ctx.fillRect(x + sz + 2, y + sz * 0.35, 2, 2);
        ctx.fillRect(x + 2, y + 2, 2, 2); ctx.fillRect(x + sz - 4, y + 4, 2, 2);
      }
      drawSpriteScaled(ctx, 'rabbitBuff', x, y, sz, sz);
      return;
    }

    let name = 'rabbit';
    if (dead) name = 'rabbitDead';
    else if (s.wow > 0) name = 'rabbitWow';
    else if (s.happy > 0) name = 'rabbitHappy';
    else if (s.time % 3 < 0.12) name = 'rabbitBlink';
    const y = Math.round(FEET - RH + float + fall);
    if (!dead) drawFlame(s.x, FEET + float, 1);
    // 움직이는 쪽으로 살짝 기울임
    const tilt = dead ? s.deadT * 6 : clamp(s.vx / MAX_V, -1, 1) * 0.15;
    ctx.save();
    ctx.translate(Math.round(s.x) + jitter, y + RH / 2);
    ctx.rotate(tilt);
    drawSprite(ctx, name, -RW / 2, -RH / 2, SC);
    ctx.restore();
    // 부딪히면 머리 위로 별이 빙글빙글
    if (dead && s.deadT < 0.4) {
      for (let i = 0; i < 3; i++) {
        const a = s.deadT * 8 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = PAL.Y;
        ctx.fillRect(Math.round(s.x + Math.cos(a) * 11) - 1, Math.round(y + 6 + Math.sin(a) * 3) - 1, 3, 3);
      }
    }
  }

  // 발밑 로켓 불꽃
  function drawFlame(cx, y, k) {
    const f = Math.floor(s.time * 20) % 2;
    const len = Math.round((5 + f * 3) * k);
    const w = Math.round(4 * k);
    for (const dx of [-5 * k, 5 * k]) {
      const x = Math.round(cx + dx - w / 2);
      ctx.fillStyle = PAL.O; ctx.fillRect(x, y, w, len);
      ctx.fillStyle = PAL.Y; ctx.fillRect(x + 1, y, Math.max(1, w - 2), Math.round(len * 0.6));
    }
  }

  function drawFx() {
    ctx.textAlign = 'center';
    for (const e of s.fx) {
      if (e.type === 'spark') {
        ctx.fillStyle = e.color;
        ctx.fillRect(Math.round(e.x), Math.round(e.y), 2, 2);
      } else if (e.type === 'text') {
        ctx.globalAlpha = Math.min(1, e.t / 0.3);
        ctx.font = e.big ? '20px Galmuri11, monospace' : '10px Galmuri9, monospace';
        const x = Math.round(e.x), y = Math.round(e.y);
        ctx.fillStyle = PAL.K; ctx.fillText(e.text, x + 1, y + 1);
        if (e.big) { ctx.fillText(e.text, x - 1, y - 1); ctx.fillText(e.text, x + 1, y - 1); ctx.fillText(e.text, x - 1, y + 1); }
        ctx.fillStyle = e.color; ctx.fillText(e.text, x, y);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawHud() {
    ctx.font = '10px Galmuri9, monospace';
    // 고도
    ctx.textAlign = 'left';
    const altText = `고도 ${Math.floor(s.alt).toLocaleString('ko-KR')}m`;
    ctx.fillStyle = PAL.K; ctx.fillText(altText, 7, 15);
    ctx.fillStyle = PAL.W; ctx.fillText(altText, 6, 14);
    // 떡 모은 개수 (벌크업 중에는 남은 시간 막대)
    if (s.fever > 0) {
      const bw = 50, gx = W - bw - 6;
      ctx.fillStyle = PAL.K; ctx.fillRect(gx - 1, 7, bw + 2, 7);
      ctx.fillStyle = '#5a2a1a'; ctx.fillRect(gx, 8, bw, 5);
      ctx.fillStyle = Math.floor(s.time * 8) % 2 ? PAL.O : PAL.Y;
      ctx.fillRect(gx, 8, Math.round(bw * (s.fever / FEVER_TIME)), 5);
    } else {
      for (let i = 0; i < CAKES_NEED; i++) {
        ctx.globalAlpha = i < s.cakeCount ? 1 : 0.3;
        drawSprite(ctx, 'cake', W - 6 - (CAKES_NEED - i) * 10, 7, 1);
      }
      ctx.globalAlpha = 1;
    }
    // 조작 표시 (누르면 밝아짐)
    const arrow = (x, d, on) => {
      ctx.fillStyle = on ? PAL.W : 'rgba(244,244,244,0.3)';
      for (let i = 0; i < 6; i++) ctx.fillRect(d < 0 ? x + i : x + 5 - i, H - 18 - i, 1, i * 2 + 1);
    };
    arrow(12, -1, s.dir < 0);
    arrow(W - 18, 1, s.dir > 0);
    // 처음 몇 초 동안 조작 안내
    if (s.state === 'play' && s.time < 3) {
      ctx.textAlign = 'center';
      ctx.fillStyle = PAL.K; ctx.fillText('왼쪽·오른쪽을 눌러 피하세요', W / 2 + 1, 101);
      ctx.fillStyle = PAL.W; ctx.fillText('왼쪽·오른쪽을 눌러 피하세요', W / 2, 100);
    }
  }

  function draw() {
    ctx.save();
    if (s.shake > 0) ctx.translate(Math.round(rand(-3, 3)), Math.round(rand(-3, 3)));
    drawSky();
    s.cakes.forEach(drawCake);
    drawRabbit();
    s.meteors.forEach(drawMeteor);
    drawFx();
    drawWarns();
    ctx.restore();
    drawHud();
  }

  function loop(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    if (s.state !== 'over') update(dt);
    draw();
    if (s.state !== 'over') raf = requestAnimationFrame(loop);
  }

  function bind(on) {
    const m = on ? 'addEventListener' : 'removeEventListener';
    canvas[m]('pointerdown', onDown);
    canvas[m]('pointermove', onMove);
    canvas[m]('pointerup', onUp);
    canvas[m]('pointercancel', onUp);
    window[m]('keydown', onKey);
    window[m]('keyup', onKey);
  }

  reset();
  draw();

  return {
    start() {
      unlockSound();
      reset();
      keys = {};
      presses.clear();
      onScore(0);
      bind(false); bind(true);
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); bind(false); },
  };
}
