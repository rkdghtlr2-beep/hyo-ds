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
  // 격투: 휘두르는 소리
  swing() { noise(0.05, 0.12, 2500); },
  // 격투: 주먹 맞음
  punch() {
    noise(0.07, 0.6, 1200);
    tone('square', 220, 90, 0.07, 0.08);
  },
  // 격투: 발차기 맞음 (더 묵직하게)
  kick() {
    noise(0.1, 0.7, 700);
    tone('square', 160, 55, 0.1, 0.1);
  },
  // 격투: 막음
  block() {
    tone('square', 1400, 1100, 0.04, 0.05);
    noise(0.04, 0.25, 3000);
  },
  jump() { tone('square', 300, 600, 0.08, 0.04); },
  // 격투: 바닥에 쓰러짐
  thud() {
    noise(0.12, 0.6, 250);
    tone('triangle', 110, 45, 0.12, 0.15);
  },
  // 격투: 준비, 시작, KO
  ready() { tone('square', 660, 660, 0.08, 0.05); },
  go() { tone('square', 880, 1320, 0.15, 0.06); },
  ko() {
    noise(0.3, 0.6, 400);
    [784, 659, 523, 392].forEach((f, i) => tone('square', f, f * 0.98, 0.12, 0.06, 0.15 + i * 0.12));
  },
  // 펭귄: 폴짝 (뿅 하고 올라가는 소리)
  hop() { tone('square', 420, 900, 0.09, 0.05); },
  // 펭귄: 얼음에 착지 (톡)
  plop() {
    noise(0.04, 0.25, 1800);
    tone('triangle', 520, 380, 0.06, 0.1);
  },
  // 펭귄: 퍼펙트 착지 (반짝)
  perfect() {
    tone('square', 1047, 1047, 0.06, 0.05);
    tone('square', 1568, 1568, 0.1, 0.05, 0.06);
  },
  // 펭귄: 얼음 갈라짐 (빠직)
  crack() { noise(0.05, 0.35, 2600); },
  // 펭귄: 바다에 퐁당
  splash() {
    noise(0.35, 0.6, 600);
    tone('sine', 300, 90, 0.25, 0.12);
  },
  // 토끼: 당근 먹음 (냠)
  carrot() {
    tone('square', 880, 1320, 0.06, 0.05);
    tone('square', 1320, 1760, 0.08, 0.05, 0.06);
  },
  // 토끼: 별똥별이 땅에 떨어짐 (작게 퍽)
  boom() { noise(0.12, 0.18, 500); },
  // 토끼: 아슬아슬하게 피함 (휙)
  whoosh() { noise(0.1, 0.25, 3500); },
  // 단계 바뀜 알림
  level() {
    tone('square', 880, 880, 0.06, 0.05);
    tone('square', 1175, 1175, 0.08, 0.05, 0.07);
  },
};

export const buzz = (p) => { try { navigator.vibrate?.(p); } catch {} };
