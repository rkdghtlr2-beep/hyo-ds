// 별똥별 피하기: 손가락으로 좌우로 움직여 떨어지는 별똥별을 피하고 동전을 모은다
import { drawSprite, spriteSize, PAL } from '../sprites.js';

export const W = 180;
export const H = 320;

export function createDodge(canvas, { onScore, onGameOver }) {
  const ctx = canvas.getContext('2d');
  const hero = spriteSize('hero');
  const GROUND = H - 24;

  let state, raf, last, keys = {};
  const stars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < 0.2 ? 2 : 1, v: 8 + Math.random() * 20 }));

  function reset() {
    state = {
      x: W / 2 - hero.w / 2, targetX: null,
      meteors: [], coins: [], sparks: [],
      time: 0, score: 0, spawn: 0, coinSpawn: 1.5, over: false,
    };
  }

  // 조작: 화면을 누르거나 끄는 위치로 이동
  const toLocalX = (e) => {
    const r = canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  };
  const onDown = (e) => { state.targetX = toLocalX(e); canvas.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (e.buttons || e.pointerType === 'touch') state.targetX = toLocalX(e); };
  const onUp = () => { state.targetX = null; };
  const onKey = (e) => { keys[e.key] = e.type === 'keydown'; };

  function update(dt) {
    const s = state;
    s.time += dt;
    const level = Math.min(s.time / 40, 1); // 40초에 걸쳐 점점 어려워짐

    // 이동
    const speed = 150;
    let dir = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    if (s.targetX !== null) {
      const diff = s.targetX - (s.x + hero.w / 2);
      if (Math.abs(diff) > 1) dir = Math.sign(diff);
      s.x += Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
    } else {
      s.x += dir * speed * dt;
    }
    s.x = Math.max(0, Math.min(W - hero.w, s.x));

    // 별똥별 생성
    s.spawn -= dt;
    if (s.spawn <= 0) {
      s.spawn = 0.55 - level * 0.38 + Math.random() * 0.15;
      s.meteors.push({ x: Math.random() * (W - 8), y: -8, v: 70 + level * 130 + Math.random() * 40, dx: (Math.random() - 0.5) * 20 * level });
    }
    // 동전 생성
    s.coinSpawn -= dt;
    if (s.coinSpawn <= 0) {
      s.coinSpawn = 2 + Math.random() * 2;
      s.coins.push({ x: 6 + Math.random() * (W - 18), y: -6, v: 60 });
    }

    const hx = s.x + 2, hy = GROUND - hero.h + 2, hw = hero.w - 4, hh = hero.h - 3;
    const hit = (o, w, h) => o.x < hx + hw && o.x + w > hx && o.y < hy + hh && o.y + h > hy;

    for (const m of s.meteors) {
      m.y += m.v * dt; m.x += m.dx * dt;
      if (Math.random() < 0.5) s.sparks.push({ x: m.x + 4, y: m.y, life: 0.3 });
      if (hit({ x: m.x + 1, y: m.y + 1 }, 6, 6)) return gameOver();
    }
    s.meteors = s.meteors.filter((m) => m.y < H);

    for (const c of s.coins) {
      c.y += c.v * dt;
      if (!c.got && hit(c, 6, 6)) { c.got = true; s.score += 50; }
    }
    s.coins = s.coins.filter((c) => !c.got && c.y < H);

    for (const p of s.sparks) p.life -= dt;
    s.sparks = s.sparks.filter((p) => p.life > 0);

    for (const st of stars) { st.y += st.v * dt; if (st.y > H) { st.y = 0; st.x = Math.random() * W; } }

    s.score += dt * 10;
    onScore(Math.floor(s.score));
  }

  function draw() {
    const s = state;
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(0, 0, W, H);
    for (const st of stars) { ctx.fillStyle = st.s > 1 ? PAL.W : PAL.S; ctx.fillRect(st.x | 0, st.y | 0, 1, st.s); }

    for (const p of s.sparks) { ctx.fillStyle = p.life > 0.15 ? PAL.Y : PAL.O; ctx.fillRect(p.x | 0, p.y | 0, 1, 1); }
    for (const c of s.coins) drawSprite(ctx, 'coin', c.x, c.y);
    for (const m of s.meteors) drawSprite(ctx, 'meteor', m.x, m.y);

    // 땅
    ctx.fillStyle = PAL.E; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = PAL.G; ctx.fillRect(0, GROUND, W, 2);
    ctx.fillStyle = '#257179';
    for (let i = 0; i < W; i += 8) ctx.fillRect(i + ((i / 8) % 2) * 3, GROUND + 6, 2, 2);

    // 주인공 (걸을 때 살짝 들썩)
    const bob = s.over ? 0 : Math.floor(s.time * 8) % 2;
    drawSprite(ctx, 'hero', s.x, GROUND - hero.h - bob);
  }

  function loop(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    if (!state.over) update(dt);
    draw();
    if (!state.over) raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    state.over = true;
    draw();
    onGameOver(Math.floor(state.score));
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
      reset(); keys = {};
      bind(true);
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); bind(false); },
  };
}
