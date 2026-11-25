import { makeIcon, drawSprite, pixelEllipse, PAL } from './sprites.js';
import { createMole } from './games/mole.js';
import { createFighter } from './games/fighter.js';
import { createBungeo } from './games/bungeo.js';
import { initPad, resetPad } from './pad.js';
import { createRoom, joinRoom, submitScore, loadRanking, login, GM } from './net.js';

// 게임 화면 기본 크기 (세로형 휴대폰 비율)
const W = 180;
const H = 320;

// 게임 목록 (ready: false 는 준비 중)
// size: 게임 화면 크기, pad: 게임기 조작부(방향키·버튼) 사용
const GAMES = [
  { id: 'mole', name: '두더지 콩콩', ready: true, isNew: true, create: createMole,
    help: '30초 동안 8개 구멍에서\n나오는 두더지를 터치하세요.\n황금 두더지는 +30점!\n연속으로 맞히면 보너스!' },
  { id: 'fight', name: '도트 격투', ready: true, isNew: true, create: createFighter, size: [160, 120], pad: true, pvp: true,
    legend: 'A 주먹 · B 발차기 · C 점프 · D 막기',
    help: '1P vs CPU 대전!\n\n← → 이동 · ↓ 앉기\nAAA 주먹 연속기\nBBB 발 연속기\n← → 누른 채 A·B 돌진 공격\n↑ 누른 채 A·B 띄우기' },
  // 점수 = 번 돈 합계 (원)
  { id: 'bungeo', name: '붕어빵 타이쿤', ready: true, isNew: true, create: createBungeo, size: [1080, 1920], unit: '원',
    help: '빈 틀을 눌러 반죽, 한 번 더 눌러 속!\n노릇해지면 뒤집고, 또 노릇하면 꺼내기\n너무 오래 두면 타요\n\n손님을 눌러 주문대로 팔고\n하루(60초) 매출 목표를 채우세요\n날이 갈수록 손님이 까다로워져요\n장사가 끝나면 임대료! 못 내면 파산' },
  { id: 'dodge', name: '별똥별 피하기', ready: false },
  { id: 'jump', name: '폴짝 점프', ready: false },
  { id: 'rhythm', name: '박자 맞추기', ready: false },
  { id: 'number', name: '숫자 순서', ready: false },
  { id: 'stack', name: '블록 쌓기', ready: false },
];

const $ = (id) => document.getElementById(id);
// 점수 표시: 게임마다 단위가 다름 (기본 '점', 붕어빵은 '원')
const fmt = (g, n) => (g.unit === '원' ? n.toLocaleString('ko-KR') + '원' : n + '점');

// 기기 안 저장 (나중에 Firebase로 옮길 예정)
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
// 최고 기록은 계정마다 따로 (한 기기에서 여러 계정으로 로그인해도 섞이지 않게)
const bestKey = () => (store.get('acct') ? `best:${store.get('acct')}` : 'best');
const getBest = (id) => store.get(bestKey(), {})[id] || 0;
const setBest = (id, v) => { const b = store.get(bestKey(), {}); b[id] = v; store.set(bestKey(), b); };

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
      `<span class="best">${g.ready ? `최고 ${fmt(g, getBest(g.id))}` : '준비 중'}</span>` +
      (g.isNew ? '<span class="badge new">NEW</span>' : ''));
    li.onclick = () => (g.ready ? openGame(g) : toast('곧 추가될 게임이에요'));
    ul.appendChild(li);
  }
}

// 닉네임
function refreshNick() {
  const nick = store.get('nick', '플레이어');
  $('nickBtn').textContent = (nick === GM ? '🎮 ' : '👤 ') + nick;
}
// 로그인 창: 이름 + 비밀번호 4자리. 처음 쓰는 이름이면 계정이 새로 만들어짐
// acct: 로그인한 계정 이름 (없으면 아직 로그인 전)
function askNick() {
  $('nickInput').value = store.get('nick', '');
  $('nickPw').value = '';
  $('nickMsg').textContent = '';
  $('nickClose').classList.toggle('hidden', !store.get('acct')); // 로그인 전에는 닫을 수 없음
  $('nickModal').classList.remove('hidden');
  setTimeout(() => $(store.get('nick') ? 'nickPw' : 'nickInput').focus(), 50);
}
$('nickBtn').onclick = askNick;
$('nickClose').onclick = () => $('nickModal').classList.add('hidden');
$('nickFind').onclick = () => { $('nickMsg').textContent = '개발자에게 문의하세요'; };

