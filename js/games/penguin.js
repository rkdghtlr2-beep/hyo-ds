// 펭귄 얼음 점프: 터치하면 펭귄이 위쪽 얼음으로 폴짝! 바다에 빠지면 끝
//  - 위쪽 얼음은 좌우로 움직이고, 착지한 얼음은 멈춤
//  - 얼음 한가운데 착지 = 퍼펙트 (연속이면 보너스가 커짐)
//  - 한 얼음에 오래 서 있으면 갈라지며 녹아서 가라앉음
//  - 올라갈수록 얼음이 작아지고 빨라짐, 생선(보너스)·물개(밟으면 실패)·살얼음(빨리 녹음) 등장
import { drawSprite, pixelEllipse, PAL, SPRITES } from '../sprites.js';
import { sfx, buzz, unlockSound } from '../sfx.js';

const W = 180;
const H = 320;
const GAP = 62;          // 얼음 줄 사이 간격
const BASE_Y = 252;      // 지금 서 있는 얼음의 화면 높이
const JUMP_T = 0.3;      // 점프에 걸리는 시간
const FLOE_RY = 7;       // 얼음 세로 반지름
const PERFECT = 3;       // 한가운데에서 이만큼 안쪽이면 퍼펙트
const FEVER_FILL = 0.25; // 퍼펙트 한 번에 차는 피버 게이지 (4번이면 가득)
const FEVER_TIME = 5;    // 무지개 질주 시간(초)
const FEVER_JUMP = 0.18; // 질주 중 점프 시간

// 아기 펭귄 (까만 머리, 하트 모양 하얀 얼굴, 반짝이는 눈, 작은 부리)
const TOP = [
  '.....KKKKKK.....',
  '...KKKKKKKKKK...',
  '..KKKKKKKKKKKK..',
  '.KKKKWWKKWWKKKK.',
  '.KKWWWWWWWWWWKK.',
];
const EYES = [
  'KKWWWKKWWKKWWWKK',
  'KKWWWKKWWKKWWWKK',
  'KKWWWKKWWKKWWWKK',
];
// 눈 깜빡임
const BLINK = [
  'KKWWWWWWWWWWWWKK',
  'KKWWKKKWWKKKWWKK',
  'KKWWWWWWWWWWWWKK',
];
// 퍼펙트: 하트 눈
const HEART = [
  'KKWWRWRWWRWRWWKK',
  'KKWWRRRWWRRRWWKK',
  'KKWWWRWWWWRWWWKK',
];
// 물에 빠짐: X X 눈
const DEAD = [
  'KKWWKWKWWKWKWWKK',
  'KKWWWKWWWWKWWWKK',
  'KKWWKWKWWKWKWWKK',
];
// 무지개 질주: 선글라스
const SHADES = [
  'KKDDDDDDDDDDDDKK',
  'KKWDWDDWWDWDDWKK',
  'KKWWDDWWWWDDWWKK',
];
const BEAK = [
  'KKWPWWWOOWWWPWKK',
  '.KKKSWWWWWWSKKK.',
];
const BODY = [
  '.KKWWWWWWWWWWKK.',
  'KKKWWWWWWWWWWKKK',
  'KOKWWWWWWWWWWKOK',
  '..KKWWWWWWWWKK..',
  '...KKKKKKKKKK...',
  '...OOO....OOO...',
];
// 점프할 때 (날개를 쫙 펼침)
const BODY_JUMP = [
  'KKKWWWWWWWWWWKKK',
  'OKKWWWWWWWWWWKKO',
  '..KWWWWWWWWWWK..',
  '..KKWWWWWWWWKK..',
  '...KKKKKKKKKK...',
  '..OOO......OOO..',
];
SPRITES.penguin = [...TOP, ...EYES, ...BEAK, ...BODY];
SPRITES.penguinBlink = [...TOP, ...BLINK, ...BEAK, ...BODY];
SPRITES.penguinJump = [...TOP, ...EYES, ...BEAK, ...BODY_JUMP];
SPRITES.penguinHappy = [...TOP, ...HEART, ...BEAK, ...BODY];
SPRITES.penguinCool = [...TOP, ...SHADES, ...BEAK, ...BODY];
SPRITES.penguinCoolJump = [...TOP, ...SHADES, ...BEAK, ...BODY_JUMP];
SPRITES.penguinDead = [...TOP, ...DEAD, ...BEAK, ...BODY_JUMP];

