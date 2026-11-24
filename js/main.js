import { makeIcon, drawSprite, pixelEllipse, PAL } from './sprites.js';
import { createMole } from './games/mole.js';

// 게임 화면 기본 크기 (세로형 휴대폰 비율)
const W = 180;
const H = 320;

// 게임 목록 (ready: false 는 준비 중)
const GAMES = [
  { id: 'mole', name: '두더지 콩콩', ready: true, isNew: true, create: createMole,
    help: '30초 동안 8개 구멍에서\n나오는 두더지를 터치하세요.\n황금 두더지는 +30점!\n연속으로 맞히면 보너스!' },
  { id: 'dodge', name: '별똥별 피하기', ready: false },
  { id: 'jump', name: '폴짝 점프', ready: false },
  { id: 'rhythm', name: '박자 맞추기', ready: false },
  { id: 'number', name: '숫자 순서', ready: false },
  { id: 'stack', name: '블록 쌓기', ready: false },
];

const $ = (id) => document.getElementById(id);

// 기기 안 저장 (나중에 Firebase로 옮길 예정)
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const getBest = (id) => store.get('best', {})[id] || 0;
const setBest = (id, v) => { const b = store.get('best', {}); b[id] = v; store.set('best', b); };

// 순위 기록 (게임별 상위 10개)
function addRecord(id, score) {
  const all = store.get('records', {});
  const rec = { nick: store.get('nick', '플레이어'), score, at: Date.now() };
  all[id] = [...(all[id] || []), rec].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 10);
  store.set('records', all);
  return rec.at;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 1600);
}

// 홈 화면 그림
function drawHero() {
  const ctx = $('heroArt').getContext('2d');
  ctx.fillStyle = PAL.B; ctx.fillRect(0, 0, 64, 10);
  ctx.fillStyle = PAL.E; ctx.fillRect(0, 10, 64, 22);
  ctx.fillStyle = PAL.G; ctx.fillRect(0, 10, 64, 1);
  ctx.fillStyle = PAL.W; ctx.fillRect(40, 3, 10, 3); ctx.fillRect(43, 2, 4, 1);
  // 구멍 두 개와 고개 내민 두더지
  [[16, 26, true], [46, 26, false]].forEach(([x, y, up]) => {
    pixelEllipse(ctx, x, y, 11, 3, PAL.K);
    if (up) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 64, y + 1); ctx.clip();
      drawSprite(ctx, 'mole', x - 8, y - 13);
      ctx.restore();
    }
    pixelEllipse(ctx, x, y, 11, 3, PAL.N, 'bottom');
  });
  drawSprite(ctx, 'hammer', 24, 2);
}

function renderList() {
  const ul = $('gameList');
  ul.innerHTML = '';
  for (const g of GAMES) {
    const li = document.createElement('li');
    li.className = 'game-card pixel-box' + (g.ready ? '' : ' locked');
    li.appendChild(makeIcon(g.id));
    li.insertAdjacentHTML('beforeend',
      `<span class="name">${g.name}</span>` +
      `<span class="best">${g.ready ? `최고 ${getBest(g.id)}점` : '준비 중'}</span>` +
      (g.isNew ? '<span class="badge new">NEW</span>' : ''));
    li.onclick = () => (g.ready ? openGame(g) : toast('곧 추가될 게임이에요'));
    ul.appendChild(li);
  }
}

// 닉네임
function refreshNick() { $('nickBtn').textContent = '👤 ' + store.get('nick', '플레이어'); }
function askNick() {
  $('nickInput').value = store.get('nick', '');
  $('nickModal').classList.remove('hidden');
  setTimeout(() => $('nickInput').focus(), 50);
}
$('nickBtn').onclick = askNick;
$('nickSave').onclick = () => {
  const v = $('nickInput').value.trim();
  if (!v) return toast('이름을 입력해 주세요');
  store.set('nick', v);
  refreshNick();
  $('nickModal').classList.add('hidden');
};

// 아래 메뉴
document.querySelectorAll('.tab').forEach((b) => {
  b.onclick = () => { if (b.dataset.tab !== 'home') toast('준비 중인 메뉴예요'); };
});

// 게임 화면
let current = null;
const canvas = $('gameCanvas');
canvas.width = W; canvas.height = H;

// 휴대폰 화면 크기에 맞춰 도트가 깨지지 않게 확대
function fitCanvas() {
  const st = $('stage');
  const fit = Math.min(st.clientWidth / W, st.clientHeight / H);
  const scale = fit >= 2 ? Math.floor(fit) : fit;
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
}
window.addEventListener('resize', fitCanvas);

// sub: true 이면 '순위 보기', '나가기' 버튼도 함께 보여 줌
function showOverlay(title, text, btn, onClick, sub = false) {
  $('ovTitle').textContent = title;
  $('ovText').textContent = text;
  $('ovBtn').textContent = btn;
  $('ovBtn').onclick = () => { $('overlay').classList.add('hidden'); onClick(); };
  $('ovSub').classList.toggle('hidden', !sub);
  $('overlay').classList.remove('hidden');
}

// 순위 창
function showRank(g, highlightAt) {
  $('rankTitle').textContent = `${g.name} 순위`;
  const ol = $('rankList');
  ol.innerHTML = '';
  const list = store.get('records', {})[g.id] || [];
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '아직 기록이 없어요';
    ol.appendChild(li);
  }
  list.forEach((r, i) => {
    const li = document.createElement('li');
    if (r.at === highlightAt) li.className = 'me';
    const no = document.createElement('span'); no.className = 'no'; no.textContent = i + 1;
    const who = document.createElement('span'); who.className = 'who'; who.textContent = r.nick;
    const pt = document.createElement('span'); pt.className = 'pt'; pt.textContent = r.score + '점';
    li.append(no, who, pt);
    ol.appendChild(li);
  });
  $('rankModal').classList.remove('hidden');
}
$('rankClose').onclick = () => $('rankModal').classList.add('hidden');

function openGame(g) {
  $('home').classList.remove('active');
  $('play').classList.add('active');
  $('playTitle').textContent = g.name;
  $('playScore').textContent = '0';
  fitCanvas();

  current = g.create(canvas, {
    onScore: (s) => { $('playScore').textContent = s; },
    onGameOver: (s) => {
      const best = getBest(g.id);
      const isBest = s > best;
      if (isBest) setBest(g.id, s);
      const at = addRecord(g.id, s);
      $('ovRank').onclick = () => showRank(g, at);
      showOverlay(isBest ? '최고 기록!' : '게임 끝',
        `점수 ${s}점\n최고 ${Math.max(s, best)}점`, '다시 하기', () => current.start(), true);
    },
  });
  showOverlay(g.name, g.help, '시작', () => current.start());
}

$('ovExit').onclick = () => $('backBtn').onclick();

$('backBtn').onclick = () => {
  current?.stop();
  current = null;
  $('overlay').classList.add('hidden');
  $('play').classList.remove('active');
  $('home').classList.add('active');
  renderList();
};

// 사파리에서 두 번 누르기·두 손가락으로 확대되는 것 막기
['gesturestart', 'gesturechange', 'dblclick'].forEach((ev) =>
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));

// 시작
drawHero();
renderList();
refreshNick();
if (!store.get('nick')) askNick();