let nickBusy = false;
$('nickSave').onclick = async () => {
  if (nickBusy) return;
  nickBusy = true;
  $('nickMsg').textContent = '확인하는 중…';
  try {
    const { nick, created } = await login($('nickInput').value, $('nickPw').value.trim());
    // 로그인 전에 이 기기에서 세운 최고 기록은 처음 로그인한 계정으로 옮김
    const legacy = store.get('best', null);
    store.set('nick', nick);
    store.set('acct', nick);
    if (legacy) {
      const b = store.get(bestKey(), {});
      for (const k in legacy) b[k] = Math.max(b[k] || 0, legacy[k]);
      store.set(bestKey(), b);
      try { localStorage.removeItem('best'); } catch {}
    }
    refreshNick();
    $('nickModal').classList.add('hidden');
    toast(created ? '새 계정을 만들었어요' : `${nick}님, 다시 오셨네요`);
    // 이 기기의 최고 기록을 함께 보는 순위에 올림
    GAMES.filter((g) => g.ready).forEach((g) => sendBest(g).catch(() => {}));
    renderList();
  } catch (e) {
    const m = e?.message || '';
    $('nickMsg').textContent = /[가-힣]/.test(m) ? m : '인터넷 연결을 확인해 주세요';
  } finally {
    nickBusy = false;
  }
};
$('nickPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('nickSave').onclick(); });

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
  const cw = canvas.width, ch = canvas.height;
  // 큰 캔버스(예: 붕어빵 1080×1920)가 화면 칸을 먼저 늘리지 않게, 잴 때는 잠시 0으로
  canvas.style.width = canvas.style.height = '0px';
  let fit;
  if ($('play').classList.contains('with-pad')) {
    // 게임기 화면: 가로폭에 맞추되 조작부 자리를 남겨 둠
    const bezel = document.querySelector('.screen-bezel');
    fit = Math.min((bezel.clientWidth - 16) / cw, (window.innerHeight * 0.42) / ch);
  } else {
    const st = $('stage');
    fit = Math.min(st.clientWidth / cw, st.clientHeight / ch);
  }
  const scale = fit >= 2 ? Math.floor(fit) : fit;
  canvas.style.width = cw * scale + 'px';
  canvas.style.height = ch * scale + 'px';
}
window.addEventListener('resize', fitCanvas);

// subs: 아래에 함께 보여 줄 보조 버튼 [{ label, onClick, keep }] (keep: 눌러도 안내창을 닫지 않음)
// btn 이 비어 있으면 큰 버튼을 숨김
function showOverlay(title, text, btn, onClick, subs = []) {
  $('ovTitle').textContent = title;
  $('ovText').textContent = text;
  $('ovBtn').classList.toggle('hidden', !btn);
  $('ovBtn').textContent = btn || '';
  $('ovBtn').onclick = () => { $('overlay').classList.add('hidden'); onClick(); };
  const row = $('ovSub');
  row.innerHTML = '';
  for (const sb of subs) {
    const b = document.createElement('button');
    b.className = 'btn btn-sub';
    b.textContent = sb.label;
    b.onclick = () => { if (!sb.keep) $('overlay').classList.add('hidden'); sb.onClick(); };
    row.appendChild(b);
  }
  row.classList.toggle('hidden', !subs.length);
  $('overlay').classList.remove('hidden');
}
const exitSub = { label: '나가기', onClick: () => $('backBtn').onclick() };

// 순위 창
// 순위 목록 그리기. isMe(r): 내 기록 줄인지
function drawRankList(g, list, isMe, emptyText = '아직 기록이 없어요') {
  const ol = $('rankList');
  ol.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = emptyText;
    ol.appendChild(li);
  }
  list.forEach((r, i) => {
    const li = document.createElement('li');
    if (isMe(r)) li.className = 'me';
    const no = document.createElement('span'); no.className = 'no'; no.textContent = i + 1;
    const who = document.createElement('span'); who.className = r.nick === GM ? 'who gm' : 'who'; who.textContent = r.nick;
    const pt = document.createElement('span'); pt.className = 'pt'; pt.textContent = fmt(g, r.score);
    li.append(no, who, pt);
    ol.appendChild(li);
  });
}