// 펭귄을 작은 그림판에 먼저 그린 뒤 통째로 늘려 붙임
// (도트를 하나씩 늘리면 점프할 때 칸 사이가 벌어져 몸이 갈라져 보임)
const spriteCanvas = document.createElement('canvas');
function drawSpriteScaled(ctx, name, x, y, w, h, swap) {
  const rows = SPRITES[name];
  spriteCanvas.width = rows[0].length;
  spriteCanvas.height = rows.length;
  const sc = spriteCanvas.getContext('2d');
  sc.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);
  drawSprite(sc, name, 0, 0, 1, swap);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteCanvas, x, y, w, h);
}
// 물개 (동글동글, 분홍 볼)
SPRITES.seal = [
  '..KKKKK.......',
  '.KSSSSSK......',
  'KSKSSSKSK.....',
  'KSSSDSSSK..KK.',
  'KPSSSSSPKKKSSK',
  'KSSSSSSSSSSSK.',
  '.KSKSSSSSSSK..',
  '..KKKKKKKKK...',
];
// 생선
SPRITES.fishie = [
  '..KKKKK.KK',
  '.KOOOOOKOK',
  'KOKOOOOOOK',
  'KOOOOOOOOK',
  '.KOOOOOKOK',
  '..KKKKK.KK',
];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createPenguin(canvas, { onScore, onGameOver }) {
  const ctx = canvas.getContext('2d');
  let s, raf, last;

  // ---------- 얼음 만들기 (n번째 줄, 올라갈수록 어려움) ----------
  // 난이도는 '걸어서 건넌 얼음' 기준 (무지개 질주로 건넌 얼음은 20%만 셈)
  function makeFloe(n) {
    const d = Math.max(0, n - (s ? s.skip : 0));
    const w = n === 0 ? 70 : clamp(62 - d * 0.6 + rand(-4, 4), 34, 64);
    const thin = d >= 20 && Math.random() < 0.15;          // 살얼음: 빨리 녹음
    const seal = d >= 14 && !thin && w > 38 && Math.random() < 0.2;
    const fish = n >= 4 && !seal && Math.random() < 0.25;
    return {
      n, w,
      x: n === 0 ? W / 2 : rand(w / 2 + 6, W - w / 2 - 6),
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: Math.min(95, 32 + d * 1.6) * rand(0.85, 1.15), // 갈수록 빨라짐
      d,
      thin,
      // 물개·생선은 얼음 가운데에서 떨어진 위치(왼쪽 또는 오른쪽)
      seal: seal ? (Math.random() < 0.5 ? -1 : 1) * (w / 2 - 10) : null,
      fish: fish ? rand(-w / 2 + 9, w / 2 - 9) : null,
      sink: 0, // 가라앉는 정도 (0~1)
    };
  }

  // 한 얼음에 서 있을 수 있는 시간 (올라갈수록 짧아짐)
  const standLimit = (f) => (f.thin ? 2.1 : Math.max(2.8, 4.6 - f.d * 0.03));

  function reset() {
    const floes = [];
    s = null;
    for (let i = 0; i < 7; i++) floes.push(makeFloe(i));
    s = {
      floes, cur: 0,                 // 지금 서 있는 얼음 번호
      px: W / 2, state: 'stand',     // stand | jump | fall | over
      t: 0, stand: 0, cracked: 0,
      camY: 0, score: 0, perfect: 0, perfects: 0, fishes: 0,
      fx: [], shake: 0, time: 0, started: false, landSquash: 0, tease: 0,
      jumpT: JUMP_T, skip: 0, gauge: 0, fever: 0, feverJump: false, queued: false, feverRuns: 0,
    };
  }

  const floeAt = (n) => s.floes.find((f) => f.n === n);
  // 펭귄의 지금 화면 높이 (무지개 꼬리 위치)
  const penguinY = () => (s.state === 'jump' ? screenY(s.cur) - GAP * (s.t / s.jumpT) : screenY(s.cur));
  const screenY = (n) => BASE_Y - (n * GAP - s.camY);

  // ---------- 조작 ----------
  function onDown(e) {
    e.preventDefault();
    unlockSound();
    // 질주 중에는 점프 중에 눌러도 다음 점프로 이어짐
    if (s.state === 'jump' && s.fever > 0) { s.queued = true; return; }
    if (s.state !== 'stand') return;
    jump();
  }

  function jump() {
    s.state = 'jump';
    s.t = 0;
    s.started = true;
    s.queued = false;
    s.feverJump = s.fever > 0;
    s.jumpT = s.feverJump ? FEVER_JUMP : JUMP_T;
    s.jumpFrom = s.px;
    sfx.hop();
  }

  function land() {
    const f = floeAt(s.cur + 1);
    if (s.feverJump) return feverLand(f);
    const off = s.px - f.x;
    const onFloe = Math.abs(off) <= f.w / 2 - 2;
    // 물개를 밟으면 미끄러져 빠짐
    const onSeal = f.seal !== null && Math.abs(off - f.seal) < 9;
    if (!onFloe || onSeal) return fall(onSeal ? '물개한테 밀렸어요!' : null, f);

    s.cur++;
    s.state = 'stand';
    s.stand = 0;
    s.cracked = 0;
    s.landSquash = 0.12;
    const y = screenY(s.cur);
    let gain = 10;
    if (Math.abs(off) <= PERFECT) {
      s.perfect++;
      s.perfects++;
      const bonus = 10 * Math.min(s.perfect, 5);
      gain += bonus;
      pop(s.px, y - 34, s.perfect > 1 ? `퍼펙트 x${s.perfect}!` : '퍼펙트!', PAL.Y);
      s.tease = 0.6; // 퍼펙트면 활짝 웃음
      addGauge();
      sfx.perfect();
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        s.fx.push({ type: 'star', x: s.px, y: y - 6, vx: Math.cos(a) * 70, vy: Math.sin(a) * 40 - 20, t: 0.4 });
      }
      buzz(15);
    } else {
      s.perfect = 0;
      sfx.plop();
      buzz(8);
    }
    // 생선 먹기
    if (f.fish !== null && Math.abs(s.px - (f.x + f.fish)) < 11) {
      gain += 30;
      s.fishes++;
      pop(f.x + f.fish, y - 20, '생선 +30', PAL.O);
      f.fish = null;
      sfx.pyong(true);
    }
    s.score += gain;
    onScore(s.score);
    s.fx.push({ type: 'ring', x: s.px, y, t: 0.25 });
    // 다음 줄 준비
    s.floes = s.floes.filter((fl) => fl.n >= s.cur - 1);
    while (s.floes.length < 7) s.floes.push(makeFloe(s.floes[s.floes.length - 1].n + 1));
  }

  // 피버 게이지 채우기 (가득 차면 무지개 질주 시작)
  function addGauge() {
    if (s.fever > 0) return;
    s.gauge = Math.min(1, s.gauge + FEVER_FILL);
    if (s.gauge >= 1) {
      s.fever = FEVER_TIME;
      s.feverRuns++;
      pop(W / 2, 110, '무지개 질주!', '#ff9df0');
      sfx.level();
      buzz([30, 30, 30]);
    }
  }

  // 질주 중 착지: 무조건 얼음 한가운데로 (물개도 튕겨 냄)
  function feverLand(f) {
    s.cur++;
    s.skip += 0.8;
    s.state = 'stand';
    s.stand = 0;
    s.cracked = 0;
    s.landSquash = 0.08;
    s.px = f.x;
    const y = screenY(s.cur);
    let gain = 20;
    if (f.seal !== null) { pop(f.x, y - 22, '물개 퉁!', '#ff9df0'); f.seal = null; gain += 20; }
    if (f.fish !== null) { gain += 30; s.fishes++; pop(f.x, y - 34, '생선 +30', PAL.O); f.fish = null; }
    s.score += gain;
    onScore(s.score);
    sfx.plop();
    buzz(6);
    for (let i = 0; i < 6; i++) {
      s.fx.push({ type: 'star', x: s.px, y: y - 6, vx: rand(-70, 70), vy: rand(-90, -20), t: 0.4, rainbow: true });
    }
    s.floes = s.floes.filter((fl) => fl.n >= s.cur - 1);
    while (s.floes.length < 7) s.floes.push(makeFloe(s.floes[s.floes.length - 1].n + 1));
    if (s.queued && s.fever > 0) jump();
  }

  // 바다에 빠짐 (msg: 빠진 이유, f: 빠진 곳의 얼음)
  function fall(msg, f) {
    s.state = 'fall';
    s.t = 0;
    s.fallY = f ? screenY(f.n) : screenY(s.cur);
    s.perfect = 0;
    s.shake = 0.3;
    sfx.splash();
    buzz([40, 30, 60]);
    for (let i = 0; i < 14; i++) {
      s.fx.push({ type: 'drop', x: s.px, y: s.fallY, vx: rand(-60, 60), vy: rand(-140, -60), t: rand(0.4, 0.7) });
    }
    s.fx.push({ type: 'wave', x: s.px, y: s.fallY + 4, t: 0.6 });
    pop(s.px, s.fallY - 30, msg || '퐁당!', '#9fd8ff');
  }

  const pop = (x, y, text, color) => s.fx.push({ type: 'text', x: clamp(x, 34, W - 34), y, text, color, t: 0.8 });

  // ---------- 진행 ----------
  function update(dt) {
    s.time += dt;
    if (s.shake > 0) s.shake -= dt;
    if (s.landSquash > 0) s.landSquash -= dt;
    if (s.tease > 0) s.tease -= dt;
    if (s.fever > 0) {
      s.fever -= dt;
      s.gauge = Math.max(0, s.fever / FEVER_TIME);
      // 무지개 꼬리
      if (s.state !== 'fall') s.fx.push({ type: 'trail', x: s.px + rand(-4, 4), y: penguinY() - 10, hue: (s.time * 600) % 360, t: 0.35 });
      if (s.fever <= 0) { s.fever = 0; s.gauge = 0; s.stand = 0; s.cracked = 0; }
    }

    // 다음 얼음은 좌우로 왔다 갔다
    const next = floeAt(s.cur + 1);
    if (next && s.state !== 'fall') {
      next.x += next.dir * next.speed * dt;
      const lo = next.w / 2 + 4, hi = W - next.w / 2 - 4;
      if (next.x < lo) { next.x = lo; next.dir = 1; }
      if (next.x > hi) { next.x = hi; next.dir = -1; }
    }

    if (s.state === 'jump') {
      s.t += dt;
      // 질주 중에는 다음 얼음 한가운데로 날아감
      if (s.feverJump) { const f = floeAt(s.cur + 1); s.px = s.jumpFrom + (f.x - s.jumpFrom) * Math.min(1, s.t / s.jumpT); }
      if (s.t >= s.jumpT) land();
    } else if (s.state === 'stand' && s.started && s.fever <= 0) {
      // 오래 서 있으면 얼음이 갈라지고 녹음
      const cur = floeAt(s.cur);
      const lim = standLimit(cur);
      s.stand += dt;
      const stage = s.stand > lim * 0.85 ? 3 : s.stand > lim * 0.65 ? 2 : s.stand > lim * 0.4 ? 1 : 0;
      if (stage > s.cracked) { s.cracked = stage; sfx.crack(); buzz(6); }
      if (s.stand >= lim) {
        cur.sinking = true;
        fall('얼음이 녹았어요!', cur);
      }
    } else if (s.state === 'fall') {
      s.t += dt;
      const cur = floeAt(s.cur);
      if (cur && cur.sinking) cur.sink = Math.min(1, cur.sink + dt * 2);
      if (s.t > 1.2) return finish();
    }

    // 화면이 펭귄을 따라 올라감
    const target = (s.cur + (s.state === 'jump' ? s.t / s.jumpT : 0)) * GAP;
    s.camY += (target - s.camY) * Math.min(1, dt * 8);

    for (const e of s.fx) {
      e.t -= dt;
      if (e.type === 'star' || e.type === 'drop') { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 380 * dt; }
      else if (e.type === 'text') e.y -= 22 * dt;
    }
    s.fx = s.fx.filter((e) => e.t > 0);
  }

  function finish() {
    s.state = 'over';
    onGameOver(s.score, {
      detail: `건넌 얼음 ${s.cur}개\n퍼펙트 ${s.perfects}번\n무지개 질주 ${s.feverRuns}번\n생선 ${s.fishes}마리`,
    });
  }

  // ---------- 그리기 ----------
  function drawSea() {
    ctx.fillStyle = '#1d5fa3';
    ctx.fillRect(-6, -6, W + 12, H + 12);
    // 물결 (화면이 올라가면 함께 흐름)
    const off = s.camY * 0.5;
    for (let y = -10; y < H + 10; y += 14) {
      const wy = Math.round(y + (off % 14));
      for (let x = ((y / 14) % 2 ? 0 : 9); x < W; x += 18) {
        const dx = Math.round(Math.sin(s.time * 1.6 + y * 0.3 + x) * 2);
        ctx.fillStyle = '#3d86cc';
        ctx.fillRect(x + dx, wy, 6, 1);
        ctx.fillStyle = '#2a71ba';
        ctx.fillRect(x + dx + 2, wy + 1, 4, 1);
      }
    }
    // 위쪽은 어둡게 (먼 바다 느낌)
    const g = ctx.createLinearGradient(0, 0, 0, 90);
    g.addColorStop(0, 'rgba(10,25,60,.55)');
    g.addColorStop(1, 'rgba(10,25,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-6, -6, W + 12, 96);
  }

  function drawFloe(f) {
    const y = Math.round(screenY(f.n) + f.sink * 10);
    if (y < -30 || y > H + 30) return;
    const x = Math.round(f.x), rx = Math.round(f.w / 2);
    const fade = 1 - f.sink;
    ctx.globalAlpha = Math.max(0, fade);
    // 그림자, 옆면, 윗면, 반짝임
    pixelEllipse(ctx, x, y + 4, rx + 1, FLOE_RY, '#103e70');
    pixelEllipse(ctx, x, y + 2, rx, FLOE_RY, f.thin ? '#7fb8de' : '#9cc8ec');
    pixelEllipse(ctx, x, y, rx, FLOE_RY - 1, f.thin ? '#cdeeff' : '#eef8ff');
    pixelEllipse(ctx, x - Math.round(rx * 0.25), y - 2, Math.round(rx * 0.45), 2, '#ffffff');
    if (f.thin) { ctx.fillStyle = '#9fd3f3'; ctx.fillRect(x - 6, y - 1, 3, 1); ctx.fillRect(x + 4, y + 1, 4, 1); }

    // 지금 서 있는 얼음의 금 (녹는 단계)
    if (f.n === s.cur && s.cracked) {
      ctx.fillStyle = '#4a7fb0';
      const c = s.cracked;
      ctx.fillRect(x - 3, y - 3, 1, 3); ctx.fillRect(x - 2, y, 3, 1); ctx.fillRect(x + 1, y + 1, 1, 3);
      if (c >= 2) { ctx.fillRect(x - rx + 6, y - 1, 6, 1); ctx.fillRect(x - rx + 11, y, 1, 3); ctx.fillRect(x + rx - 10, y - 2, 5, 1); }
      if (c >= 3) { ctx.fillRect(x + rx - 7, y + 1, 1, 4); ctx.fillRect(x - 8, y + 3, 6, 1); }
    }
    // 생선, 물개
    if (f.fish !== null) drawSprite(ctx, 'fishie', x + f.fish - 10, y - 11 + Math.round(Math.sin(s.time * 6 + f.n) * 1), 2);
    if (f.seal !== null) {
      // 물개는 얼음 바깥쪽을 보고 누워 있음
      ctx.save();
      const sx = x + f.seal;
      if (f.seal < 0) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
      drawSprite(ctx, 'seal', sx - 14, y - 15, 2, { S: '#aab8c6', D: '#2b2d3a', P: '#ff9fb8' });
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawPenguin() {
    if (s.state === 'over') return;
    const fromY = screenY(s.cur);
    let y = fromY, lift = 0, name = 'penguin', sx = 1, sy = 1, alpha = 1;
    if (s.state === 'jump') {
      const k = s.t / s.jumpT;
      y = fromY - GAP * k;
      lift = Math.sin(k * Math.PI) * (s.feverJump ? 14 : 26); // 위로 뜨는 높이
      name = s.feverJump ? 'penguinCoolJump' : 'penguinJump';
      sx = 1 + Math.sin(k * Math.PI) * 0.15; sy = sx;
      // 그림자 (물이나 얼음 위)
      ctx.fillStyle = 'rgba(5,20,50,.4)';
      ctx.fillRect(Math.round(s.px - 8 + lift * 0.1), Math.round(y - 1), 16 - Math.round(lift * 0.2), 3);
    } else if (s.state === 'fall') {
      // X X 눈으로 잠깐 멈췄다가 물속으로 가라앉음
      y = s.fallY;
      const k = Math.max(0, s.t - 0.3);
      lift = -Math.min(1, k / 0.5) * 22;
      alpha = Math.max(0, 1 - k / 0.6);
      name = 'penguinDead';
      if (s.t < 0.3) y += Math.round(Math.sin(s.time * 50)); // 부르르 떪
    } else if (s.state === 'stand') {
      // 착지하면 살짝 찌그러짐, 얼음이 녹을 때는 덜덜 떪
      if (s.landSquash > 0) { const q = s.landSquash / 0.12; sx = 1 + 0.2 * q; sy = 1 - 0.2 * q; }
      if (s.cracked >= 3) y += Math.round(Math.sin(s.time * 40));
      if (s.fever > 0) name = 'penguinCool';            // 질주 중에는 선글라스
      else if (s.tease > 0) name = 'penguinHappy';      // 퍼펙트면 하트 눈
      else if (s.time % 3 < 0.12) name = 'penguinBlink';      // 가끔 눈 깜빡임
    }
    const feetY = Math.round(y - lift + 2);
    const w = Math.round(32 * sx), h = Math.round(32 * sy);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(s.px), feetY);
    // 빠질 때는 물 위로 보이는 부분만 그림 (물속으로 쏙 들어가는 느낌)
    if (s.state === 'fall') { ctx.beginPath(); ctx.rect(-24, -40, 48, Math.max(0, 40 + lift - 2)); ctx.clip(); }
    // 질주 중에는 몸 색이 무지개로 바뀜
    const swap = s.fever > 0 ? { K: `hsl(${(s.time * 500) % 360},85%,45%)`, D: '#0d0e18' } : null;
    drawSpriteScaled(ctx, name, -Math.round(w / 2), -h, w, h, swap);
    ctx.restore();
  }

  function drawFx() {
    ctx.textAlign = 'center';
    for (const e of s.fx) {
      if (e.type === 'trail') {
        ctx.globalAlpha = e.t / 0.35;
        ctx.fillStyle = `hsl(${e.hue},90%,65%)`;
        ctx.fillRect(Math.round(e.x) - 2, Math.round(e.y), 4, 4);
        ctx.globalAlpha = 1;
      } else if (e.type === 'star') {
        ctx.fillStyle = e.rainbow ? `hsl(${(e.x * 7 + s.time * 400) % 360},90%,65%)` : e.t > 0.2 ? PAL.Y : PAL.W;
        ctx.fillRect(Math.round(e.x), Math.round(e.y), 2, 2);
      } else if (e.type === 'drop') {
        ctx.fillStyle = '#bfe6ff';
        ctx.fillRect(Math.round(e.x), Math.round(e.y), 2, 2);
      } else if (e.type === 'ring' || e.type === 'wave') {
        const life = e.type === 'ring' ? 0.25 : 0.6;
        const r = 8 + (1 - e.t / life) * (e.type === 'ring' ? 16 : 26);
        ctx.fillStyle = e.type === 'ring' ? 'rgba(255,255,255,.8)' : '#bfe6ff';
        for (let i = 0; i < 18; i++) {
          const a = (Math.PI * 2 * i) / 18;
          ctx.fillRect(Math.round(e.x + Math.cos(a) * r), Math.round(e.y + Math.sin(a) * r * 0.35), 2, 1);
        }
      } else if (e.type === 'text') {
        ctx.font = '12px Galmuri11, monospace';
        ctx.fillStyle = PAL.K; ctx.fillText(e.text, e.x + 1, e.y + 1);
        ctx.fillStyle = e.color; ctx.fillText(e.text, e.x, e.y);
      }
    }
  }

  function drawHud() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '10px Galmuri9, monospace';
    ctx.fillStyle = PAL.K; ctx.fillText(`얼음 ${s.cur}개`, W / 2 + 1, 19);
    ctx.fillStyle = PAL.W; ctx.fillText(`얼음 ${s.cur}개`, W / 2, 18);
    // 피버 게이지
    const gx = W / 2 - 40, gy = 24;
    ctx.fillStyle = PAL.K; ctx.fillRect(gx - 1, gy - 1, 82, 7);
    ctx.fillStyle = '#16324f'; ctx.fillRect(gx, gy, 80, 5);
    const gw = Math.round(80 * s.gauge);
    if (s.fever > 0) {
      for (let i = 0; i < gw; i++) { ctx.fillStyle = `hsl(${(i * 8 + s.time * 400) % 360},90%,60%)`; ctx.fillRect(gx + i, gy, 1, 5); }
    } else {
      ctx.fillStyle = s.gauge >= 0.75 ? '#ff9df0' : PAL.B; ctx.fillRect(gx, gy, gw, 5);
    }
    if (s.fever > 0) {
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = PAL.K; ctx.fillText('마구 터치!', W / 2 + 1, 44);
      ctx.fillStyle = `hsl(${(s.time * 500) % 360},90%,70%)`; ctx.fillText('마구 터치!', W / 2, 43);
    } else if (s.perfect >= 2) {
      ctx.fillStyle = PAL.Y; ctx.fillText(`퍼펙트 ${s.perfect}연속`, W / 2, 42);
    }
    if (!s.started) {
      const blink = Math.floor(s.time * 2.5) % 2;
      ctx.font = '12px Galmuri11, monospace';
      ctx.fillStyle = PAL.K; ctx.fillText('터치해서 점프!', W / 2 + 1, 151);
      ctx.fillStyle = blink ? PAL.W : PAL.Y; ctx.fillText('터치해서 점프!', W / 2, 150);
    }
    // 얼음이 녹기 직전 경고
    if (s.state === 'stand' && s.cracked >= 2) {
      ctx.font = '10px Galmuri9, monospace';
      ctx.fillStyle = Math.floor(s.time * 8) % 2 ? '#ff8a8a' : PAL.W;
      ctx.fillText('얼음이 녹아요!', W / 2, BASE_Y + 34);
    }
  }

  function draw() {
    ctx.save();
    if (s.shake > 0) ctx.translate(Math.round(rand(-3, 3)), Math.round(rand(-3, 3)));
    drawSea();
    // 먼 얼음부터 (위쪽부터) 그림
    [...s.floes].sort((a, b) => b.n - a.n).forEach(drawFloe);
    drawPenguin();
    drawFx();
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
