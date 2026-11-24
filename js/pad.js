// 게임기 모양 조작부 (방향키 + A/B/C/D 버튼) — 모든 게임에서 같이 쓰는 부품
import { unlockSound, buzz } from './sfx.js';

export const pad = {
  held: { left: false, right: false, up: false, down: false, A: false, B: false, C: false, D: false },
  pressed: new Set(), // 이번 화면에서 새로 눌린 버튼
};

function press(k) {
  if (!pad.held[k]) pad.pressed.add(k);
  pad.held[k] = true;
}
function release(k) { pad.held[k] = false; }

// 새로 눌린 버튼 목록을 꺼내고 비움
export function consumePressed() {
  const p = pad.pressed;
  pad.pressed = new Set();
  return p;
}

export function resetPad() {
  for (const k in pad.held) pad.held[k] = false;
  pad.pressed = new Set();
  document.querySelectorAll('#pad .on').forEach((e) => e.classList.remove('on'));
}

let ready = false;
export function initPad() {
  if (ready) return;
  ready = true;

  // 방향키: 누른 위치에 따라 ↑↓←→ 중 하나, 손가락을 밀면 방향이 바뀜
  const dpad = document.getElementById('dpad');
  let finger = null;
  let dir = null;
  const arm = (d) => dpad.querySelector(`[data-dir="${d}"]`);
  const setDir = (d) => {
    if (d === dir) return;
    if (dir) { release(dir); arm(dir).classList.remove('on'); }
    dir = d;
    if (d) { press(d); arm(d).classList.add('on'); buzz(5); }
  };
  const dirFrom = (e) => {
    const r = dpad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.08) return dir; // 가운데는 이전 방향 유지
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  };
  dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    unlockSound();
    finger = e.pointerId;
    dpad.setPointerCapture(e.pointerId);
    setDir(dirFrom(e));
  });
  dpad.addEventListener('pointermove', (e) => { if (e.pointerId === finger) setDir(dirFrom(e)); });
  const dpadUp = (e) => { if (e.pointerId === finger) { finger = null; setDir(null); } };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => dpad.addEventListener(ev, dpadUp));

  // A/B/C/D 버튼 (여러 손가락으로 동시에 눌러도 각각 인식)
  document.querySelectorAll('#pad .abtn').forEach((b) => {
    const k = b.dataset.key;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      unlockSound();
      b.setPointerCapture(e.pointerId);
      press(k);
      b.classList.add('on');
      buzz(8);
    });
    const up = () => { release(k); b.classList.remove('on'); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, up));
  });

  document.getElementById('pad').addEventListener('contextmenu', (e) => e.preventDefault());

  // PC 키보드: 방향키 / Z=A, X=B, C·스페이스=C, V=D
  const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', z: 'A', x: 'B', c: 'C', ' ': 'C', v: 'D' };
  window.addEventListener('keydown', (e) => {
    const k = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!k) return;
    if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
    if (!e.repeat) press(k);
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (k) release(k);
  });
}