// 기록 올리기 (실패해도 게임에는 영향 없음, 다음에 순위를 열 때 다시 올림)
const sendBest = (g) => {
  const best = getBest(g.id), acct = store.get('acct');
  if (!acct) return Promise.reject(new Error('로그인 전'));
  return best > 0 ? submitScore(g.id, acct, best) : Promise.resolve();
};

// 순위 창: 모두가 함께 보는 순위 (한 사람당 최고 기록 1개). 인터넷이 안 되면 이 기기 기록을 보여 줌
let rankToken = 0;
async function showRank(g, highlightAt) {
  const token = ++rankToken;
  $('rankTitle').textContent = `${g.name} 순위`;
  $('rankNote').textContent = '모두가 함께 보는 순위예요 · 한 사람당 최고 기록 1개';
  drawRankList(g, [], () => false, '불러오는 중…');
  $('rankModal').classList.remove('hidden');
  try {
    await sendBest(g); // 이 기기의 최고 기록이 아직 안 올라갔으면 올림
    const list = await loadRanking(g.id, store.get('acct'));
    if (token === rankToken) drawRankList(g, list, (r) => r.me);
  } catch {
    if (token !== rankToken) return;
    $('rankNote').textContent = store.get('acct') ? '인터넷 연결이 안 돼 이 기기 기록만 보여요' : '로그인하면 함께 보는 순위에 올라가요';
    drawRankList(g, store.get('records', {})[g.id] || [], (r) => r.at === highlightAt);
  }
}
$('rankClose').onclick = () => $('rankModal').classList.add('hidden');

function openGame(g) {
  $('home').classList.remove('active');
  $('play').classList.add('active');
  $('playTitle').textContent = g.name;
  $('playScore').textContent = '0';
  const [cw, ch] = g.size || [W, H];
  canvas.width = cw; canvas.height = ch;
  $('play').classList.toggle('with-pad', !!g.pad);
  $('padLegend').textContent = g.legend || '';
  resetPad();
  fitCanvas();

  current?.stop();
  current = g.create(canvas, {
    onScore: (s) => { $('playScore').textContent = g.unit ? fmt(g, s) : s; },
    // meta.title: 게임이 정한 제목 (예: 격투의 '승리!', '패배'), meta.detail: 결과 창에 덧붙일 내용
    onGameOver: (s, meta = {}) => {
      const best = getBest(g.id);
      const isBest = s > best;
      if (isBest) setBest(g.id, s);
      const at = addRecord(g.id, s);
      if (isBest) sendBest(g).catch(() => {}); // 최고 기록이면 함께 보는 순위에 올림
      showOverlay(meta.title || (isBest ? '최고 기록!' : '게임 끝'),
        `${g.unit === '원' ? '번 돈' : '점수'} ${fmt(g, s)}\n최고 ${fmt(g, Math.max(s, best))}` + (meta.detail ? `\n\n${meta.detail}` : ''),
        '다시 하기', () => current.start(),
        [{ label: '순위 보기', onClick: () => showRank(g, at), keep: true }, exitSub]);
    },
  });
  const subs = g.pvp ? [{ label: '친구와 대전', onClick: () => openLobby(g) }] : [];
  showOverlay(g.name, g.help, g.pvp ? 'CPU와 대전' : '시작', () => current.start(), subs);
}

$('backBtn').onclick = () => {
  leaveRoom();
  current?.stop();
  current = null;
  $('overlay').classList.add('hidden');
  $('play').classList.remove('active');
  $('home').classList.add('active');
  renderList();
};

// ---------- 친구와 대전 (온라인) ----------
let room = null;       // 지금 들어가 있는 방
let lobbyBusy = false;

function leaveRoom() {
  if (!room) return;
  room.leave();
  room = null;
}

function lobbyView(waiting, msg = '') {
  $('pvpMenu').classList.toggle('hidden', waiting);
  $('pvpWait').classList.toggle('hidden', !waiting);
  $('pvpMsg').textContent = msg;
}

