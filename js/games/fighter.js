// 도트 격투: 1P vs CPU, 친구와 온라인 대전
//  온라인 대전: 방장 휴대폰이 경기를 진행하고(왼쪽 캐릭터), 들어온 사람은 버튼 입력만 보내고 화면을 받아 그림(오른쪽 캐릭터)
//  ← → 이동, ↓ 앉기(누르는 동안만), ↑ 없음
//  A 주먹, B 발차기, C 점프, D 막기(누르는 동안)
//  AAA 주먹 연속기, BBB 발 연속기, ←/→ 누른 채 A·B = 달려가며 공격
import { PAL } from '../sprites.js';
import { sfx, buzz } from '../sfx.js';
import { pad, consumePressed, resetPad } from '../pad.js';

const W = 160;
const H = 120;
const GROUND = 106;        // 바닥 높이(화면 좌표)
const GRAV = 700;
const JUMP_V = 250;
const WALK = 50;
const AIR_X = 60;
const ROUND_TIME = 60;
const MAX_HP = 100;
const STAND_H = 38;        // 서 있을 때 맞는 높이
const CROUCH_H = 24;       // 앉았을 때 맞는 높이 (높은 공격은 머리 위로 지나감)
const BODY = 6;            // 몸 반쪽 너비

const SKIN = '#e8b796', SKIN_D = '#c48f6f', HAIR = '#3a2a22', LINE = '#0d0e18';
const LOOK = {
  p1: { shirt: '#ef7d57', shirtD: '#b5513a', pants: '#b13e53', pantsD: '#7d2a3d', band: '#f4f4f4' },
  cpu: { shirt: '#41a6f6', shirtD: '#2c7cc0', pants: '#29366f', pantsD: '#1d2550', band: '#ffcd75' },
};
const FLASH = { shirt: '#fff', shirtD: '#fff', pants: '#fff', pantsD: '#fff', band: '#fff', skin: '#fff', skinD: '#fff', hair: '#fff' };

// 자세 (오른쪽을 볼 때 기준, 발밑에서 위로 잰 좌표)
// hip 골반, neck 목, head 머리, fe/fh 앞팔 팔꿈치/주먹, be/bh 뒷팔, fk/ff 앞다리 무릎/발, bk/bf 뒷다리
const STAND_LEGS = { fk: [4, 9], ff: [5, 0], bk: [-3, 9], bf: [-5, 0] };
const WIDE_LEGS = { fk: [5, 9], ff: [7, 0], bk: [-4, 9], bf: [-6, 0] };
const POSES = {
  idle: { hip: [0, 17], neck: [1, 29], head: [2, 34], fe: [5, 24], fh: [8, 28], be: [-1, 23], bh: [4, 26], ...STAND_LEGS },
  idle2: { hip: [0, 16], neck: [1, 28], head: [2, 33], fe: [5, 23], fh: [8, 27], be: [-1, 22], bh: [4, 25], fk: [4, 8], ff: [5, 0], bk: [-3, 8], bf: [-5, 0] },
  walk1: { hip: [0, 17], neck: [1, 29], head: [2, 34], fe: [5, 24], fh: [8, 28], be: [-1, 23], bh: [4, 26], fk: [5, 9], ff: [8, 0], bk: [-4, 9], bf: [-7, 0] },
  walk2: { hip: [0, 18], neck: [1, 30], head: [2, 35], fe: [5, 25], fh: [8, 29], be: [-1, 24], bh: [4, 27], fk: [2, 9], ff: [1, 0], bk: [0, 9], bf: [-1, 0] },
  crouch: { hip: [0, 10], neck: [3, 21], head: [4, 26], fe: [7, 17], fh: [10, 20], be: [1, 15], bh: [6, 18], fk: [7, 8], ff: [5, 0], bk: [-5, 5], bf: [-6, 0] },
  guard: { hip: [0, 17], neck: [0, 29], head: [1, 34], fe: [5, 25], fh: [7, 32], be: [3, 24], bh: [7, 28], ...STAND_LEGS },
  crouchGuard: { hip: [0, 10], neck: [2, 21], head: [3, 26], fe: [6, 18], fh: [8, 24], be: [4, 17], bh: [8, 20], fk: [7, 8], ff: [5, 0], bk: [-5, 5], bf: [-6, 0] },
  punch1: { hip: [0, 17], neck: [2, 29], head: [3, 34], fe: [9, 28], fh: [15, 28], be: [0, 23], bh: [4, 26], ...WIDE_LEGS },
  punch2: { hip: [1, 17], neck: [3, 29], head: [4, 34], be: [8, 27], bh: [15, 27], fe: [4, 23], fh: [6, 26], ...WIDE_LEGS },
  punch3: { hip: [0, 18], neck: [2, 30], head: [3, 35], fe: [9, 30], fh: [11, 40], be: [-2, 24], bh: [2, 27], fk: [5, 10], ff: [6, 0], bk: [-4, 8], bf: [-6, 0] },
  kick1: { hip: [-1, 18], neck: [-3, 30], head: [-3, 35], fe: [2, 25], fh: [5, 28], be: [-5, 24], bh: [-3, 27], fk: [8, 16], ff: [16, 14], bk: [-1, 9], bf: [-2, 0] },
  kick2: { hip: [-1, 18], neck: [-4, 29], head: [-5, 34], fe: [1, 24], fh: [3, 27], be: [-6, 23], bh: [-4, 26], fk: [8, 23], ff: [15, 29], bk: [-1, 9], bf: [-1, 0] },
  kick3: { hip: [0, 18], neck: [-3, 30], head: [-4, 35], fe: [-1, 26], fh: [-6, 28], be: [-4, 25], bh: [-8, 23], fk: [9, 21], ff: [18, 21], bk: [0, 9], bf: [0, 0] },
  jump: { hip: [0, 18], neck: [1, 30], head: [2, 35], fe: [5, 26], fh: [8, 30], be: [-1, 24], bh: [3, 28], fk: [5, 13], ff: [1, 8], bk: [-2, 11], bf: [-5, 6] },
  airkick: { hip: [0, 16], neck: [-2, 28], head: [-2, 33], fe: [3, 25], fh: [6, 28], be: [-4, 24], bh: [-6, 27], fk: [7, 11], ff: [14, 5], bk: [-3, 12], bf: [-6, 8] },
  dashpunch: { hip: [1, 15], neck: [5, 26], head: [7, 30], fe: [11, 25], fh: [17, 25], be: [1, 21], bh: [-3, 19], fk: [6, 7], ff: [9, 0], bk: [-4, 7], bf: [-9, 2] },
  slide: { hip: [0, 6], neck: [-7, 14], head: [-9, 18], fe: [-6, 10], fh: [-7, 3], be: [-8, 11], bh: [-11, 4], fk: [8, 4], ff: [16, 1], bk: [3, 8], bf: [6, 1] },
  hit: { hip: [-1, 17], neck: [-4, 28], head: [-6, 32], fe: [-1, 24], fh: [2, 20], be: [-6, 24], bh: [-9, 27], fk: [3, 9], ff: [4, 0], bk: [-4, 9], bf: [-6, 0] },
  launch: { hip: [0, 15], neck: [-6, 22], head: [-9, 25], fe: [-2, 20], fh: [2, 24], be: [-8, 20], bh: [-11, 24], fk: [4, 10], ff: [7, 4], bk: [2, 8], bf: [4, 2] },
  down: { hip: [-4, 3], neck: [-15, 3], head: [-20, 4], fe: [-10, 6], fh: [-8, 9], be: [-13, 2], bh: [-10, 1], fk: [2, 5], ff: [8, 1], bk: [2, 3], bf: [9, 0] },
  uppercut: { hip: [0, 18], neck: [2, 30], head: [3, 35], fe: [7, 37], fh: [8, 46], be: [-2, 24], bh: [2, 27], fk: [5, 11], ff: [6, 0], bk: [-4, 8], bf: [-6, 0] },
  upkick: { hip: [-1, 18], neck: [-4, 29], head: [-5, 34], fe: [1, 24], fh: [3, 27], be: [-6, 23], bh: [-4, 26], fk: [6, 27], ff: [9, 41], bk: [-1, 9], bf: [-1, 0] },
  win: { hip: [0, 17], neck: [0, 29], head: [0, 34], fe: [3, 36], fh: [4, 43], be: [-3, 23], bh: [-1, 19], ...STAND_LEGS },
};

