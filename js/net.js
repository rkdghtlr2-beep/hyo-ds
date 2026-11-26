// Firebase 연결 (실시간 데이터베이스 + 익명 로그인): 친구와 대전, 함께 보는 순위
// 필요할 때만 불러와서, 인터넷이 느려도 게임 자체에는 영향이 없게 함
const config = {
  apiKey: 'AIzaSyBciD3qrUhEGQx1Hvo6vIBlsNJOfn5Ak8g',
  authDomain: 'hyo-ds.firebaseapp.com',
  databaseURL: 'https://hyo-ds-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'hyo-ds',
  storageBucket: 'hyo-ds.firebasestorage.app',
  messagingSenderId: '991609802812',
  appId: '1:991609802812:web:eb5a79db7015c704647339',
};

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
let fb = null; // { db, uid, ...함수들 }
let connecting = null;

// 여러 곳에서 동시에 불러도 연결은 한 번만
function connect() {
  if (fb) return Promise.resolve(fb);
  if (!connecting) connecting = doConnect().catch((e) => { connecting = null; throw e; });
  return connecting;
}

async function doConnect() {
  const [{ initializeApp }, auth, d] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-database.js'),
  ]);
  const app = initializeApp(config);
  const a = auth.getAuth(app);
  const cred = await auth.signInAnonymously(a);
  fb = { db: d.getDatabase(app), uid: cred.user.uid, ...d };
  return fb;
}

// 방 하나를 다루는 도구 묶음
function makeRoom(code, role) {
  const { db, ref, set, update, remove, onValue, off, onDisconnect } = fb;
  const base = `rooms/${code}`;
  const r = (p) => ref(db, `${base}/${p}`);
  const subs = [];
  const listen = (p, cb) => { const rf = r(p); onValue(rf, (snap) => cb(snap.val())); subs.push(rf); };
  const other = role === 'host' ? 'guest' : 'host';

  // 연결 상태 표시 (on/host, on/guest)
  // 휴대폰 연결이 잠깐 끊겨도 방을 바로 지우지 않고 '끊김'으로만 표시 → 다시 연결되면 '연결됨'으로 되돌림
  // (예전에는 끊기는 순간 서버가 방을 지워서, 데이터가 잠깐만 흔들려도 대전이 튕겼음)
  const myOn = r(`on/${role}`);
  const connRef = ref(db, '.info/connected');
  onValue(connRef, (snap) => {
    if (snap.val() !== true) return;
    onDisconnect(myOn).set(false); // 다시 연결될 때마다 새로 걸어 둠 (한 번 실행되면 사라지므로)
    set(myOn, true);
  });
  subs.push(connRef);

  return {
    code, role,
    // 상대 정보: { nick } 또는 null (나감)
    onOpponent(cb) { listen(other, cb); },
    // 상대 연결 상태: true 연결됨, false 끊김, null 아직 모름
    onFoeOnline(cb) { listen(`on/${other}`, cb); },
    onRound(cb) { listen('round', cb); },
    onReady(cb) { listen('ready', (v) => cb(v || {})); },
    // 각자 자기 캐릭터 상태를 자기 칸(p0 방장, p1 들어온 사람)에 쓰고, 상대 칸을 읽음
    onFoe(cb) { listen(role === 'host' ? 'p1' : 'p0', cb); },
    send(v) { set(r(role === 'host' ? 'p0' : 'p1'), v); },
    setRound(n) { update(ref(db, base), { round: n, ready: null, at: Date.now() }); },
    ready(n) { set(r(`ready/${role}`), n); },
    async leave() {
      subs.forEach((rf) => off(rf));
      subs.length = 0;
      try {
        await onDisconnect(myOn).cancel(); // 나간 뒤에 빈 방 흔적이 다시 생기지 않게
        if (role === 'host') await remove(ref(db, base));
        else await update(ref(db, base), { guest: null, p1: null, 'ready/guest': null, 'on/guest': null });
      } catch {}
    },
  };
}

// 방 만들기: 비어 있는 4자리 번호를 찾아 차지함
export async function createRoom(nick) {
  await connect();
  const { db, ref, runTransaction } = fb;
  for (let i = 0; i < 8; i++) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    const res = await runTransaction(ref(db, `rooms/${code}`), (cur) => {
      // 이미 쓰는 번호 (단, 2시간 넘게 아무 움직임이 없는 방은 버려진 방으로 보고 새로 씀)
      if (cur && Date.now() - (cur.at || 0) < 2 * 3600e3) return;
      return { host: { nick, uid: fb.uid }, round: 0, at: Date.now() };
    });
    if (res.committed) return makeRoom(code, 'host');
  }
  throw new Error('방을 만들지 못했어요. 다시 시도해 주세요.');
}

