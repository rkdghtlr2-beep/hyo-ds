// 효과음 (파일 없이 직접 소리를 만들어 냄)
let ac = null;

// 아이폰은 화면을 누른 순간에만 소리를 켤 수 있어서, 터치할 때마다 깨워 줌
export function unlockSound() {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch { ac = null; }
}

function tone(type, f1, f2, dur, vol, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol, cutoff) {
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  const f = ac.createBiquadFilter();
  const g = ac.createGain();
  src.buffer = buf;
  f.type = 'lowpass'; f.frequency.value = cutoff;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ac.destination);
  src.start();
}

export const sfx = {
  // 뿅! (올라갔다 내려가는 삑 소리 + 퍽)
  pyong(gold) {
    noise(0.06, 0.5, 900);
    tone('square', 700, gold ? 2400 : 1700, 0.05, 0.08);
    tone('square', gold ? 2400 : 1700, 500, 0.09, 0.06, 0.05);
    if (gold) tone('triangle', 1568, 2093, 0.12, 0.08, 0.08);
  },
  // 헛손질 (땅 치는 소리)
  miss() {
    noise(0.05, 0.3, 300);
    tone('triangle', 160, 70, 0.07, 0.15);
  },
  // 피버 시작 (땅이 우르릉)
  fever() {
    noise(0.9, 0.7, 140);
    tone('sawtooth', 70, 40, 0.8, 0.12);
    [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.09, 0.05, 0.1 + i * 0.08));
  },
  // 단계 바뀜 알림
  level() {
    tone('square', 880, 880, 0.06, 0.05);
    tone('square', 1175, 1175, 0.08, 0.05, 0.07);
  },
};

export const buzz = (p) => { try { navigator.vibrate?.(p); } catch {} };