// 기술: start 준비 시간, active 맞는 시간, recover 마무리 시간 / hit 공격 범위(앞쪽 x, 높이 y)
const MOVES = {
  A1: { pose: 'punch1', start: 0.05, active: 0.07, recover: 0.12, dmg: 5, kb: 50, stun: 0.2, hit: { x: [6, 17], y: [24, 32] }, next: 'A2', snd: 'punch' },
  A2: { pose: 'punch2', start: 0.06, active: 0.07, recover: 0.14, dmg: 6, kb: 60, stun: 0.28, hit: { x: [6, 17], y: [25, 31] }, next: 'A3', snd: 'punch' },
  A3: { pose: 'punch3', start: 0.09, active: 0.08, recover: 0.25, dmg: 10, kb: 70, stun: 0.5, hit: { x: [4, 15], y: [20, 42] }, launch: true, snd: 'kick' },
  B1: { pose: 'kick1', start: 0.07, active: 0.08, recover: 0.15, dmg: 7, kb: 70, stun: 0.26, hit: { x: [6, 19], y: [10, 19] }, next: 'B2', snd: 'kick' },
  B2: { pose: 'kick2', start: 0.08, active: 0.08, recover: 0.16, dmg: 8, kb: 70, stun: 0.32, hit: { x: [6, 18], y: [24, 32] }, next: 'B3', snd: 'kick' },
  B3: { pose: 'kick3', start: 0.12, active: 0.09, recover: 0.28, dmg: 12, kb: 90, stun: 0.5, hit: { x: [6, 20], y: [16, 26] }, launch: true, snd: 'kick' },
  DA: { pose: 'dashpunch', start: 0.05, active: 0.16, recover: 0.2, dmg: 8, kb: 80, stun: 0.35, hit: { x: [6, 18], y: [20, 30] }, dash: 120, snd: 'punch' },
  DB: { pose: 'slide', start: 0.05, active: 0.2, recover: 0.22, dmg: 9, kb: 60, stun: 0.35, hit: { x: [4, 18], y: [0, 8] }, dash: 130, launch: true, low: true, snd: 'kick' },
  // ↑ + A·B: 위로 띄우는 공격. 맞히면 바로 A·B로 이어서 공중 연속기(AAA, BBB) 가능 (cancel)
  UA: { pose: 'uppercut', start: 0.07, active: 0.08, recover: 0.16, dmg: 8, kb: 20, stun: 0.3, hit: { x: [4, 15], y: [20, 48] }, launch: true, lift: 230, cancel: true, snd: 'punch' },
  UB: { pose: 'upkick', start: 0.08, active: 0.09, recover: 0.17, dmg: 9, kb: 20, stun: 0.3, hit: { x: [4, 16], y: [14, 44] }, launch: true, lift: 230, cancel: true, snd: 'kick' },
  JA: { pose: 'airkick', start: 0.04, active: 0.25, recover: 0.1, dmg: 8, kb: 60, stun: 0.3, hit: { x: [4, 16], y: [2, 14] }, air: true, snd: 'kick' },
};

const AIR_MAX = 4;     // 공중 연속기는 띄우기 포함 4연속까지, 4번째에 멀리 날아감
const SEND_GAP = 0.05; // 내 캐릭터 상태를 보내는 간격 (초당 20번)

