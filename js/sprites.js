// 도트 그림 모음 (글자 하나 = 픽셀 하나, '.' 은 빈칸)
export const PAL = {
  K: '#0d0e18', // 테두리
  W: '#f4f4f4', // 흰색
  Y: '#ffcd75', // 노랑
  O: '#ef7d57', // 주황
  R: '#b13e53', // 빨강
  G: '#a7f070', // 연두
  E: '#38b764', // 초록
  B: '#41a6f6', // 하늘
  D: '#29366f', // 남색
  S: '#94b0c2', // 회색
  N: '#8a5a3c', // 갈색
  P: '#ff77a8', // 분홍
};

export const SPRITES = {
  // 주인공 '도토리'
  hero: [
    '...KKKK...',
    '..KYYYYK..',
    '.KYYYYYYK.',
    'KYYKYYKYYK',
    'KYYKYYKYYK',
    'KYPYYYYPYK',
    'KYYYKKYYYK',
    '.KYYYYYYK.',
    '..KOKKOK..',
    '..KK..KK..',
  ],
  meteor: [
    '..KKKK..',
    '.KOORRK.',
    'KOYOORRK',
    'KOOORRRK',
    'KORRRRRK',
    'KRRRRNRK',
    '.KRRRRK.',
    '..KKKK..',
  ],
  coin: [
    '.KKKK.',
    'KYYWYK',
    'KYOYYK',
    'KYOYYK',
    'KYYYYK',
    '.KKKK.',
  ],
  // 두더지
  mole: [
    '....KKKKKKKK....',
    '..KKNNNNNNNNKK..',
    '.KNNNNNNNNNNNNK.',
    '.KNNNNNNNNNNNNK.',
    'KNNNKKNNNNKKNNNK',
    'KNNNKWNNNNKWNNNK',
    'KNNNKKNNNNKKNNNK',
    'KNPPNNNKKNNNPPNK',
    'KNNNNNYYYYNNNNNK',
    'KNNNNYYKKYYNNNNK',
    'KNNNNNYWWYNNNNNK',
    'KNNNNNNYYNNNNNNK',
    'KNNNNNNNNNNNNNNK',
    'KNNNNNNNNNNNNNNK',
  ],
  // 맞은 두더지 (눈이 X)
  moleHit: [
    '....KKKKKKKK....',
    '..KKNNNNNNNNKK..',
    '.KNNNNNNNNNNNNK.',
    '.KNNNNNNNNNNNNK.',
    'KNNKNKNNNNKNKNNK',
    'KNNNKNNNNNNKNNNK',
    'KNNKNKNNNNKNKNNK',
    'KNPPNNNKKNNNPPNK',
    'KNNNNNYYYYNNNNNK',
    'KNNNNYKKKKYNNNNK',
    'KNNNNNYKKYNNNNNK',
    'KNNNNNNYYNNNNNNK',
    'KNNNNNNNNNNNNNNK',
    'KNNNNNNNNNNNNNNK',
  ],
  // 뿅망치 (양쪽 노란 마개 + 빨간 주름 몸통)
  hammer: [
    'KKKKKKKKKKKKKKK',
    'KYYYKRRWRRKYYYK',
    'KYWYKRWRRRKYYYK',
    'KYYYKRRRRRKYYYK',
    'KYYYKKKKKKKYYYK',
    'KYYYKRRRRRKYYYK',
    'KOOOKRRRRRKOOOK',
    'KKKKKKKKKKKKKKK',
    '......KNK......',
    '......KNK......',
    '......KNK......',
    '......KNK......',
    '......KNK......',
    '......KKK......',
  ],
};

// swap: 색을 바꿔 그릴 때 사용 (예: { N: '#ffcd75' } 이면 황금 두더지)
export function drawSprite(ctx, name, x, y, scale = 1, swap = null) {
  const rows = SPRITES[name];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = (swap && swap[ch]) || PAL[ch];
      ctx.fillRect(Math.round(x) + c * scale, Math.round(y) + r * scale, scale, scale);
    }
  }
}

// 도트 타원 (구멍 그릴 때 사용). half: 'top' | 'bottom' | 생략 시 전체
export function pixelEllipse(ctx, cx, cy, rx, ry, color, half) {
  ctx.fillStyle = color;
  for (let dy = -ry; dy <= ry; dy++) {
    if (half === 'top' && dy > 0) break;
    if (half === 'bottom' && dy < 0) continue;
    const w = Math.round(rx * Math.sqrt(1 - (dy / (ry + 0.5)) ** 2));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2, 1);
  }
}

export const spriteSize = (name) => ({ w: SPRITES[name][0].length, h: SPRITES[name].length });

// 간단한 도형 도우미
const px = (ctx, color, x, y, w = 1, h = 1) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };

// 게임 목록 아이콘 (16x16)
export const ICONS = {
  dodge(ctx) {
    px(ctx, PAL.D, 0, 0, 16, 16);
    px(ctx, PAL.W, 2, 2); px(ctx, PAL.W, 13, 4); px(ctx, PAL.W, 6, 1);
    px(ctx, PAL.Y, 1, 5, 2, 1); px(ctx, PAL.O, 3, 6, 2, 1);
    drawSprite(ctx, 'meteor', 4, 3);
    drawSprite(ctx, 'hero', 3, 6);
  },
  jump(ctx) {
    px(ctx, PAL.B, 0, 0, 16, 16);
    px(ctx, PAL.W, 9, 2, 5, 2); px(ctx, PAL.W, 10, 1, 3, 1);
    px(ctx, PAL.E, 0, 13, 6, 3); px(ctx, PAL.G, 0, 13, 6, 1);
    px(ctx, PAL.E, 10, 10, 6, 6); px(ctx, PAL.G, 10, 10, 6, 1);
    drawSprite(ctx, 'hero', 4, 2);
  },
  rhythm(ctx) {
    px(ctx, PAL.P, 0, 0, 16, 16);
    px(ctx, PAL.K, 7, 2, 1, 9); px(ctx, PAL.K, 8, 2, 4, 1); px(ctx, PAL.K, 11, 3, 1, 3);
    px(ctx, PAL.K, 4, 10, 4, 3); px(ctx, PAL.W, 5, 11, 2, 1);
    px(ctx, PAL.Y, 2, 3); px(ctx, PAL.Y, 13, 9); px(ctx, PAL.W, 12, 12);
  },
  number(ctx) {
    px(ctx, PAL.K, 0, 0, 16, 16);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) px(ctx, (i + j) % 2 ? PAL.S : PAL.W, 1 + i * 5, 1 + j * 5, 4, 4);
    px(ctx, PAL.R, 7, 7, 2, 2); px(ctx, PAL.R, 2, 2, 2, 2); px(ctx, PAL.R, 12, 12, 2, 2);
  },
  mole(ctx) {
    px(ctx, PAL.E, 0, 0, 16, 16);
    px(ctx, PAL.G, 0, 0, 16, 1);
    pixelEllipse(ctx, 8, 13, 8, 2, PAL.K);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 16, 13); ctx.clip();
    drawSprite(ctx, 'mole', 0, 2);
    ctx.restore();
    pixelEllipse(ctx, 8, 13, 8, 2, PAL.N, 'bottom');
  },
  fight(ctx) {
    px(ctx, PAL.D, 0, 0, 16, 16);
    // 충격 표시
    px(ctx, PAL.Y, 7, 0, 2, 16); px(ctx, PAL.Y, 0, 7, 16, 2);
    px(ctx, PAL.O, 2, 2, 2, 2); px(ctx, PAL.O, 12, 2, 2, 2); px(ctx, PAL.O, 2, 12, 2, 2); px(ctx, PAL.O, 12, 12, 2, 2);
    // 주먹
    px(ctx, PAL.K, 3, 3, 10, 10);
    px(ctx, '#e8b796', 4, 4, 8, 8);
    px(ctx, PAL.K, 4, 7, 8, 1); px(ctx, PAL.K, 6, 4, 1, 3); px(ctx, PAL.K, 9, 4, 1, 3);
    px(ctx, '#c48f6f', 4, 10, 8, 1);
    px(ctx, PAL.R, 3, 12, 10, 2);
  },
  // 붕어빵 타이쿤: 노릇한 붕어빵 한 마리
  bungeo(ctx) {
    px(ctx, PAL.R, 0, 0, 16, 16);
    for (let x = 0; x < 16; x += 4) px(ctx, PAL.W, x, 0, 2, 3); // 차양 줄무늬
    const fish = [
      '....KKKKKK...KK.',
      '..KKYYYYYYKK.KYK',
      '.KYKYOYYOYYYKKYK',
      'KYYYYOYYOYYYYYK.',
      'KYYYYOYYOYYYYYK.',
      '.KYYYYYYYYYYKKYK',
      '..KKYYYYYYKK.KYK',
      '....KKKKKK...KK.',
    ];
    fish.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && px(ctx, PAL[c], x, 5 + y)));
    px(ctx, PAL.N, 0, 14, 16, 2);
  },
  // 펭귄 얼음 점프: 바다 위 얼음에 선 펭귄
  penguin(ctx) {
    px(ctx, '#1d5fa3', 0, 0, 16, 16);
    px(ctx, '#3d86cc', 1, 3, 4, 1); px(ctx, '#3d86cc', 10, 2, 4, 1);
    pixelEllipse(ctx, 8, 14, 7, 2, '#eef8ff');
    px(ctx, '#9cc8ec', 2, 15, 12, 1);
    const p = [
      '...KKKK...',
      '.KKKKKKKK.',
      'KKWWKKWWKK',
      'KKWKKKKWKK',
      'KOOOOOOOOK',
      'KKOOOOOOKK',
      'KKKWWWWKKK',
      '.KKWWWWKK.',
      '..KKKKKK..',
      '..OO..OO..',
    ];
    p.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && px(ctx, PAL[c], 3 + x, 3 + y)));
  },
  stack(ctx) {
    px(ctx, PAL.D, 0, 0, 16, 16);
    const c = [PAL.R, PAL.O, PAL.Y, PAL.G, PAL.B];
    for (let i = 0; i < 5; i++) px(ctx, c[i], 3 + (i % 2), 13 - i * 3, 10 - (i % 2), 2);
    px(ctx, PAL.W, 1, 1); px(ctx, PAL.W, 14, 3);
  },
};

export function makeIcon(id) {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  ICONS[id](cv.getContext('2d'));
  return cv;
}
