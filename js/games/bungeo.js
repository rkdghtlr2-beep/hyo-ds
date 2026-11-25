// 붕어빵 타이쿤: 붕어빵을 구워 손님에게 팔고, 하루 매출 목표와 임대료를 버텨 내는 가게 운영 게임
// (Hyo-ToDo 에 있던 게임을 HyoDS 로 옮겨 옴)
// 그림은 270×480 '픽셀' 해상도로 그린 뒤 4배로 키워 1080×1920 캔버스에 찍음 (도트가 뭉개지지 않게)
// 점수 = 파산하거나 목표를 못 채울 때까지 번 돈 합계
import { sfx, unlockSound } from '../sfx.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createBungeo(canvas, { onScore, onGameOver }) {
  // 그림은 270×480 '픽셀' 해상도로 그린 뒤 4배로 키워 1080×1920 캔버스에 찍음 (도트가 뭉개지지 않게)
  // 글씨는 읽기 쉽도록 큰 캔버스 위에 따로 씀.
  // 틀 하나의 흐름: 빈 틀 → 반죽 → (속 넣으면) 앞면 굽기 → 뒤집기 → 뒷면 굽기 → 꺼내기
  // 굽기 정도 p: 0~1 덜 익음, 1~1.4 완벽, 1.4~2 진해짐(위험), 2 이상 탐
  const BB_W = 270;
  const BB_H = 480;
  const BB_PX = 4; // 270×480 × 4 = 1080×1920
  const BB_PRICE = { red: 1000, cream: 1200 };
  const BB_NAME = { red: "팥", cream: "슈크림" };
  const BB_DAY_SECONDS = 60;
  const BB_SIDE_SECONDS = 4; // 화력 1단계에서 한 면이 노릇해지는 시간
  const BB_FONT = '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

  const bbCanvas = canvas;
  const bbCtx = bbCanvas.getContext("2d");
  const bbArt = document.createElement("canvas"); // 저해상도 그림판
  bbArt.width = BB_W;
  bbArt.height = BB_H;
  const art = bbArt.getContext("2d");
  art.imageSmoothingEnabled = false;

  const bb = {
    running: false,
    paused: false,
    overlay: null, // 시작·결과·일시정지 창
    day: 1,
    bank: 0,
    earn: 0,
    time: BB_DAY_SECONDS,
    molds: [],
    customers: [],
    tray: { red: 0, cream: 0 },
    trayBump: { red: 0, cream: 0 },
    filling: "red",
    moldCount: 4,
    heat: 1,
    patienceBoost: 0,
    served: 0,
    angry: 0,
    burnt: 0,
    spawnIn: 1.5,
    pops: [],
    smoke: [],
    total: 0, // 지금까지 번 돈 합계 (= 점수)
  };
  // 난이도: 날이 갈수록 목표·임대료가 크게 오르고, 손님은 급해지고 주문은 많아지고, 붕어빵은 빨리 탐
  // (보통 3~5일차에 끝나도록 맞춤)
  const round500 = (n) => Math.round(n / 500) * 500;
  const bbGoal = (day) => round500(5000 * 1.5 ** (day - 1));        // 5,000 → 7,500 → 11,000 → 17,000 …
  // 하루 장사가 끝나면 모은 돈에서 임대료를 냄. 못 내면 파산.
  const bbRent = (day) => round500(2000 * 1.7 ** (day - 1));        // 2,000 → 3,500 → 6,000 → 10,000 …
  const bbPatience = (day) => Math.max(8, 30 - (day - 1) * 5);      // 손님 기다리는 시간(초)
  const bbMaxOrder = (day) => Math.min(6, 1 + day);                 // 한 손님 최대 주문 개수
  const bbGap = (day) => Math.max(2, 6.5 - (day - 1) * 1.2);       // 손님이 오는 간격(초)
  const bbBurnSpeed = (day) => 1 + (day - 1) * 0.35;                // 노릇해진 뒤 타는 속도 배수
  const fmtWon = (n) => n.toLocaleString("ko-KR");

  // ---------- 색 도우미 ----------
  const hexRgb = (h) => h.match(/\w\w/g).map((v) => parseInt(v, 16));
  const rgbHex = (a) => "#" + a.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
  const shade = (h, k) => rgbHex(hexRgb(h).map((v) => v * k));
  const mix = (a, b, t) => {
    const pa = hexRgb(a), pb = hexRgb(b);
    return rgbHex(pa.map((v, i) => v + (pb[i] - v) * clamp(t, 0, 1)));
  };
  function fishColor(p) {
    const q = Math.round(p * 20) / 20; // 색 단계를 나눠 스프라이트 캐시가 너무 커지지 않게
    if (q < 1) return mix("#f6e7b8", "#e3a54a", q);
    if (q < 2) return mix("#e3a54a", "#7a4520", q - 1);
    return "#3a2316";
  }

  // ---------- 픽셀 스프라이트 ----------
  // 문자 하나 = 픽셀 하나, '.' = 투명. pal 로 문자 → 색. outline 색을 주면 테두리를 자동으로 그림.
  const FISH = [
    ".......oooooooo........ooo",
    ".....oobbbbbbbboo.....obbo",
    "...oobblbbbbbbbbboo..obbbo",
    "..obblllbbdbbdbbdbboobbbo.",
    ".obbelbbbdbbdbbdbbbbbbbo..",
    "obbbbbbbbdbbdbbdbbbbbbo...",
    "obbbbbbbbdbbdbbdbbbbbbo...",
    ".obbbbbbbdbbdbbdbbbbbbbo..",
    "..obbbbbbbdbbdbbdbboobbbo.",
    "...oobbbbbbbbbbbbboo..obbbo",
    ".....oobbbbbbbboo.....obbo",
    ".......oooooooo........ooo",
  ];
  const MINI_FISH = [
    ".bbbb..b",
    "bebbbbbb",
    "bbbbbbb.",
    "bbbbbbbb",
    ".bbbb..b",
  ];
  const PERSON = [
    "...hhhhhh...",
    "..hhhhhhhh..",
    ".hhhhhhhhhh.",
    ".hssssssssh.",
    ".ssessssess.",
    ".ssssssssss.",
    ".ssssmmssss.",
    "..ssssssss..",
    "....ssss....",
    "..cccccccc..",
    ".cccccccccc.",
    "cccccccccccc",
    "cccccccccccc",
    "sccccccccccs",
    "sccccccccccs",
    ".cccccccccc.",
    ".pppppppppp.",
    ".pppp..pppp.",
    ".pppp..pppp.",
    ".ooo....ooo.",
  ];

  const spriteCache = new Map();
  function makeSprite(rows, pal, outline) {
    const key = rows.length + rows[0] + JSON.stringify(pal) + outline;
    let c = spriteCache.get(key);
    if (c) return c;
    if (spriteCache.size > 400) spriteCache.clear();
    const w = Math.max(...rows.map((r) => r.length)) + 2;
    const h = rows.length + 2;
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    const filled = (x, y) => rows[y] && rows[y][x] && rows[y][x] !== "." && pal[rows[y][x]];
    if (outline) {
      g.fillStyle = outline;
      rows.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) {
          if (!filled(x, y)) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (!filled(x + dx, y + dy)) g.fillRect(x + 1 + dx, y + 1 + dy, 1, 1);
          }
        }
      });
    }
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const col = filled(x, y);
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x + 1, y + 1, 1, 1);
      }
    });
    spriteCache.set(key, c);
    return c;
  }
  function sprite(rows, pal, x, y, scale = 1, outline = null, squashY = 1) {
    const s = makeSprite(rows, pal, outline);
    const h = Math.max(1, Math.round(s.height * scale * squashY));
    art.drawImage(s, Math.round(x), Math.round(y + (s.height * scale - h) / 2), s.width * scale, h);
    return s;
  }

  // ---------- 그리기 도우미 ----------
  const rect = (x, y, w, h, c) => {
    art.fillStyle = c;
    art.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  // 모서리가 깎인 픽셀 상자
  function pbox(x, y, w, h, fill, border, light) {
    rect(x + 1, y, w - 2, h, border);
    rect(x, y + 1, w, h - 2, border);
    rect(x + 1, y + 1, w - 2, h - 2, fill);
    if (light) rect(x + 2, y + 1, w - 4, 1, light);
  }

  let bbTexts = [];
  function txt(t, x, y, o = {}) {
    bbTexts.push({ t: String(t), x, y, size: o.size || 8, color: o.color || "#fff", align: o.align || "left", stroke: o.stroke === undefined ? "#2a1d14" : o.stroke, weight: o.weight || 800 });
  }
  function flushTexts() {
    bbCtx.textBaseline = "middle";
    for (const t of bbTexts) {
      bbCtx.font = `${t.weight} ${t.size * BB_PX}px ${BB_FONT}`;
      bbCtx.textAlign = t.align;
      const X = t.x * BB_PX, Y = t.y * BB_PX;
      if (t.stroke) {
        bbCtx.lineJoin = "round";
        bbCtx.lineWidth = BB_PX * 1.6;
        bbCtx.strokeStyle = t.stroke;
        bbCtx.strokeText(t.t, X, Y);
      }
      bbCtx.fillStyle = t.color;
      bbCtx.fillText(t.t, X, Y);
    }
    bbTexts = [];
  }

  let bbHits = [];
  const hit = (x, y, w, h, fn) => bbHits.push({ x, y, w, h, fn });

  // 저해상도 그림 → 큰 캔버스로 + 글씨
  function blit() {
    bbCtx.imageSmoothingEnabled = false;
    bbCtx.drawImage(bbArt, 0, 0, BB_W * BB_PX, BB_H * BB_PX);
    flushTexts();
  }

  // ---------- 화면 구성 ----------
  const SLOT_X = [10, 74, 138, 202];

  function drawHud() {
    rect(0, 0, BB_W, 52, "#3b2a20");
    rect(0, 52, BB_W, 2, "#22160f");
    for (let x = 0; x < BB_W; x += 30) rect(x, 0, 1, 52, "#33241b");
    txt(`${bb.day}일차`, 8, 13, { size: 10, color: "#ffd98a" });
    txt(`임대료 ${fmtWon(bbRent(bb.day))}원`, 234, 13, { size: 6.5, align: "right", color: "#ffb39a" });
    txt(`남은 시간 ${Math.ceil(bb.time)}초`, 130, 13, { size: 9, align: "center", color: bb.time < 10 && bb.running ? "#ff8a65" : "#fff" });
    // 일시정지 버튼
    pbox(240, 4, 24, 18, "#5a4030", "#1b120c", "#7a5a44");
    if (bb.paused || !bb.running) {
      for (let i = 0; i < 5; i++) rect(249 + i, 8 + i, 1, 10 - i * 2, "#fff");
    } else {
      rect(247, 8, 3, 10, "#fff");
      rect(254, 8, 3, 10, "#fff");
    }
    hit(240, 4, 24, 18, () => setBbPaused(!bb.paused));

    txt(`오늘 ${fmtWon(bb.earn)} / ${fmtWon(bbGoal(bb.day))}원`, 8, 32, { size: 7.5 });
    txt(`모은 돈 ${fmtWon(bb.bank)}원`, 262, 32, { size: 7.5, align: "right", color: "#ffe9a8" });
    const ratio = Math.min(1, bb.earn / bbGoal(bb.day));
    pbox(8, 41, 254, 8, "#22160f", "#1b120c");
    if (ratio > 0) rect(9, 42, Math.max(1, 252 * ratio), 6, ratio >= 1 ? "#58c48b" : "#f5a623");
    if (ratio > 0) rect(9, 42, Math.max(1, 252 * ratio), 1, ratio >= 1 ? "#8fe0b2" : "#ffd27a");
  }

  function drawShop(now) {
    // 벽
    rect(0, 54, BB_W, 116, "#f4d9b0");
    for (let x = 6; x < BB_W; x += 18) rect(x, 54, 1, 116, "#e8c79a");
    // 차양 (빨강·흰 줄무늬 + 물결 끝)
    for (let i = 0; i < 18; i++) {
      const c = i % 2 ? "#fff3e0" : "#d9483b";
      rect(i * 15, 54, 15, 12, c);
      rect(i * 15 + 2, 66, 11, 2, c);
      rect(i * 15 + 4, 68, 7, 2, c);
    }
    rect(0, 54, BB_W, 2, "#a8322a");
    // 가게 이름판
    pbox(75, 74, 120, 14, "#7a4a2a", "#3b2a20", "#9a6a44");
    txt("효식이네 붕어빵", 135, 81, { size: 7, align: "center", color: "#ffe9a8" });

    // 손님
    for (const c of bb.customers) drawCustomer(c, now);
    if (!bb.customers.length) {
      txt(bb.running ? "손님을 기다리는 중…" : "가게 문이 닫혀 있어요", 135, 132, { size: 7.5, align: "center", color: "#b08560", stroke: null });
    }

    // 카운터
    rect(0, 166, BB_W, 4, "#c98a55");
    rect(0, 170, BB_W, 26, "#8a5530");
    rect(0, 170, BB_W, 1, "#a8683c");
    for (let x = 0; x < BB_W; x += 27) rect(x, 171, 1, 25, "#6f4224");
    rect(0, 196, BB_W, 2, "#4a2c18");
  }

  function drawCustomer(c, now) {
    const r = c.patience / c.max;
    const angry = r < 0.25 && !c.leaving;
    const shake = angry ? Math.round(Math.sin(now / 40)) : 0;
    const bob = Math.round(Math.abs(Math.sin(now / 300 + c.seed)) * 1);
    const x = Math.round(c.x) + shake;
    const pal = { ...c.pal, s: angry ? mix(c.pal.s, "#ff6b6b", 0.45) : c.pal.s };
    sprite(PERSON, pal, x, 128 - bob, 2, "#1b1420");

    // 말풍선
    const cx = x + 14;
    const bw = 58, bh = c.order.red && c.order.cream ? 26 : 16;
    const bx = clamp(cx - bw / 2, 2, BB_W - bw - 2), by = 118 - bh - 6;
    pbox(bx, by, bw, bh, "#ffffff", "#2a1d14");
    rect(cx - 2, by + bh - 1, 5, 2, "#ffffff");
    rect(cx - 1, by + bh + 1, 3, 2, "#ffffff");
    rect(cx - 3, by + bh, 1, 2, "#2a1d14");
    rect(cx + 3, by + bh, 1, 2, "#2a1d14");
    rect(cx - 2, by + bh + 2, 1, 1, "#2a1d14");
    rect(cx + 2, by + bh + 2, 1, 1, "#2a1d14");
    let ly = by + 8;
    for (const k of ["red", "cream"]) {
      if (!c.order[k]) continue;
      sprite(MINI_FISH, { b: k === "red" ? "#c98a3a" : "#f0c04a", e: "#2a1d14" }, bx + 4, ly - 4, 1, "#5a3a1a");
      txt(`${BB_NAME[k]} ×${c.order[k]}`, bx + 16, ly, { size: 6.5, color: k === "red" ? "#8b3a2b" : "#b07800", stroke: null });
      ly += 10;
    }
    // 인내심 막대
    if (!c.leaving) {
      rect(x, 122, 28, 4, "#2a1d14");
      rect(x + 1, 123, Math.max(0, 26 * r), 2, r < 0.25 ? "#e5484d" : r < 0.5 ? "#f5a623" : "#58c48b");
    }
    hit(bx, by, Math.max(bw, 30), 170 - by, (p) => serveCustomer(c, p));
  }

  function drawCounterArea(now) {
    rect(0, 198, BB_W, 56, "#c58b5a");
    for (let y = 204; y < 254; y += 10) rect(0, y, BB_W, 1, "#b47c4c");
    // 진열대
    [["red", 8], ["cream", 70]].forEach(([k, x]) => {
      const bump = Math.max(0, bb.trayBump[k] - now) / 300;
      const lift = Math.round(Math.sin(bump * Math.PI) * 2);
      pbox(x, 202 - lift, 58, 46, "#fff6e6", "#3b2a20", "#ffffff");
      const body = k === "red" ? "#d99a45" : "#e8b450";
      sprite(FISH, { o: "#6b3a14", b: body, d: shade(body, 0.8), l: shade(body, 1.15), e: "#2a1a10" }, x + 7, 206 - lift, 1.7);
      txt(BB_NAME[k], x + 29, 236 - lift, { size: 6.5, align: "center", color: "#5a4636", stroke: null });
      txt(`×${bb.tray[k]}`, x + 52, 236 - lift, { size: 8, align: "right", color: "#3b2a20", stroke: null });
      rect(x + 4, 241 - lift, 50, 3, k === "red" ? "#8b3a2b" : "#f0b400");
    });
    // 속재료 고르기
    [["red", 202, "팥", "1,000원", "#7a2e22"], ["cream", 227, "슈크림", "1,200원", "#f0c419"]].forEach(([k, y, name, price, dot]) => {
      const on = bb.filling === k;
      pbox(136, y, 126, 21, on ? "#ffe2b0" : "#fff6e6", on ? "#e67e22" : "#3b2a20", on ? "#fff3d6" : "#ffffff");
      if (on) pbox(137, y + 1, 124, 19, "#ffe2b0", "#e67e22");
      rect(143, y + 7, 7, 7, dot);
      rect(143, y + 7, 7, 1, shade(dot, 1.3));
      txt(name, 155, y + 11, { size: 7.5, color: "#3b2a20", stroke: null });
      txt(price, 256, y + 11, { size: 6.5, align: "right", color: "#8a6a4f", stroke: null, weight: 500 });
      hit(136, y, 126, 21, () => (bb.filling = k));
    });
  }

  // ----- 붕어빵 틀 (2열 격자) + 무쇠 뚜껑 -----
  const GRILL = { x: 8, y: 256, w: 254, h: 204 };
  const FISH_SCALE = 2;
  const FISH_W = 28 * FISH_SCALE; // 스프라이트(테두리 포함) 크기
  const FISH_H = 14 * FISH_SCALE;

  function moldRect(i) {
    const rows = Math.ceil(bb.moldCount / 2);
    const cw = 117, ch = 44, gap = 4;
    const totalH = rows * ch + (rows - 1) * gap;
    const top = GRILL.y + Math.round((GRILL.h - totalH) / 2);
    return { x: GRILL.x + 8 + (i % 2) * (cw + gap + 4), y: top + Math.floor(i / 2) * (ch + gap), w: cw, h: ch };
  }

  function drawGrill(now) {
    rect(0, 254, BB_W, 226, "#2c2733");
    pbox(GRILL.x, GRILL.y, GRILL.w, GRILL.h, "#4a4f5a", "#15171b", "#6a707c");
    rect(GRILL.x + 3, GRILL.y + 3, GRILL.w - 6, GRILL.h - 6, "#3a3e47");
    // 손잡이
    rect(GRILL.x + GRILL.w / 2 - 20, GRILL.y - 3, 40, 4, "#15171b");
    rect(GRILL.x + GRILL.w / 2 - 19, GRILL.y - 2, 38, 2, "#6a4a30");

    bb.molds.forEach((m, i) => drawMold(m, moldRect(i), now));
  }

  // 무쇠 뚜껑 (붕어빵 무늬가 볼록 새겨진 판)
  // o 테두리, i 무쇠, h 밝은 면, s 그늘, f 새겨진 붕어빵 무늬, F 무늬 하이라이트
  const LID = [
    "......oooooooooooooooooo......",
    "....ooiiiiiiiiiiiiiiiiiioo....",
    "..ooihhhhhhhhiiiiiiiiiiiiioo..",
    ".oihhiiiiiiiiiiiiiiiiiiiiiiio.",
    "oihiiiiFFFFFFFFFFFFiiiiiifffio",
    "oiiiiFffiiiiiiiiiiffFiiiffiiio",
    "oiiiFfiiiiFiiFiiFiiiffFffiiiio",
    "oiiiFfiiiiFiiFiiFiiiiffiiiiiio",
    "oiiiifFiiiiiiiiiiiiffFffiiiiio",
    "oiiiiiffFFFFFFFFFFffiiiifffiio",
    ".osiiiiiiiiiiiiiiiiiiiiiiiiso.",
    "..oossiiiiiiiiiiiiiiiiiissoo..",
    "....oossssssssssssssssssoo....",
    "......oooooooooooooooooo......",
  ];
  const LID_PAL = { o: "#0d0e11", i: "#4a4f5a", h: "#7a808c", s: "#2c3038", f: "#353a43", F: "#5c626e" };
  const LID_W = 32 * FISH_SCALE; // 테두리 포함
  const LID_H = 16 * FISH_SCALE;

  // open: 0 = 덮음, 1 = 열림 (뒤쪽 경첩을 축으로 들어 올린 모습)
  function drawLid(x, y, open) {
    const lx = x + Math.round((FISH_W - LID_W) / 2);
    const closedY = y + Math.round((FISH_H - LID_H) / 2);
    const ly = Math.round(closedY - open * 18);
    const squash = 1 - open * 0.72;
    sprite(LID, LID_PAL, lx, ly, FISH_SCALE, null, squash);
    // 손잡이 (오른쪽)
    const midY = Math.round(ly + LID_H / 2);
    rect(lx + LID_W - 4, midY - 1, 6, 3, "#15171b");
    rect(lx + LID_W + 1, midY - 3, 9, 7, "#3b2414");
    rect(lx + LID_W + 2, midY - 2, 7, 5, "#8a5530");
    rect(lx + LID_W + 2, midY - 2, 7, 1, "#b07040");
  }

  function drawMold(m, r, now) {
    const { x, y, w, h } = r;
    pbox(x, y, w, h, "#24272e", "#101115");
    rect(x + 2, y + h - 3, w - 4, 1, "#1a1c21");

    const cooking = m.state === "cookA" || m.state === "cookB";
    let pal, tag = "", tagColor = "#cfd3dc";
    if (m.state === "empty") {
      pal = { o: "#3a3e47", b: "#1b1d22", d: "#1f2127", l: "#1f2127", e: "#1b1d22" };
      tag = "반죽 붓기";
    } else if (m.state === "batter") {
      pal = { o: "#c9a86a", b: "#f6e7b8", d: "#f6e7b8", l: "#fffaf0", e: "#f6e7b8" };
      tag = `${BB_NAME[bb.filling]} 넣기`;
    } else if (cooking) {
      const b = fishColor(m.p);
      pal = { o: shade(b, 0.5), b, d: shade(b, 0.8), l: shade(b, 1.15), e: "#2a1a10" };
      if (m.p < 1) tag = m.state === "cookA" ? "앞면 굽는 중" : "뒷면 굽는 중";
      else if (m.p <= 1.4) {
        tag = m.state === "cookA" ? "뒤집기!" : "꺼내기!";
        tagColor = Math.floor(now / 250) % 2 ? "#ffd166" : "#fff3c4";
      } else {
        tag = "타기 직전!";
        tagColor = "#ff8a65";
      }
    } else if (m.state === "burnt") {
      pal = { o: "#120a06", b: "#3a2316", d: "#24150c", l: "#4a2e1c", e: "#120a06" };
      tag = "탔어요 (버리기)";
      tagColor = "#ff6b6b";
    }

    // 붕어빵 위치: 칸 왼쪽, 위쪽에 열린 뚜껑 자리를 남김
    const fx = x + 4;
    const fy = y + h - FISH_H - 3;

    // 뒤집는 중이면 세로로 납작하게
    let squash = 1;
    if (m.flipUntil && now < m.flipUntil) squash = Math.max(0.08, Math.abs(Math.cos((1 - (m.flipUntil - now) / 350) * Math.PI)));

    // 뚜껑: 굽는 중(아직 덜 익음)엔 덮고, 노릇해지거나 비어 있으면 열림. 부드럽게 여닫힘.
    const lidTarget = cooking && m.p < 1 && !(m.flipUntil && now < m.flipUntil) ? 0 : 1;
    const ldt = Math.min(0.1, (now - (m.lidTime || now)) / 1000);
    m.lidTime = now;
    m.lid = m.lid === undefined ? 1 : m.lid + (lidTarget - m.lid) * Math.min(1, ldt * 10);
    if (m.lid > 0.5) drawLid(fx, fy, m.lid); // 열린 뚜껑은 붕어빵 뒤쪽
    sprite(FISH, pal, fx, fy, FISH_SCALE, null, squash);
    if (m.lid <= 0.5) {
      drawLid(fx, fy, m.lid); // 덮인 뚜껑은 붕어빵 위
      // 뚜껑 틈으로 김이 모락모락
      if (cooking && Math.random() < 0.08) {
        bb.smoke.push({ x: fx + 6 + Math.random() * (FISH_W - 12), y: fy - 2, life: 0.8, c: "#f4f1ea" });
      }
    }

    // 오른쪽: 상태 글씨 + 굽기 막대
    const tx = x + 92;
    if (cooking || m.state === "burnt") txt(BB_NAME[m.fill], tx, y + 11, { size: 6, align: "center", color: m.fill === "cream" ? "#ffe08a" : "#ffb39a" });
    txt(tag, tx, y + 22, { size: 6, align: "center", color: tagColor });
    if (cooking) {
      rect(tx - 20, y + 31, 40, 4, "#101115");
      rect(tx - 19, y + 32, Math.min(38, 38 * (m.p / 2)), 2, m.p > 1.4 ? "#ff8a65" : m.p >= 1 ? "#ffd166" : "#9aa0ab");
      rect(tx - 19 + 19, y + 30, 1, 6, "#ffffff"); // 노릇 시작 표시
    }
    // 연기
    if ((cooking && m.p > 1.6) || m.state === "burnt") {
      if (Math.random() < 0.15) bb.smoke.push({ x: fx + 12 + Math.random() * 30, y: fy, life: 1 });
    }
    hit(x, y, w, h, (p) => clickMold(m, p));
  }

  function drawFx(dt) {
    bb.smoke = bb.smoke.filter((s) => (s.life -= dt) > 0);
    for (const s of bb.smoke) {
      s.y -= dt * 18;
      s.x += Math.sin(s.life * 10) * dt * 6;
      rect(s.x, s.y, s.c ? 2 : 3, s.c ? 2 : 3, s.c ? (s.life > 0.4 ? s.c : "#c9c6bf") : s.life > 0.5 ? "#9a9aa3" : "#6c6c75");
    }
    bb.pops = bb.pops.filter((p) => (p.life -= dt) > 0);
    for (const p of bb.pops) {
      p.y -= dt * 22;
      txt(p.t, p.x, p.y, { size: 7.5, align: "center", color: p.color });
    }
  }

  function drawHelp() {
    rect(0, 462, BB_W, 18, "#1f1b26");
    txt("빈 틀 → 반죽 → 속 → 뒤집기 → 꺼내기 · 손님 눌러 판매", 135, 471, { size: 6, align: "center", color: "#b8b0c8", stroke: null, weight: 500 });
  }

  // 시작 / 결과 / 일시정지 창
  function drawOverlay() {
    const o = bb.overlay;
    rect(0, 0, BB_W, BB_H, "rgba(20, 14, 10, 0.6)");
    const lineH = 12;
    const h = 34 + o.lines.length * lineH + o.buttons.length * 27 + 14;
    const x = 18, w = BB_W - 36, y = Math.round((BB_H - h) / 2);
    pbox(x, y, w, h, "#fff3df", "#3b2a20", "#ffffff");
    pbox(x + 3, y + 3, w - 6, h - 6, "#fff3df", "#e2c49a");
    txt(o.title, BB_W / 2, y + 18, { size: 11, align: "center", color: "#3b2a20", stroke: null });
    let ly = y + 36;
    for (const l of o.lines) {
      if (l.r !== undefined) {
        txt(l.t, x + 14, ly, { size: 7, color: "#5a4636", stroke: null, weight: 500 });
        txt(l.r, x + w - 14, ly, { size: 7, align: "right", color: "#3b2a20", stroke: null });
      } else {
        txt(l.t, BB_W / 2, ly, { size: 7, align: "center", color: l.color || "#5a4636", stroke: null, weight: 500 });
      }
      ly += lineH;
    }
    ly += 4;
    for (const b of o.buttons) {
      const bx = x + 14, bw = w - 28;
      const fill = b.disabled ? "#e6dccd" : b.primary ? "#e67e22" : "#f9e6c8";
      pbox(bx, ly, bw, 22, fill, b.disabled ? "#b8a890" : "#3b2a20", b.disabled ? null : b.primary ? "#f5a65a" : "#fff6e6");
      const color = b.disabled ? "#a89880" : b.primary ? "#ffffff" : "#3b2a20";
      if (b.right) {
        txt(b.label, bx + 8, ly + 11, { size: 7, color, stroke: null });
        txt(b.right, bx + bw - 8, ly + 11, { size: 7, align: "right", color, stroke: null });
      } else {
        txt(b.label, BB_W / 2, ly + 11, { size: 8.5, align: "center", color, stroke: b.primary ? "#a8501a" : null });
      }
      if (!b.disabled) hit(bx, ly, bw, 22, b.fn);
      ly += 27;
    }
  }

  // ---------- 게임 동작 ----------
  function bbPop(p, t, kind) {
    if (kind === "bad") sfx.miss();
    bb.pops.push({ t, x: clamp(p?.x ?? BB_W / 2, 40, BB_W - 40), y: p?.y ?? 240, life: 1, color: kind === "bad" ? "#ff6b6b" : kind === "good" ? "#7be0a8" : "#ffd166" });
  }

  function buildMolds() {
    bb.molds = Array.from({ length: bb.moldCount }, () => ({ state: "empty", fill: null, p: 0 }));
  }

  function clickMold(m, p) {
    if (!bb.running || bb.paused) return;
    switch (m.state) {
      case "empty":
        m.state = "batter";
        break;
      case "batter":
        m.state = "cookA";
        m.fill = bb.filling;
        m.p = 0;
        break;
      case "cookA":
        if (m.p < 1) return bbPop(p, "아직 덜 익었어요", "bad");
        m.state = "cookB";
        m.p = 0;
        m.flipUntil = performance.now() + 350;
        break;
      case "cookB": {
        if (m.p < 1) return bbPop(p, "아직 덜 익었어요", "bad");
        bb.tray[m.fill]++;
        bb.trayBump[m.fill] = performance.now() + 300;
        if (m.p <= 1.4) {
          bb.earn += 200;
          bbPop(p, "완벽! +200", "good");
          sfx.pyong(false);
        } else {
          bbPop(p, `${BB_NAME[m.fill]} 붕어빵 완성`);
        }
        Object.assign(m, { state: "empty", fill: null, p: 0 });
        break;
      }
      case "burnt":
        bbPop(p, "버렸어요…", "bad");
        Object.assign(m, { state: "empty", fill: null, p: 0 });
        break;
    }
  }

  const BB_SKIN = ["#f6d2b0", "#e9b98f", "#c98d62", "#f2c9a0"];
  const BB_HAIR = ["#2b1d16", "#5a3a22", "#8c5a2b", "#d9a441", "#3b3b4f", "#a8483a", "#e8e2d0"];
  const BB_SHIRT = ["#e5484d", "#3b7be8", "#2fa37a", "#f5b041", "#8b5cf6", "#e85a8a", "#4a4f5a"];
  const BB_PANTS = ["#2c3e66", "#3b3b3b", "#5a4636"];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function spawnCustomer() {
    const used = new Set(bb.customers.filter((c) => !c.leaving).map((c) => c.slot));
    const slot = [0, 1, 2, 3].find((s) => !used.has(s));
    if (slot === undefined) return;
    const total = 1 + Math.floor(Math.random() * bbMaxOrder(bb.day));
    const red = Math.floor(Math.random() * (total + 1));
    const max = bbPatience(bb.day) * (1 + bb.patienceBoost * 0.2) + total * 1.5;
    bb.customers.push({
      slot,
      x: BB_W + 10,
      order: { red, cream: total - red },
      patience: max,
      max,
      seed: Math.random() * 10,
      pal: { h: pick(BB_HAIR), s: pick(BB_SKIN), e: "#1b1420", m: "#a8483a", c: pick(BB_SHIRT), p: pick(BB_PANTS), o: "#2a1d14" },
    });
  }

  function serveCustomer(c, p) {
    if (!bb.running || bb.paused || c.leaving) return;
    const { red, cream } = c.order;
    if (bb.tray.red < red || bb.tray.cream < cream) {
      const need = [];
      if (bb.tray.red < red) need.push(`팥 ${red - bb.tray.red}`);
      if (bb.tray.cream < cream) need.push(`슈크림 ${cream - bb.tray.cream}`);
      return bbPop(p, `${need.join(", ")}개 부족`, "bad");
    }
    bb.tray.red -= red;
    bb.tray.cream -= cream;
    const pay = red * BB_PRICE.red + cream * BB_PRICE.cream;
    const tip = Math.round(((c.patience / c.max) * 600) / 100) * 100;
    bb.earn += pay + tip;
    bb.served++;
    bbPop(p, `+${fmtWon(pay + tip)}원`, "good");
    sfx.pyong(true);
    c.leaving = true;
  }

  function update(dt) {
    // 손님 걷기 (들어오기 / 나가기)는 멈춤 중에도 마무리
    for (const c of bb.customers) {
      if (c.leaving) c.x += dt * 160;
      else c.x += clamp(SLOT_X[c.slot] - c.x, -dt * 140, dt * 140);
    }
    bb.customers = bb.customers.filter((c) => c.x < BB_W + 20);

    if (!bb.running || bb.paused) return;
    bb.time -= dt;

    const speed = (1 + (bb.heat - 1) * 0.25) / BB_SIDE_SECONDS;
    for (const m of bb.molds) {
      if (m.state === "cookA" || m.state === "cookB") {
        // 노릇해진 뒤(1 이상)에는 날이 갈수록 더 빨리 탐
        m.p += dt * speed * (m.p >= 1 ? bbBurnSpeed(bb.day) : 1);
        if (m.p >= 2) {
          m.state = "burnt";
          bb.burnt++;
        }
      }
    }

    bb.spawnIn -= dt;
    if (bb.spawnIn <= 0 && bb.time > 5) {
      spawnCustomer();
      const gap = bbGap(bb.day);
      bb.spawnIn = gap * (0.7 + Math.random() * 0.6);
    }

    for (const c of bb.customers) {
      if (c.leaving) continue;
      c.patience -= dt;
      if (c.patience <= 0) {
        bb.angry++;
        bbPop({ x: c.x + 14, y: 100 }, "화나서 떠났어요", "bad");
        c.leaving = true;
      }
    }

    if (bb.time <= 0) endDay();
  }

  function startDay() {
    Object.assign(bb, {
      running: true, paused: false, overlay: null,
      earn: 0, time: BB_DAY_SECONDS, served: 0, angry: 0, burnt: 0,
      tray: { red: 0, cream: 0 }, spawnIn: 1.5, customers: [], pops: [], smoke: [],
    });
    buildMolds();
  }

  function endDay() {
    bb.running = false;
    bb.time = 0;
    const leftover = (bb.tray.red * BB_PRICE.red) / 2 + (bb.tray.cream * BB_PRICE.cream) / 2;
    bb.earn += leftover;
    bb.tray = { red: 0, cream: 0 };
    bb.total += bb.earn;
    onScore(bb.total);
    const goal = bbGoal(bb.day);
    const rent = bbRent(bb.day);
    const reached = bb.earn >= goal;
    bb.bank += bb.earn - rent;
    const bankrupt = bb.bank < 0;
    const success = reached && !bankrupt;
    bb.customers.forEach((c) => (c.leaving = true));

    const lines = [
      { t: "판매한 손님", r: `${bb.served}명` },
      { t: "화나서 떠난 손님", r: `${bb.angry}명` },
      { t: "태운 붕어빵", r: `${bb.burnt}개` },
      ...(leftover ? [{ t: "마감 세일 (남은 붕어빵 반값)", r: `+${fmtWon(leftover)}원` }] : []),
      { t: "오늘 매출 / 목표", r: `${fmtWon(bb.earn)} / ${fmtWon(goal)}원` },
      { t: "임대료", r: `-${fmtWon(rent)}원` },
      { t: "남은 돈", r: `${fmtWon(bb.bank)}원` },
    ];

    if (success) {
      sfx.level();
      showShop(lines);
    } else {
      sfx.ko();
      bb.overlay = null;
      bb.over = true;
      onGameOver(bb.total, {
        title: bankrupt ? "파산…" : `${bb.day}일차 목표 실패`,
        detail: `${bb.day}일차까지 장사\n번 돈 ${fmtWon(bb.total)}원\n판매 ${bb.served}명 · 화난 손님 ${bb.angry}명`,
      });
    }
  }

  const BB_UPGRADES = [
    { label: "붕어빵 틀 +1", max: 8, cost: () => 3000 + (bb.moldCount - 4) * 1500, level: () => bb.moldCount, apply: () => bb.moldCount++ },
    { label: "화력 강화 (굽기 +25%)", max: 4, cost: () => 4000 * bb.heat, level: () => bb.heat, apply: () => bb.heat++ },
    { label: "단골 서비스 (인내심 +20%)", max: 3, cost: () => 3500 * (bb.patienceBoost + 1), level: () => bb.patienceBoost, apply: () => bb.patienceBoost++ },
  ];

  function showShop(lines) {
    bb.overlay = {
      title: `${bb.day}일차 성공!`,
      lines: [
        ...lines,
        { t: "" },
        { t: `모은 돈 ${fmtWon(bb.bank)}원으로 업그레이드하세요`, color: "#8a6a4f" },
        { t: `내일 임대료는 ${fmtWon(bbRent(bb.day + 1))}원 · 돈을 조금 남겨 두세요`, color: "#d9483b" },
      ],
      buttons: [
        ...BB_UPGRADES.map((u) => {
          const maxed = u.level() >= u.max;
          const cost = u.cost();
          return {
            label: u.label,
            right: maxed ? "최대" : `${fmtWon(cost)}원`,
            disabled: maxed || bb.bank < cost,
            fn: () => {
              bb.bank -= cost;
              u.apply();
              showShop(lines);
            },
          };
        }),
        { label: `${bb.day + 1}일차 장사 시작`, primary: true, fn: () => { bb.day++; startDay(); } },
      ],
    };
  }

  function resetGame() {
    Object.assign(bb, { day: 1, bank: 0, moldCount: 4, heat: 1, patienceBoost: 0, total: 0, over: false });
    onScore(0);
    startDay();
  }

  function setBbPaused(p) {
    if (!bb.running) return;
    bb.paused = p;
    bb.overlay = p
      ? {
          title: "잠깐 쉬는 중",
          lines: [{ t: `${bb.day}일차 · 남은 시간 ${Math.ceil(bb.time)}초` }],
          buttons: [{ label: "계속하기", primary: true, fn: () => setBbPaused(false) }],
        }
      : null;
  }

  // ---------- 루프 ----------
  let bbLast = 0;
  let raf = 0;
  let shown = -1;
  function bbFrame(now) {
    const dt = Math.min(0.1, (now - bbLast) / 1000);
    bbLast = now;
    update(dt);
    // 점수판: 오늘 번 돈까지 더해서 실시간으로
    const live = bb.total + (bb.running ? bb.earn : 0);
    if (live !== shown) onScore((shown = live));
    bbHits = [];
    art.clearRect(0, 0, BB_W, BB_H);
    drawHud();
    drawShop(now);
    drawCounterArea(now);
    drawGrill(now);
    drawHelp();
    drawFx(dt);
    blit();
    if (bb.overlay) {
      bbHits = []; // 창이 떠 있으면 창 버튼만 누를 수 있음
      art.clearRect(0, 0, BB_W, BB_H);
      drawOverlay();
      blit();
    }
    if (bb.over) bbHits = [];
    raf = requestAnimationFrame(bbFrame);
  }

  // ---------- 입력 ----------
  function onDown(e) {
    const r = bbCanvas.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * BB_W, y: ((e.clientY - r.top) / r.height) * BB_H };
    for (let i = bbHits.length - 1; i >= 0; i--) {
      const h = bbHits[i];
      if (p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h) {
        e.preventDefault();
        h.fn(p);
        return;
      }
    }
  }
  // 다른 앱으로 가면 자동으로 잠깐 멈춤
  function onHide() {
    if (document.hidden && bb.running && !bb.paused) setBbPaused(true);
  }

  return {
    start() {
      unlockSound();
      cancelAnimationFrame(raf);
      bbCanvas.removeEventListener("pointerdown", onDown);
      bbCanvas.addEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onHide);
      document.addEventListener("visibilitychange", onHide);
      resetGame();
      bbLast = performance.now();
      raf = requestAnimationFrame(bbFrame);
    },
    stop() {
      cancelAnimationFrame(raf);
      bb.running = false;
      bbCanvas.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onHide);
    },
  };
}