// net: 온라인 대전 방 (없으면 CPU 대전), names: [왼쪽, 오른쪽] 이름표
// 온라인 대전: 각자 자기 캐릭터를 자기 휴대폰에서 바로 움직이고, 상태만 서로 보냄
//  - 때린 사람이 '맞혔다'를 보내면, 맞은 사람 휴대폰이 막았는지/맞았는지 정하고 체력을 깎음
//  - 남은 시간은 방장 기준, 시간이 끝나면 방장이 결과를 정함
export function createFighter(canvas, { onScore, onGameOver, net = null, names = ['1P', 'CPU'] }) {
  const ctx = canvas.getContext('2d');
  const bg = makeBackground();
  const online = !!net;
  const isHost = online && net.role === 'host';
  const meIdx = online && !isHost ? 1 : 0; // 내 캐릭터: 0 왼쪽, 1 오른쪽
  let s, raf, last;
  let me, foe; // 내 캐릭터, 상대 캐릭터

  // ---------- 온라인 대전: 주고받는 내용 ----------
  let outEv = [], evId = 0, seenEv = 0;  // 보낼 사건(맞힘, KO, 시간 끝) / 이미 처리한 사건 번호
  let sendT = 0, seq = 0, lastRecv = -1;
  const sentAt = new Map();
  let ping = 0; // 왕복 시간(ms)

  if (online) net.onFoe((v) => { if (v && s) receive(v); });

  function sendNow() {
    const now = performance.now();
    outEv = outEv.filter((e) => now - e.at < 1500); // 사건은 1.5초 동안 계속 실어 보내 빠짐없이 전달
    const n = seq++;
    sentAt.set(n, now);
    if (sentAt.size > 60) sentAt.delete(sentAt.keys().next().value);
    net.send({
      n, an: lastRecv, f: packF(me),
      ev: outEv.map(({ at, ...e }) => e),
      tm: isHost ? Math.round(s.time * 10) / 10 : null,
    });
    sendT = SEND_GAP;
  }
  function sendEv(e) {
    outEv.push({ ...e, id: ++evId, at: performance.now() });
    sendNow(); // 사건은 바로 보냄
  }

  const packF = (f) => [Math.round(f.x * 10) / 10, Math.round(f.y * 10) / 10, f.face, f.state, f.move || 0,
    f.crouch ? 1 : 0, f.flash > 0 ? 1 : 0, f.hp, f.combo];

  // 상대가 보낸 상태 받기
  function receive(v) {
    if (v.n <= lastRecv && v.n > lastRecv - 1000) return; // 이미 받은 것
    lastRecv = v.n;
    if (sentAt.has(v.an)) ping = performance.now() - sentAt.get(v.an);

    const [x, y, face, state, move, crouch, flash, hp, combo] = v.f;
    const f = foe;
    if (state === 'attack' && move && (f.state !== 'attack' || f.move !== move)) play('swing');
    if (f.y > 0 && y <= 0 && f.state !== 'ko') pushFx({ type: 'dust', x, y: GROUND, t: 0.2 });
    Object.assign(f, { tx: x, ty: y, face, state, move: move || null, crouch: !!crouch, hp });
    if (flash) f.flash = 0.06;
    if (combo >= 2 && combo !== f.combo) s.comboText = { left: f === s.p, n: combo, t: 0.9 };
    f.combo = combo;
    if (Math.abs(f.x - x) > 40) { f.x = x; f.y = y; } // 너무 멀면 바로 맞춤

    // 들어온 사람은 남은 시간을 방장에 맞춤
    if (!isHost && v.tm != null && s.phase === 'fight') s.time = v.tm;

    for (const e of v.ev || []) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      if (s.over) continue;
      if (e.k === 'hit') takeHit(e);
      else if (e.k === 'ko') endRound('ko', me);
      else if (e.k === 'end') endRound('time', null, e.r);
    }
  }

  // 상대 캐릭터는 받은 위치를 부드럽게 따라감
  function followFoe(dt) {
    const f = foe;
    f.t += dt;
    if (f.flash > 0) f.flash -= dt;
    if (f.tx == null) return;
    f.x += (f.tx - f.x) * Math.min(1, dt * 20);
    f.y += (f.ty - f.y) * Math.min(1, dt * 30);
  }

  function play(name) { sfx[name](); }
  const vibe = (ms) => buzz(ms);
  function pushFx(e) { s.fx.push(e); }

  function newFighter(x, face, look) {
    return {
      x, y: 0, vx: 0, vy: 0, face, look, hp: MAX_HP, shownHp: MAX_HP,
      state: 'idle', move: null, mt: 0, hitDone: false, buffer: null, dashDir: 0,
      stun: 0, inv: 0, airAtk: false, crouch: false, flash: 0, t: 0, combo: 0,
    };
  }

  function reset() {
    s = {
      p: newFighter(45, 1, LOOK.p1),
      c: newFighter(115, -1, LOOK.cpu),
      time: ROUND_TIME, phase: 'ready', phaseT: 1.6, beeped: 0,
      score: 0, fx: [], shake: 0, freeze: 0, over: false, result: null, comboText: null,
      ai: { t: 0.6, clock: 0, held: {}, plan: [] },
    };
    me = meIdx ? s.c : s.p;
    foe = meIdx ? s.p : s.c;
    outEv = []; sendT = 0;
  }

  // ---------- 입력 ----------
  const EMPTY = { pressed: new Set() };

  function playerInput() {
    const h = pad.held;
    return { left: h.left, right: h.right, up: h.up, down: h.down, guard: h.D, pressed: consumePressed() };
  }

  // 컴퓨터: 거리와 상황을 보고 행동을 고름
  function aiInput(dt) {
    const ai = s.ai;
    const inp = { pressed: new Set() };
    ai.clock += dt;
    ai.plan = ai.plan.filter((pl) => {
      if (ai.clock >= pl.at) { inp.pressed.add(pl.key); return false; }
      return true;
    });
    ai.t -= dt;
    if (ai.t <= 0 && !ai.plan.length) aiDecide();
    return Object.assign(inp, ai.held);
  }

  function aiDecide() {
    const { ai, c, p } = s;
    ai.held = {};
    ai.clock = 0;
    const dist = Math.abs(p.x - c.x);
    const to = p.x > c.x ? 'right' : 'left';
    const away = to === 'right' ? 'left' : 'right';
    const r = Math.random();
    const presses = (key, times) => times.map((at) => ({ key, at }));

    // 상대가 때리려 하면 가끔 막음
    if (p.state === 'attack' && dist < 30 && r < 0.6) {
      // 하단 공격(달려가며 발차기)은 대체로 앉아서 막음
      const low = p.move && MOVES[p.move].low;
      ai.held = { guard: true, down: Math.random() < (low ? 0.7 : 0.3) };
      ai.t = 0.35 + Math.random() * 0.2;
      return;
    }
    if (dist > 34) {
      if (r < 0.12) { ai.held = { [to]: true }; ai.plan = presses('C', [0]); ai.t = 0.6; }
      else if (r < 0.3 && dist < 70) { ai.held = { [to]: true }; ai.plan = presses(Math.random() < 0.5 ? 'A' : 'B', [0]); ai.t = 0.5; }
      else { ai.held = { [to]: true }; ai.t = 0.25 + Math.random() * 0.25; }
      return;
    }
    if (r < 0.3) { ai.plan = presses('A', [0, 0.17, 0.34]); ai.t = 0.75; }
    else if (r < 0.5) { ai.plan = presses('B', [0, 0.2, 0.42]); ai.t = 0.9; }
    else if (r < 0.62) { ai.plan = presses('B', [0]); ai.t = 0.4; }
    else if (r < 0.72) { ai.held = { down: true }; ai.t = 0.35; }
    else if (r < 0.82) { ai.held = { [away]: true }; ai.t = 0.3; }
    else if (r < 0.86) { ai.held = { [to]: true }; ai.plan = [{ key: 'C', at: 0 }, { key: 'B', at: 0.2 }]; ai.t = 0.7; }
    // 띄우기 → 공중 연속기
    else if (r < 0.92) { const k = Math.random() < 0.5 ? 'A' : 'B'; ai.held = { up: true }; ai.plan = presses(k, [0, 0.2, 0.38, 0.58]); ai.t = 1.1; }
    else { ai.held = { guard: true }; ai.t = 0.4; }
  }

  // ---------- 캐릭터 움직임 ----------
  function startMove(f, name, dir = 0) {
    f.state = 'attack';
    f.move = name;
    f.mt = 0;
    f.hitDone = false;
    f.buffer = null;
    f.dashDir = dir;
    if (dir) f.face = dir;
    play('swing');
  }

  function freeControl(f, o, inp) {
    const P = inp.pressed;
    // 공중
    if (f.y > 0) {
      f.state = 'jump';
      if (!f.airAtk && (P.has('A') || P.has('B'))) { f.airAtk = true; startMove(f, 'JA'); }
      return;
    }
    f.face = o.x >= f.x ? 1 : -1;
    const dir = inp.left ? -1 : inp.right ? 1 : 0;

    if (P.has('C')) {
      f.vy = JUMP_V; f.y = 0.01; f.vx = dir * AIR_X;
      f.state = 'jump'; f.airAtk = false;
      play('jump');
      return;
    }
    if (P.has('A') || P.has('B')) {
      const k = P.has('A') ? 'A' : 'B';
      // ↑를 누른 채 공격하면 위로 띄우는 공격, ←/→를 누른 채 공격하면 달려가며 공격
      if (inp.up && !inp.down) startMove(f, 'U' + k);
      else if (dir && !inp.down) startMove(f, k === 'A' ? 'DA' : 'DB', dir);
      else startMove(f, k + '1');
      return;
    }
    if (inp.guard) { f.state = 'guard'; f.crouch = !!inp.down; f.vx = 0; return; }
    if (inp.down) { f.state = 'crouch'; f.vx = 0; return; }
    if (dir) { f.state = 'walk'; f.vx = dir * WALK * (dir === f.face ? 1 : 0.8); return; }
    f.state = 'idle'; f.vx = 0;
  }

  function stepAttack(f, o, inp, dt) {
    const mv = MOVES[f.move];
    f.mt += dt;
    // 연속기: 같은 버튼을 다시 누르면 다음 동작 예약
    if (mv.next && inp.pressed.has(mv.next[0]) && f.mt > mv.start * 0.5) f.buffer = mv.next;
    // 띄우기 공격이 맞았으면 A·B로 바로 연속기 시작
    if (mv.cancel && f.hitDone) {
      if (inp.pressed.has('A')) f.buffer = 'A1';
      else if (inp.pressed.has('B')) f.buffer = 'B1';
    }
    // 달려가며 공격
    if (mv.dash) f.vx = f.mt < mv.start + mv.active ? f.dashDir * mv.dash : f.vx * 0.8;
    else if (f.y <= 0) f.vx = 0;

    if (!f.hitDone && f.mt >= mv.start && f.mt < mv.start + mv.active) tryHit(f, o, mv);

    if (f.buffer && f.mt >= mv.start + mv.active) {
      const nx = f.buffer;
      startMove(f, nx);
      f.face = o.x >= f.x ? 1 : -1;
      return;
    }
    if (f.mt >= mv.start + mv.active + mv.recover) {
      f.state = f.y > 0 ? 'jump' : 'idle';
      f.move = null;
    }
  }

  function tryHit(f, o, mv) {
    const a1 = f.x + f.face * mv.hit.x[0], a2 = f.x + f.face * mv.hit.x[1];
    const ax1 = Math.min(a1, a2), ax2 = Math.max(a1, a2);
    const ay1 = f.y + mv.hit.y[0], ay2 = f.y + mv.hit.y[1];
    const crouching = o.state === 'crouch' || (o.state === 'guard' && o.crouch);
    const oh = o.state === 'down' || o.state === 'ko' ? 0 : crouching ? CROUCH_H : STAND_H;
    if (!oh || o.inv > 0) return;
    // 공중에 뜬 상대는 몸이 눕혀져 있어 아래쪽도 맞게 넓힘 (공중 연속기가 잘 이어지게)
    const by1 = o.state === 'launch' ? Math.max(0, o.y - 16) : o.y;
    const bx1 = o.x - BODY, bx2 = o.x + BODY, by2 = o.y + oh;
    if (ax2 < bx1 || ax1 > bx2 || ay2 < by1 || ay1 > by2) return;

    f.hitDone = true;
    // 상대가 벽에 붙어 있으면 때린 쪽이 대신 뒤로 밀려남 (구석에서 계속 붙어 때리지 못하게)
    if (o.x <= 14 || o.x >= W - 14) f.push = -f.face * (40 + mv.kb * 1.2);
    const hx = (Math.max(ax1, bx1) + Math.min(ax2, bx2)) / 2;
    const hy = GROUND - (Math.max(ay1, by1) + Math.min(ay2, by2)) / 2;

    if (online) {
      // 온라인: 맞혔다고 상대에게 알리고, 내 화면에는 바로 타격 효과를 보여 줌 (체력은 상대 휴대폰이 깎음)
      sendEv({ k: 'hit', m: f.move, x: Math.round(f.x * 10) / 10, y: Math.round(f.y), face: f.face });
      if (blocks(o, f.x, mv)) {
        pushFx({ type: 'spark', x: hx, y: hy, t: 0.18, block: true });
        s.freeze = 0.03;
        play('block');
      } else {
        o.flash = 0.08;
        pushFx({ type: 'spark', x: hx, y: hy, t: 0.2, big: !!mv.launch });
        s.freeze = mv.launch ? 0.08 : 0.05;
        if (mv.launch) s.shake = 0.2;
        play(mv.snd);
        vibe(mv.launch ? 30 : 15);
      }
      return;
    }
    applyHit(f, o, mv, hx, hy);
  }

  // 막기: 땅에서 상대를 보고 D를 누르고 있으면 막힘
  // 하단 공격(low)은 ↓ + D 로 앉아서 막아야만 막힘
  function blocks(o, fromX, mv) {
    const facing = Math.sign(fromX - o.x) === o.face;
    return o.state === 'guard' && o.y <= 0 && facing && (!mv.low || o.crouch);
  }

  // 맞은 쪽 처리. f: 때린 캐릭터 (온라인에서는 상대 캐릭터)
  function applyHit(f, o, mv, hx, hy, fromX = f.x, dir = f.face) {
    if (blocks(o, fromX, mv)) {
      o.vx = dir * mv.kb * 0.7;
      pushFx({ type: 'spark', x: hx, y: hy, t: 0.18, block: true });
      s.freeze = 0.03;
      play('block');
      return;
    }

    const chained = o.state === 'hit' || o.state === 'launch';
    o.combo = chained ? o.combo + 1 : 1;
    o.bounced = false; // 새로 맞으면 다시 벽에 튕길 수 있음
    o.hp = Math.max(0, o.hp - mv.dmg);
    o.flash = 0.08;
    o.move = null;
    if (o.hp <= 0) {
      o.state = 'ko'; o.vy = 170; o.y = Math.max(o.y, 0.01); o.vx = dir * 90;
      if (online) sendEv({ k: 'ko' });
      endRound('ko', f);
    } else if (o.y > 0 && o.combo >= AIR_MAX) {
      // 공중에서 4연속째(띄우기 + 3번)를 맞으면 무조건 멀리 날아감
      o.state = 'launch'; o.vy = 180; o.vx = dir * Math.max(mv.kb, 90);
    } else if (o.y > 0 && !(mv.launch && !mv.lift)) {
      // 공중 연속기: 살짝만 띄우고 덜 밀어서 다음 공격이 닿게 (띄우기 공격을 또 맞아도 높이 뜨지 않음)
      o.state = 'launch'; o.vy = Math.min(110, 60 + o.y * 0.5); o.vx = dir * mv.kb * 0.12; // 높이 떠 있을수록 덜 띄움
    } else if (mv.launch || o.y > 0) {
      o.state = 'launch'; o.vy = mv.lift || (mv.launch ? 180 : 120); o.y = Math.max(o.y, 0.01); o.vx = dir * mv.kb;
    } else {
      o.state = 'hit'; o.stun = mv.stun; o.vx = dir * mv.kb;
      // 벽에 붙은 채 센 공격(밀어내는 힘 70 이상)을 맞으면 벽에 부딪혀 튕겨 나옴
      const atWall = (dir > 0 && o.x >= W - 14) || (dir < 0 && o.x <= 14);
      if (atWall && mv.kb >= 70) wallBounce(o, -dir, true);
    }

    pushFx({ type: 'spark', x: hx, y: hy, t: 0.2, big: !!mv.launch });
    s.freeze = mv.launch ? 0.08 : 0.05;
    if (mv.launch) { s.shake = 0.2; }
    play(mv.snd);
    vibe(mv.launch ? 30 : 15);
    if (f === s.p && !online) { s.score += mv.dmg * 10; onScore(s.score); }
    if (o.combo >= 2) s.comboText = { left: f === s.p, n: o.combo, t: 0.9 };
  }

  // 온라인: 상대가 '맞혔다'고 보내면 내 휴대폰에서 지금 내 상태로 다시 확인하고 처리
  function takeHit(e) {
    const mv = MOVES[e.m];
    const o = me;
    if (!mv || o.state === 'down' || o.state === 'ko' || o.inv > 0) return;
    // 그사이 앉았다면 높은 공격은 머리 위로 지나감
    const crouching = o.state === 'crouch' || (o.state === 'guard' && o.crouch);
    if (crouching && e.y + mv.hit.y[0] > o.y + CROUCH_H) return;
    const mid = (mv.hit.y[0] + mv.hit.y[1]) / 2;
    const hx = o.x - e.face * 3;
    const hy = GROUND - Math.min(o.y + (crouching ? CROUCH_H : STAND_H) - 2, e.y + mid);
    applyHit(foe, o, mv, hx, hy, e.x, e.face);
  }

  function land(f) {
    f.bounced = false;
    if (f.state === 'launch') { f.state = 'down'; f.stun = 0.55; f.vx = 0; play('thud'); s.shake = Math.max(s.shake, 0.1); }
    else if (f.state === 'ko') { f.vx = 0; play('thud'); }
    else if (f.state === 'jump' || (f.state === 'attack' && MOVES[f.move]?.air)) { f.state = 'idle'; f.move = null; f.vx = 0; }
    pushFx({ type: 'dust', x: f.x, y: GROUND, t: 0.2 });
  }

  function physics(f, dt) {
    if (f.y > 0 || f.vy > 0) {
      f.vy -= GRAV * dt;
      f.y += f.vy * dt;
      if (f.y <= 0) { f.y = 0; f.vy = 0; land(f); }
    } else if (f.state !== 'walk' && !(f.state === 'attack' && MOVES[f.move]?.dash)) {
      f.vx *= Math.exp(-12 * dt);
    }
    // push: 구석에 몰린 상대를 때렸을 때 때린 쪽이 뒤로 밀려나는 힘
    if (f.push) { f.push *= Math.exp(-8 * dt); if (Math.abs(f.push) < 2) f.push = 0; }
    const nx = f.x + (f.vx + (f.push || 0)) * dt;
    f.x = Math.max(8, Math.min(W - 8, nx));
    if (nx < 8 || nx > W - 8) wallBounce(f, nx < 8 ? 1 : -1);
  }

  // 벽 튕기기: 세게 밀려 벽에 부딪히면 튕겨 나옴 (구석에만 갇히지 않게)
  // out: 벽에서 나오는 방향 (왼쪽 벽 1, 오른쪽 벽 -1)
  // force: 벽에 붙은 채 센 공격을 맞았을 때 바로 튕김
  function wallBounce(f, out, force = false) {
    if (f.bounced) return;
    const sp = Math.abs(f.vx);
    const air = f.state === 'launch' || f.state === 'ko';
    if (!force && !(air && sp > 30)) return;
    f.bounced = true;
    if (f.state === 'hit') f.state = 'launch';
    f.vx = out * Math.max(50, sp * 0.7);
    f.vy = Math.max(f.vy, f.state === 'ko' ? 90 : 120);
    f.y = Math.max(f.y, 0.01);
    pushFx({ type: 'spark', x: out > 0 ? 3 : W - 3, y: GROUND - f.y - 18, t: 0.2, big: true });
    pushFx({ type: 'dust', x: out > 0 ? 6 : W - 6, y: GROUND - f.y - 6, t: 0.2 });
    play('thud');
    s.shake = Math.max(s.shake, 0.15);
  }

  function stepFighter(f, o, inp, dt) {
    f.t += dt;
    if (f.inv > 0) f.inv -= dt;
    if (f.flash > 0) f.flash -= dt;
    switch (f.state) {
      case 'ko': case 'launch': break;
      case 'hit': if ((f.stun -= dt) <= 0) f.state = 'idle'; break;
      case 'down': if ((f.stun -= dt) <= 0) { f.state = 'idle'; f.inv = 0.4; } break;
      case 'attack': stepAttack(f, o, inp, dt); break;
      default: freeControl(f, o, inp);
    }
    physics(f, dt);
  }

  // 두 캐릭터가 겹치지 않게 밀어냄 (온라인에서는 각자 자기 캐릭터만 밀어냄)
  function separate() {
    const { p, c } = s;
    if ([p.state, c.state].some((st) => st === 'down' || st === 'ko')) return;
    const dx = c.x - p.x;
    const min = 12;
    if (Math.abs(dx) < min && Math.abs(p.y - c.y) < 30) {
      const push = (min - Math.abs(dx)) / 2;
      const sg = dx === 0 ? 1 : Math.sign(dx);
      if (!online || me === p) p.x = Math.max(8, Math.min(W - 8, p.x - sg * push));
      if (!online || me === c) c.x = Math.max(8, Math.min(W - 8, c.x + sg * push));
    }
  }

  // result: 온라인에서 방장이 정해 보낸 결과 (왼쪽 캐릭터 기준)
  function endRound(type, winner, result) {
    if (s.phase === 'end') return;
    s.phase = 'end';
    s.phaseT = 2.2;
    if (type === 'ko') {
      s.result = winner === s.p ? 'win' : 'lose';
      s.banner = 'KO!';
      play('ko');
      s.shake = 0.4;
    } else {
      s.result = result || (s.p.hp > s.c.hp ? 'win' : s.p.hp < s.c.hp ? 'lose' : 'draw');
      s.banner = '시간 끝';
      play('ko');
      if (online && isHost) sendEv({ k: 'end', r: s.result });
    }
  }

  function finish() {
    s.over = true;
    if (online) {
      // 결과는 왼쪽 캐릭터 기준이라, 오른쪽인 사람은 뒤집어서 보여 줌
      const mine = meIdx ? { win: 'lose', lose: 'win', draw: 'draw' }[s.result] : s.result;
      return onGameOver(0, { title: { win: '승리!', lose: '패배', draw: '무승부' }[mine], pvp: true }); // 온라인 대전은 점수 없음
    }
    const title = { win: '승리!', lose: '패배', draw: '무승부' }[s.result];
    if (s.result === 'win') s.score += 1000 + s.p.hp * 10 + Math.ceil(s.time) * 10;
    onScore(s.score);
    onGameOver(s.score, { title });
  }

  function update(dt) {
    // 맞는 순간 잠깐 멈춤 (손맛)
    if (s.freeze > 0) {
      s.freeze -= dt;
      if (online) followFoe(dt);
      return;
    }

    const pin = playerInput();
    let canAct = false;

    if (s.phase === 'ready') {
      s.phaseT -= dt;
      if (s.beeped === 0) { play('ready'); s.beeped = 1; }
      if (s.phaseT <= 0.5 && s.beeped === 1) { play('go'); s.beeped = 2; }
      if (s.phaseT <= 0) s.phase = 'fight';
    } else if (s.phase === 'fight') {
      canAct = true;
      s.time -= dt;
      // 시간 끝은 방장만 정함 (들어온 사람은 방장의 결과를 기다림)
      if (s.time <= 0) { s.time = 0; if (!online || isHost) endRound('time'); }
    } else if (s.phase === 'end') {
      s.phaseT -= dt;
      if (s.phaseT <= 0 && !s.over) return finish();
    }

    stepFighter(me, foe, canAct ? pin : EMPTY, dt);
    if (online) followFoe(dt);
    else stepFighter(foe, me, canAct ? aiInput(dt) : EMPTY, dt);
    separate();

    for (const f of [s.p, s.c]) {
      if (f.shownHp > f.hp) f.shownHp = Math.max(f.hp, f.shownHp - 40 * dt);
    }
    for (const fx of s.fx) fx.t -= dt;
    s.fx = s.fx.filter((fx) => fx.t > 0);
    if (s.shake > 0) s.shake -= dt;
    if (s.comboText && (s.comboText.t -= dt) <= 0) s.comboText = null;
  }

  // ---------- 그리기 ----------
  function poseOf(f) {
    if (f.state === 'ko') return f.y > 0 ? 'launch' : 'down';
    if (f.state === 'attack') return MOVES[f.move].pose;
    if (f.state === 'hit') return 'hit';
    if (f.state === 'launch') return 'launch';
    if (f.state === 'down') return 'down';
    if (f.y > 0) return 'jump';
    if (f.state === 'guard') return f.crouch ? 'crouchGuard' : 'guard';
    if (f.state === 'crouch') return 'crouch';
    if (f.state === 'walk') return Math.floor(f.t * 7) % 2 ? 'walk1' : 'walk2';
    if (s.phase === 'end' && ((s.result === 'win' && f === s.p) || (s.result === 'lose' && f === s.c))) return 'win';
    return Math.floor(f.t * 2.5) % 2 ? 'idle' : 'idle2';
  }

  // 두께 있는 선(팔다리)을 도트로 그림
  function seg(a, b, t, color) {
    ctx.fillStyle = color;
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n;
      const y = a[1] + ((b[1] - a[1]) * i) / n;
      ctx.fillRect(Math.round(x - t / 2), Math.round(y - t / 2), t, t);
    }
  }

  function drawFighter(f) {
    const P = POSES[poseOf(f)];
    const fl = f.flash > 0;
    const L = fl ? FLASH : f.look;
    const skin = fl ? '#fff' : SKIN, skinD = fl ? '#fff' : SKIN_D, hair = fl ? '#fff' : HAIR;
    const at = (p) => [f.x + f.face * p[0], GROUND - f.y - p[1]];
    const hip = at(P.hip), neck = at(P.neck), head = at(P.head);
    const sh = at([P.neck[0] - (P.neck[0] - P.hip[0]) * 0.12, P.neck[1] - 2]);
    const fe = at(P.fe), fh = at(P.fh), be = at(P.be), bh = at(P.bh);
    const fk = at(P.fk), ff = at(P.ff), bk = at(P.bk), bf = at(P.bf);

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    const sw = Math.max(6, 12 - f.y / 6);
    ctx.fillRect(Math.round(f.x - sw), GROUND, sw * 2, 2);

    const parts = [
      [sh, be, 3, L.shirtD], [be, bh, 3, skinD],
      [hip, bk, 4, L.pantsD], [bk, bf, 4, L.pantsD],
      [hip, neck, 8, L.shirt],
      [hip, fk, 4, L.pants], [fk, ff, 4, L.pants],
      [sh, fe, 3, L.shirt], [fe, fh, 3, skin],
    ];
    const fists = [[bh, skinD], [fh, skin]];
    const feet = [[bf, L.pantsD], [ff, L.pants]];

    // 1) 검은 테두리
    for (const [a, b, t] of parts) seg(a, b, t + 2, LINE);
    for (const [p] of fists) seg(p, p, 5, LINE);
    for (const [p] of feet) { ctx.fillStyle = LINE; ctx.fillRect(Math.round(p[0] - 3), Math.round(p[1] - 3), 7, 4); }
    ctx.fillStyle = LINE;
    ctx.fillRect(Math.round(head[0] - 4), Math.round(head[1] - 5), 9, 10);

    // 2) 색칠
    for (const [a, b, t, c] of parts) seg(a, b, t, c);
    for (const [p, c] of fists) seg(p, p, 3, c);
    for (const [p, c] of feet) { ctx.fillStyle = c; ctx.fillRect(Math.round(p[0] - 2), Math.round(p[1] - 2), 5, 2); }
    // 허리띠
    ctx.fillStyle = fl ? '#fff' : LINE;
    ctx.fillRect(Math.round(hip[0] - 4), Math.round(hip[1] - 1), 8, 2);
    // 머리: 피부, 머리카락, 머리띠, 눈
    const hx = Math.round(head[0]), hy = Math.round(head[1]);
    ctx.fillStyle = skin; ctx.fillRect(hx - 3, hy - 4, 7, 8);
    ctx.fillStyle = hair; ctx.fillRect(hx - 3, hy - 4, 7, 2);
    ctx.fillRect(f.face > 0 ? hx - 3 : hx + 2, hy - 4, 2, 5);
    ctx.fillStyle = L.band; ctx.fillRect(hx - 3, hy - 2, 7, 1);
    ctx.fillRect(f.face > 0 ? hx - 5 : hx + 4, hy - 2 + (Math.floor(f.t * 6) % 2), 2, 1); // 머리띠 꼬리
    if (!fl) {
      ctx.fillStyle = LINE;
      ctx.fillRect(hx + f.face * 2, hy - 1, 1, 2);
      if (f.state === 'ko' || f.state === 'down') { ctx.fillStyle = '#b13e53'; ctx.fillRect(hx + f.face * 1, hy + 2, 2, 1); }
    }
  }

  function drawFx() {
    for (const e of s.fx) {
      if (e.type === 'spark') {
        // 별 모양으로 퍼지는 타격 불꽃
        const k = 1 - e.t / (e.big ? 0.2 : 0.18);
        const len = (e.big ? 9 : 6) * (0.4 + k);
        const c1 = e.block ? PAL.B : PAL.Y, c2 = e.block ? PAL.W : PAL.W;
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 * i) / 8;
          const l = i % 2 ? len * 0.6 : len;
          for (let d = l * 0.4; d < l; d += 1) {
            ctx.fillStyle = d < l * 0.7 ? c2 : c1;
            ctx.fillRect(Math.round(e.x + Math.cos(a) * d), Math.round(e.y + Math.sin(a) * d), 1, 1);
          }
        }
        ctx.fillStyle = c2;
        ctx.fillRect(Math.round(e.x - 1), Math.round(e.y - 1), 3, 3);
      } else if (e.type === 'dust') {
        const r = 2 + (1 - e.t / 0.2) * 6;
        ctx.fillStyle = '#c2a37a';
        ctx.fillRect(Math.round(e.x - r - 2), e.y - 2, 2, 2);
        ctx.fillRect(Math.round(e.x + r), e.y - 2, 2, 2);
      }
    }
  }

  function text(str, x, y, size, color, align = 'center') {
    ctx.font = `${size}px Galmuri11, Galmuri9, monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = LINE; ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  function drawHud() {
    // 체력 바 (1P는 왼쪽, CPU는 오른쪽)
    const bars = [[s.p, 5, false], [s.c, 91, true]];
    for (const [f, x, rev] of bars) {
      const w = 64;
      ctx.fillStyle = LINE; ctx.fillRect(x - 1, 4, w + 2, 8);
      ctx.fillStyle = '#5d275d'; ctx.fillRect(x, 5, w, 6);
      const lost = Math.round((w * f.shownHp) / MAX_HP), now = Math.round((w * f.hp) / MAX_HP);
      ctx.fillStyle = PAL.R; ctx.fillRect(rev ? x + w - lost : x, 5, lost, 6);
      ctx.fillStyle = f.hp < 30 ? PAL.O : PAL.Y; ctx.fillRect(rev ? x + w - now : x, 5, now, 6);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(rev ? x + w - now : x, 5, now, 1);
    }
    // 이름표 (온라인 대전에서는 내 이름을 노란색으로)
    const nameColor = (i) => (net && i === meIdx ? PAL.Y : PAL.W);
    text(names[0], 6, 18, 8, nameColor(0), 'left');
    text(names[1], 154, 18, 8, nameColor(1), 'right');
    // 온라인 대전 시작 전에 내 캐릭터 머리 위에 '나' 표시
    if (net && s.phase === 'ready') {
      const f = meIdx ? s.c : s.p;
      text('▼나', f.x, GROUND - f.y - 46, 8, PAL.Y);
    }
    // 온라인 대전: 상대 화면이 얼마나 늦게 보이는지 (왕복 시간의 절반)
    if (online && ping) {
      const sec = ping / 2000;
      text(`지연 ${sec.toFixed(2)}초`, W / 2, H - 6, 8, sec < 0.1 ? PAL.G : sec < 0.2 ? PAL.Y : PAL.O);
    }
    // 남은 시간
    ctx.fillStyle = LINE; ctx.fillRect(71, 2, 18, 13);
    text(String(Math.ceil(s.time)), 80, 9, 10, s.time <= 10 ? PAL.O : PAL.W);

    if (s.comboText) {
      const c = s.comboText;
      text(`${c.n}연속!`, c.left ? 6 : 154, 28, 9, PAL.O, c.left ? 'left' : 'right');
    }

    // 가운데 큰 글자
    let big = null;
    if (s.phase === 'ready') big = s.phaseT > 0.5 ? '준비' : '시작!';
    if (s.phase === 'end') big = s.phaseT > 1.0 ? s.banner : { win: '승리!', lose: '패배', draw: '무승부' }[s.result];
    if (big) {
      ctx.fillStyle = 'rgba(13,14,24,.55)'; ctx.fillRect(0, 44, W, 22);
      text(big, W / 2, 55, 16, big === 'KO!' ? PAL.R : PAL.Y);
    }
  }

  function draw() {
    ctx.save();
    if (s.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));
    ctx.drawImage(bg, -4, -4);
    // 공격 중인 캐릭터를 앞에 그림
    const order = s.c.state === 'attack' ? [s.p, s.c] : [s.c, s.p];
    order.forEach(drawFighter);
    drawFx();
    ctx.restore();
    drawHud();
  }

  function loop(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    if (!s.over) update(dt);
    if (online && !s.over && (sendT -= dt) <= 0) sendNow();
    draw();
    if (!s.over) raf = requestAnimationFrame(loop);
  }

  reset();
  draw();

  return {
    start() {
      reset();
      resetPad();
      onScore(0);
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); },
  };
}

// 배경: 해 질 녘 도시 옥상 (한 번만 그려 두고 재사용)
function makeBackground() {
  const cv = document.createElement('canvas');
  cv.width = W + 8; cv.height = H + 8;
  const g = cv.getContext('2d');
  g.translate(4, 4);
  const bands = ['#1a1c2c', '#29366f', '#3b3b7a', '#5d275d', '#8a3354', '#b13e53', '#ef7d57'];
  bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(-4, -4 + i * 12, W + 8, 13); });
  // 해
  g.fillStyle = '#ffcd75'; g.fillRect(110, 62, 18, 8); g.fillRect(112, 60, 14, 2);
  // 별
  g.fillStyle = PAL.W;
  [[12, 22], [40, 14], [70, 26], [100, 10], [140, 20], [150, 34], [25, 38]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  // 건물 실루엣 (고정된 무작위)
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let x = -4; x < W + 4;) {
    const bw = 10 + Math.floor(rnd() * 14), bh = 18 + Math.floor(rnd() * 28);
    g.fillStyle = '#1f2650'; g.fillRect(x, 92 - bh, bw, bh);
    g.fillStyle = '#ffcd75';
    for (let wy = 92 - bh + 3; wy < 88; wy += 5) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (rnd() < 0.35) g.fillRect(wx, wy, 2, 2);
    x += bw + 1;
  }
  // 옥상 바닥
  g.fillStyle = '#5c3a28'; g.fillRect(-4, 92, W + 8, 4);
  g.fillStyle = '#8a5a3c'; g.fillRect(-4, 96, W + 8, H - 92);
  g.fillStyle = '#c2a37a'; g.fillRect(-4, 96, W + 8, 1);
  g.fillStyle = '#5c3a28';
  for (let y = 101; y < H + 4; y += 6) {
    g.fillRect(-4, y, W + 8, 1);
    for (let x = (y % 12 ? 0 : 10); x < W + 4; x += 20) g.fillRect(x, y - 5, 1, 5);
  }
  return cv;
}