// 방 들어가기
export async function joinRoom(code, nick) {
  await connect();
  const { db, ref, get, runTransaction } = fb;
  const room = (await get(ref(db, `rooms/${code}`))).val();
  if (!room || !room.host) throw new Error('없는 방 번호예요');
  if (room.on && room.on.host === false) throw new Error('방장이 연결되어 있지 않아요');
  // 내 자리(guest)만 씀 (방장 정보까지 다시 쓰면 규칙에서 남의 이름을 쓰는 것으로 막힘)
  let full = false;
  const res = await runTransaction(ref(db, `rooms/${code}/guest`), (cur) => {
    if (cur && cur.uid !== fb.uid) { full = true; return; }
    return { nick, uid: fb.uid };
  });
  if (full || !res.committed) throw new Error('이미 대전 중인 방이에요');
  return makeRoom(code, 'guest');
}

// ---------- 계정: 이름 + 비밀번호 4자리 ----------
// 휴대폰을 바꾸거나 브라우저 기록을 지워도 같은 이름·비밀번호로 로그인하면 기록이 이어짐
//  accounts/{이름}  : 계정이 있는지 (누구나 확인 가능)
//  secrets/{이름}   : 비밀번호 (아무도 읽을 수 없음, 처음 한 번만 쓸 수 있음)
//  sessions/{기기}  : 이 기기가 어느 계정으로 로그인했는지 (비밀번호가 맞아야 저장됨 → 규칙에서 확인)
// 운영자 이름 GM 은 Firebase 의 adminKey 와 같은 비밀번호로만 만들 수 있음
export const GM = 'GM';
export const isGmName = (v) => /^\s*g\s*m\s*$/i.test(v);
const keyOf = (nick) => (isGmName(nick) ? GM : nick.trim());
const denied = (e) => /permission/i.test(String(e?.code || e?.message));

// Firebase 화면에서 숫자만 넣은 값은 숫자로 저장되므로, 글자로 한 번·숫자로 한 번 시도
async function tryPin(pin, write) {
  for (const v of [pin, Number(pin)]) {
    try { await write(v); return true; } catch (e) { if (!denied(e)) throw e; }
  }
  return false;
}

// 로그인 (처음 쓰는 이름이면 계정을 새로 만듦). 결과: { nick, created }
export async function login(name, pin) {
  const nick = keyOf(name);
  if (!nick) throw new Error('이름을 입력해 주세요');
  if (/[.#$[\]/]/.test(nick)) throw new Error('이름에 . # $ [ ] / 는 쓸 수 없어요');
  if (!/^\d{4}$/.test(pin)) throw new Error('비밀번호는 숫자 4자리예요');
  await connect();
  const { db, ref, get, set } = fb;
  let created = false;
  if (!(await get(ref(db, `accounts/${nick}`))).exists()) {
    const made = await tryPin(pin, (v) => set(ref(db, `secrets/${nick}`), v));
    if (!made && nick === GM) throw new Error('운영자만 쓸 수 있는 이름이에요');
    if (made) {
      await set(ref(db, `accounts/${nick}`), { at: Date.now() });
      created = true;
    }
  }
  const ok = await tryPin(pin, (v) => set(ref(db, `sessions/${fb.uid}`), { nick, pin: v }));
  if (!ok) throw new Error(nick === GM ? '운영자 비밀번호가 맞지 않아요' : '비밀번호가 맞지 않아요');
  return { nick, created };
}

// ---------- 함께 보는 순위 ----------
// rankings/{게임}/{이름} = { nick, score, at } — 한 사람당 그 게임 최고 기록 1개만 남김

// 기록 올리기: 더 높은 점수일 때만 바꿈
export async function submitScore(game, nick, score) {
  await connect();
  const { db, ref, runTransaction } = fb;
  await runTransaction(ref(db, `rankings/${game}/${nick}`), (cur) => {
    if (cur && cur.score >= score) return;
    return { nick, score, at: Date.now() };
  });
}

// 순위 불러오기: 점수 높은 순 상위 10명, me 는 내 기록 줄 표시용
export async function loadRanking(game, myNick) {
  await connect();
  const { db, ref, get, query, orderByChild, limitToLast } = fb;
  const snap = await get(query(ref(db, `rankings/${game}`), orderByChild('score'), limitToLast(10)));
  const list = [];
  snap.forEach((c) => { list.push({ ...c.val(), me: c.key === myNick }); });
  list.sort((a, b) => b.score - a.score || a.at - b.at);
  return list;
}
