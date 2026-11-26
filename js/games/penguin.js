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

// 펭귄 (빨간 목도리)
SPRITES.penguin = [
  '....KKKK....',
  '..KKKKKKKK..',
  '.KKKKKKKKKK.',
  '.KKWKKKKWKK.',
  '.KPKKOOKKPK.',
  'KKKKKOOKKKKK',
  'KRRRRRRRRRRK',
  'KKWWWWWWWWKK',
  'KKWWWWWWWWKK',
  '.KWWWWWWWWK.',
  '.KWWWWWWWWK.',
  '..KWWWWWWK..',
  '...KKKKKK...',
  '...OO..OO...',
];
// 점프할 때 (날개를 펼침)
SPRITES.penguinJump = [
  '....KKKK....',
  '..KKKKKKKK..',
  '.KKKKKKKKKK.',
  '.KKWKKKKWKK.',
  '.KPKKOOKKPK.',
  'KKKKKOOKKKKK',
  'KRRRRRRRRRRK',
  'KKWWWWWWWWKK',
  'KWWWWWWWWWWK',
  'K.WWWWWWWW.K',
  '..KWWWWWWK..',
  '..KWWWWWWK..',
  '...KKKKKK...',
  '..OO....OO..',
];
// 물개
SPRITES.seal = [
  '..SSSS...',
  '.SKSSKS..',
  '.SSSDSS..',
  'SSSSSSSSS',
  '.SSSSSSSS',
  '..S...S.S',
];
// 생선
SPRITES.fishie = [
  '.OOOO..O',
  'OKOOOOOO',
  'OOOOOOO.',
  '.OOOO..O',
];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createPenguin(canvas, { onScore, onGameOver }) {
  const ctx = canvas.getContext('2d');
  let s, raf, last;

  // ---------- 얼음 만들기 (n번째 줄, 올라갈수록 어려움) ----------
  function makeFloe(n) {
    const w = n === 0 ? 70 : clamp(62 - n * 1.3 + rand(-4, 4), 24, 64);
    const thin = n >= 15 && Math.random() < 0.18;          // 살얼음: 빨리 녹음
    const seal = n >= 12 && !thin && w > 38 && Math.random() < 0.22;
    const fish = n >= 4 && !seal && Math.random() < 0.25;
    return {
      n, w,
      x: n === 0 ? W / 2 : rand(w / 2 + 6, W - w / 2 - 6),
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: Math.min(135, 34 + n * 3.2) * rand(0.85, 1.15),
      thin,
      // 물개·생선은 얼음 가운데에서 떨어진 위치(왼쪽 또는 오른쪽)
      seal: seal ? (Math.random() < 0.5 ? -1 : 1) * (w / 2 - 10) : null,
      fish: fish ? rand(-w / 2 + 9, w / 2 - 9) : null,
      sink: 0, // 가라앉는 정도 (0~1)
    };
  }

  // 한 얼음에 서 있을 수 있는 시간 (올라갈수록 짧아짐)
  const standLimit = (f) => (f.thin ? 1.3 : Math.max(1.8, 4.2 - f.n * 0.07));

  function reset() {
    const floes = [];
    for (let i = 0; i < 7; i++) floes.push(makeFloe(i));
    s = {
      floes, cur: 0,                 // 지금 서 있는 얼음 번호
      px: W / 2, state: 'stand',     // stand | jump | fall | over
      t: 0, stand: 0, cracked: 0,
      camY: 0, score: 0, perfect: 0, perfects: 0, fishes: 0,
      fx: [], shake: 0, time: 0, started: false, landSquash: 0,
    };
  }

  const floeAt = (n) => s.floes.find((f) => f.n === n);
  const screenY = (n) => BASE_Y - (n * GAP - s.camY);

  // ---------- 조작 ----------
  function onDown(e) {
    e.preventDefault();
    unlockSound();
    if (s.state !== 'stand') return;
    s.state = 'jump';
    s.t = 0;
    s.started = true;
    sfx.hop();
  }

  function land() {
    const f = floeAt(s.cur + 1);
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
      if (s.t >= JUMP_T) land();
    } else if (s.state === 'stand' && s.started) {
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
      if (s.t > 0.9) return finish();
    }

    // 화면이 펭귄을 따라 올라감
    const target = (s.cur + (s.state === 'jump' ? s.t / JUMP_T : 0)) * GAP;
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
      detail: `건넌 얼음 ${s.cur}개\n퍼펙트 ${s.perfects}번\n생선 ${s.fishes}마리`,
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
    if (f.fish !== null) drawSprite(ctx, 'fishie', x + f.fish - 8, y - 9 + Math.round(Math.sin(s.time * 6 + f.n) * 1), 2);
    if (f.seal !== null) {
      // 물개는 얼음 바깥쪽을 보고 누워 있음
      ctx.save();
      const sx = x + f.seal;
      if (f.seal < 0) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
      drawSprite(ctx, 'seal', sx - 9, y - 11, 2, { S: '#8d9aa8', D: '#2b2d3a' });
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawPenguin() {
    if (s.state === 'over') return;
    const fromY = screenY(s.cur);
    let y = fromY, lift = 0, name = 'penguin', sx = 1, sy = 1, alpha = 1;
    if (s.state === 'jump') {
      const k = s.t / JUMP_T;
      y = fromY - GAP * k;
      lift = Math.sin(k * Math.PI) * 26; // 위로 뜨는 높이
      name = 'penguinJump';
      sx = 1 + Math.sin(k * Math.PI) * 0.15; sy = sx;
      // 그림자 (물이나 얼음 위)
      ctx.fillStyle = 'rgba(5,20,50,.4)';
      ctx.fillRect(Math.round(s.px - 8 + lift * 0.1), Math.round(y - 1), 16 - Math.round(lift * 0.2), 3);
    } else if (s.state === 'fall') {
      y = s.fallY;
      lift = -Math.min(1, s.t / 0.5) * 20; // 물속으로 가라앉음
      alpha = Math.max(0, 1 - s.t / 0.6);
      name = 'penguinJump';
    } else if (s.state === 'stand') {
      // 착지하면 살짝 찌그러짐, 얼음이 녹을 때는 덜덜 떪
      if (s.landSquash > 0) { const q = s.landSquash / 0.12; sx = 1 + 0.2 * q; sy = 1 - 0.2 * q; }
      if (s.cracked >= 3) y += Math.round(Math.sin(s.time * 40));
    }
    const feetY = Math.round(y - lift + 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(s.px), feetY);
    ctx.scale(sx, sy);
    // 빠질 때는 물 위로 보이는 부분만 그림 (물속으로 쏙 들어가는 느낌)
    if (s.state === 'fall') { ctx.beginPath(); ctx.rect(-20, -40, 40, Math.max(0, 40 + lift - 2)); ctx.clip(); }
    drawSprite(ctx, name, -12, -28, 2);
    ctx.restore();
  }

  function drawFx() {
    ctx.textAlign = 'center';
    for (const e of s.fx) {
      if (e.type === 'star') {
        ctx.fillStyle = e.t > 0.2 ? PAL.Y : PAL.W;
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
    if (s.perfect >= 2) {
      ctx.fillStyle = PAL.Y; ctx.fillText(`퍼펙트 ${s.perfect}연속`, W / 2, 32);
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
