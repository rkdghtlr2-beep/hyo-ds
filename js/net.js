// 온라인 대전용 Firebase 연결 (실시간 데이터베이스 + 익명 로그인)
// 친구와 대전을 누를 때만 불러와서, 인터넷이 느려도 다른 게임에는 영향이 없게 함
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

async function connect() {
  if (fb) return fb;
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

  // 연결이 끊기면 서버가 알아서 정리
  if (role === 'host') onDisconnect(ref(db, base)).remove();
  else onDisconnect(r('guest')).remove();

  return {
    code, role,
    // 상대 정보: { nick } 또는 null (나감)
    onOpponent(cb) { listen(other, cb); },
    onRound(cb) { listen('round', cb); },
    onReady(cb) { listen('ready', (v) => cb(v || {})); },
    onState(cb) { listen('st', cb); },
    onInput(cb) { listen('in', cb); },
    sendState(v) { set(r('st'), v); },
    sendInput(v) { set(r('in'), v); },
    setRound(n) { update(ref(db, base), { round: n, ready: null, st: null }); },
    ready(n) { set(r(`ready/${role}`), n); },
    async leave() {
      subs.forEach((rf) => off(rf));
      subs.length = 0;
      try {
        if (role === 'host') await remove(ref(db, base));
        else await update(ref(db, base), { guest: null, in: null, [`ready/guest`]: null });
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
      if (cur) return; // 이미 쓰는 번호
      return { host: { nick, uid: fb.uid }, round: 0, at: Date.now() };
    });
    if (res.committed) return makeRoom(code, 'host');
  }
  throw new Error('방을 만들지 못했어요. 다시 시도해 주세요.');
}

// 방 들어가기
export async function joinRoom(code, nick) {
  await connect();
  const { db, ref, runTransaction } = fb;
  let full = false;
  // 처음에는 서버 값을 모른 채 빈 값으로 호출될 수 있어서, 빈 값이면 그대로 두고 서버 값으로 다시 확인함
  const res = await runTransaction(ref(db, `rooms/${code}`), (cur) => {
    if (!cur) return cur;
    if (cur.guest && cur.guest.uid !== fb.uid) { full = true; return; }
    cur.guest = { nick, uid: fb.uid };
    return cur;
  });
  if (full) throw new Error('이미 대전 중인 방이에요');
  const room = res.snapshot.val();
  if (!res.committed || !room || !room.host) throw new Error('없는 방 번호예요');
  return makeRoom(code, 'guest');
}