function openLobby(g) {
  if (!store.get('acct')) { openGame(g); return askNick(); } // 친구와 대전은 로그인해야 할 수 있음
  lobbyView(false);
  $('pvpWait').querySelector('.ov-text').textContent = '친구에게 방 번호를 알려 주세요.\n상대를 기다리는 중…';
  $('pvpCode').value = '';
  $('pvpModal').classList.remove('hidden');

  const nick = () => store.get('nick', '플레이어');
  const run = async (job, waitingText) => {
    if (lobbyBusy) return;
    lobbyBusy = true;
    $('pvpMsg').textContent = waitingText;
    try { await job(); } catch (e) {
      leaveRoom();
      const m = String(e?.code || e?.message || '');
      lobbyView(false,
        /permission/i.test(m) ? '접속 권한이 없어요. 관리자에게 알려 주세요.'
        : m.startsWith('auth/') ? '로그인 설정을 확인해 주세요'
        : /[가-힣]/.test(m) ? m : '연결하지 못했어요. 인터넷을 확인해 주세요.');
    }
    lobbyBusy = false;
  };

  $('pvpCreate').onclick = () => run(async () => {
    room = await createRoom(nick());
    $('pvpRoomCode').textContent = room.code;
    lobbyView(true);
    const r = room;
    // 친구가 들어오면 바로 시작
    r.onOpponent((op) => { if (room === r && op && !r.started) { r.started = true; startPvp(g, r, [nick(), op.nick]); } });
  }, '연결하는 중…');

  $('pvpJoin').onclick = () => {
    const code = $('pvpCode').value.trim();
    if (!/^\d{4}$/.test(code)) return lobbyView(false, '4자리 숫자를 입력해 주세요');
    run(async () => {
      room = await joinRoom(code, nick());
      const r = room;
      let hostNick = '';
      r.onOpponent((op) => { if (op) hostNick = op.nick; });
      // 방장이 경기를 시작하면 따라 시작
      r.onRound((n) => {
        if (room !== r || !n) return;
        if (!r.started) { r.started = true; startPvp(g, r, [hostNick || '방장', nick()]); }
        else if (n !== r.round) { r.round = n; $('overlay').classList.add('hidden'); current.start(); }
      });
      lobbyView(true, '');
      $('pvpRoomCode').textContent = code;
      $('pvpWait').querySelector('.ov-text').textContent = '방장이 시작하기를 기다리는 중…';
    }, '들어가는 중…');
  };

  $('pvpCancel').onclick = () => {
    leaveRoom();
    $('pvpModal').classList.add('hidden');
    openGame(g); // 처음 안내창으로 돌아감
  };
}

// 온라인 대전 시작: names [왼쪽(방장), 오른쪽(들어온 사람)]
function startPvp(g, r, names) {
  $('pvpModal').classList.add('hidden');
  $('overlay').classList.add('hidden');
  $('playScore').textContent = '';
  resetPad();
  current?.stop();
  r.round = 1;
  current = g.create(canvas, {
    net: r, names,
    onScore: () => {},
    onGameOver: (_, meta) => {
      if (room !== r) return;
      showOverlay(meta.title, `${names[0]} vs ${names[1]}`, '다시 하기', () => {
        // 둘 다 '다시 하기'를 누르면 새 경기
        r.ready(r.round + 1);
        showOverlay('다시 하기', '상대를 기다리는 중…', '', () => {}, [exitSub]);
      }, [exitSub]);
    },
  });

  // 상대가 나가면 알려 줌
  r.onOpponent((op) => {
    if (room !== r || op) return;
    const self = r;
    current?.stop();
    room = null;
    self.leave();
    showOverlay('대전 끝', '상대가 나갔어요', '확인', () => openGame(g));
  });

  if (r.role === 'host') {
    r.setRound(1);
    r.onReady((rd) => {
      const next = r.round + 1;
      if (room === r && rd.host === next && rd.guest === next) {
        r.round = next;
        r.setRound(next);
        $('overlay').classList.add('hidden');
        current.start();
      }
    });
  }
  current.start();
}

// 사파리에서 두 번 누르기·두 손가락으로 확대되는 것 막기
['gesturestart', 'gesturechange', 'dblclick'].forEach((ev) =>
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));

// 시작
initPad();
drawHero();
renderList();
refreshNick();
if (!store.get('acct')) askNick(); // 로그인 전이면 로그인 창부터
