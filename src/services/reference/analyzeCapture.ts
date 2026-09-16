import { SMARTSTORE_DETAIL_WIDTH } from '@/config/smartstore';
import type { DesignSettings, HeroShape, StylePreset } from '@/types/project';

/**
 * 참고 상세페이지 캡처에서 '느낌'만 읽어온다.
 *
 * 중요:
 *  - 픽셀을 그대로 베끼지 않는다. 색 분위기·여백·구성 방식만 가져온다.
 *  - 글자 내용이나 사진은 전혀 가져오지 않는다.
 *  - 캡처 사진 자체는 저장하지 않는다. 읽어낸 결과만 남긴다.
 *  - AI 가 아니라 사진의 색과 여백을 직접 재서 계산한 결과다. 화면에 그대로 밝힌다.
 *
 * 읽는 것:
 *  배경 밝기 / 자주 쓰인 색 / 여백 크기 / 구간(메뉴) 수 /
 *  사진 비율 / 글자 크기 짐작 / 아래쪽 버튼 유무
 */

export interface ReferenceRead {
  fileName: string;
  width: number;          // 원본 가로
  height: number;         // 원본 세로
  findings: string[];     // 사람이 읽는 관찰 결과
  suggest: Partial<DesignSettings>;
  presetGuess: StylePreset;
  sections: number;
  ctaBottom: boolean;
}

/** 가로로 이만큼 줄여서 살펴본다 (원본 그대로 보면 느리다) */
const SAMPLE_W = 240;
/** 배경색과 이만큼 이내면 '빈 곳' 으로 본다 */
const BG_TOLERANCE = 30;

export async function analyzeCapture(file: File): Promise<ReferenceRead> {
  const img = await loadImage(file);
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) throw new Error('사진을 읽지 못했습니다.');

  const w = Math.min(SAMPLE_W, nw);
  const h = Math.max(1, Math.round((nh / nw) * w));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('사진을 살펴보지 못했습니다.');
  ctx.drawImage(img, 0, 0, w, h);

  let px: Uint8ClampedArray;
  try {
    px = ctx.getImageData(0, 0, w, h).data;
  } catch {
    throw new Error('이 사진은 살펴볼 수 없습니다. 다른 캡처를 올려보세요.');
  }

  /* ---------- 1. 배경색 ---------- */
  const bg = dominantEdgeColor(px, w, h);
  const bgLum = lum(bg);

  /* ---------- 2. 줄마다 얼마나 채워져 있는지 ---------- */
  const ink: number[] = new Array(h);
  for (let y = 0; y < h; y++) {
    let filled = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (dist(px[i], px[i + 1], px[i + 2], bg) > BG_TOLERANCE) filled++;
    }
    ink[y] = filled / w;
  }

  /* ---------- 3. 여백 구간 ---------- */
  const emptyBands = groupRows(ink, (v) => v < 0.02);
  const scale = nh / h;                          // 줄여 본 것을 원본 크기로 되돌리는 배율
  const toPage = SMARTSTORE_DETAIL_WIDTH / nw;   // 원본을 860px 기준으로 옮기는 배율
  const bigBands = emptyBands.filter((b) => b.len / h > 0.012 && b.start > 0 && b.end < h - 1);
  const gapPx = bigBands.length
    ? Math.round(median(bigBands.map((b) => b.len * scale * toPage)))
    : 0;
  const sections = bigBands.length + 1;

  /* ---------- 4. 사진으로 보이는 덩어리 ---------- */
  const photoBands = groupRows(ink, (v) => v > 0.72).filter((b) => b.len / h > 0.02);
  const heroBand = photoBands[0];
  const heroRatio = heroBand ? nw / (heroBand.len * scale) : 0;   // 가로 / 세로
  const heroShape: HeroShape =
    !heroBand ? 'auto' : heroRatio > 1.15 ? 'landscape' : heroRatio < 0.87 ? 'portrait' : 'square';

  /* ---------- 5. 제목 글씨 크기 짐작 ---------- */
  /*
   * 사진을 줄여서 보기 때문에 가까이 붙은 여러 줄이 한 덩어리로 뭉친다.
   * 그래서 '모든 글자 줄의 평균' 같은 값은 믿을 수 없다.
   * 위쪽에서 처음 만나는 글자 줄 하나만 제목으로 보고, 뭉친 덩어리는 건너뛴다.
   * 본문 크기는 믿을 만하게 잴 수 없어 아예 짐작하지 않는다.
   */
  const textBands = groupRows(ink, (v) => v > 0.01 && v < 0.42).filter((b) => b.len >= 2);
  const titleBand = textBands.find((b) => b.start < h * 0.45 && b.len < h * 0.03);
  const titleGuess = titleBand ? clamp(Math.round(titleBand.len * scale * toPage * 0.82), 20, 54) : 0;

  /* ---------- 6. 자주 쓰인 색 ---------- */
  /* 글자색은 '글자처럼 보이는 줄' 에서만 찾는다.
     (큰 사진 덩어리의 색을 글자색으로 잘못 고르지 않도록) */
  const textRows = new Set<number>();
  textBands.forEach((b) => { for (let y = b.start; y <= b.end; y++) textRows.add(y); });
  const { accent, primary, textColor } = keyColors(px, w, h, bg, textRows);

  /* ---------- 7. 아래쪽 버튼 느낌 ---------- */
  const ctaBottom = hasBottomBar(px, w, h, bg);

  /* ---------- 8. 정리 ---------- */
  /* 분위기는 '눈에 띄는 색' 으로 판단한다 (글자색은 대부분 검정에 가까워 도움이 안 된다) */
  const presetGuess = guessPreset(bg, bgLum, primary, gapPx);

  const suggest: Partial<DesignSettings> = {
    background: toHex(bg),
    primary: toHex(primary),
    accent: toHex(accent),
    text: toHex(textColor),
    heroShape,
  };
  if (gapPx > 0) suggest.menuGap = clamp(gapPx, 20, 140);
  if (titleGuess) suggest.titleSize = titleGuess;

  const shapeWord = heroShape === 'landscape' ? '가로형' : heroShape === 'portrait' ? '세로형' : '정사각형';

  const findings: string[] = [
    '배경이 ' + brightWord(bgLum) + ' 편이에요. (' + toHex(bg) + ')',
    toHex(primary) === toHex(accent)
      ? '자주 쓰인 색은 ' + toHex(primary) + ' 였어요.'
      : '눈에 띄는 색은 ' + toHex(primary) + ', 글자는 ' + toHex(textColor) + ' 였어요.',
    sections > 1
      ? '여백으로 나뉜 구간이 ' + sections + '군데였어요. 메뉴를 ' + sections + '개 정도로 나눈 느낌이에요.'
      : '큰 여백 없이 이어지는 구성이에요.',
    gapPx > 0
      ? '메뉴 사이 여백은 ' + gapPx + 'px 정도였어요. ' + (gapPx >= 70 ? '여유 있는 편이에요.' : '촘촘한 편이에요.')
      : '메뉴 사이 여백을 찾지 못했어요.',
    heroBand
      ? '위쪽 사진이 ' + shapeWord + '에 가까웠어요.'
      : '사진 덩어리를 뚜렷하게 찾지 못했어요.',
    titleGuess
      ? '제목 글씨는 ' + titleGuess + 'px 정도로 ' + (titleGuess >= 34 ? '큰' : '보통') + ' 편이에요.'
      : '제목 글씨 크기는 짐작하기 어려웠어요. (본문 크기는 원래 재지 않습니다)',
    ctaBottom
      ? '아래쪽에 버튼처럼 보이는 부분이 있었어요. 마지막에 구매·문의 메뉴를 두면 비슷한 느낌이 나요.'
      : '아래쪽에 뚜렷한 버튼은 보이지 않았어요.',
  ];

  return {
    fileName: file.name || '참고 캡처',
    width: nw,
    height: nh,
    findings,
    suggest,
    presetGuess,
    sections,
    ctaBottom,
  };
}

/* ------------------------------------------------------------------ */
/* 안쪽 계산                                                            */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];
interface Bin { n: number; r: number; g: number; b: number }

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) {
      reject(new Error('사진 파일만 올릴 수 있어요.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('사진을 읽지 못했습니다.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('사진을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

/** 가장자리에서 가장 많이 보이는 색 = 배경색 */
function dominantEdgeColor(px: Uint8ClampedArray, w: number, h: number): RGB {
  const bins = new Map<string, Bin>();
  const edge = Math.max(2, Math.round(w * 0.02));
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x++) {
      if (x > edge && x < w - edge) continue;
      const i = (y * w + x) * 4;
      addBin(bins, px[i], px[i + 1], px[i + 2]);
    }
  }
  return topBin(bins) ?? [255, 255, 255];
}

/**
 * 배경이 아닌 색 중에서 쓸 만한 색을 고른다.
 *  - 대표색: 눈에 띄는(채도 높은) 색
 *  - 글자색: 글자처럼 보이는 줄에서 찾은 어두운 색
 *  - 강조색(제목): 글자색을 그대로 쓴다. 실제 상세페이지도 제목은 대개 진한 색이다.
 */
function keyColors(px: Uint8ClampedArray, w: number, h: number, bg: RGB, textRows: Set<number>) {
  const vivid = new Map<string, Bin>();
  const dark = new Map<string, Bin>();

  for (let y = 0; y < h; y += 2) {
    const isTextRow = textRows.has(y) || textRows.has(y + 1);
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      if (dist(r, g, b, bg) <= BG_TOLERANCE) continue;
      const s = sat(r, g, b);
      const l = lum([r, g, b]);
      if (s > 0.3 && l > 40 && l < 225) addBin(vivid, r, g, b);
      if (isTextRow && l < 140) addBin(dark, r, g, b);
    }
  }

  const vividTop = topBin(vivid);
  const darkTop = topBin(dark);
  const textColor = darkTop ?? ([31, 41, 55] as RGB);
  const accent = darkTop ?? vividTop ?? ([17, 24, 39] as RGB);
  /* 눈에 띄는 색이 없으면 글자색을 배경과 섞어 부드럽게 만든다 */
  const primary = vividTop ?? mix(textColor, bg, 0.35);
  return { accent, primary, textColor };
}

/** 아래쪽 20% 안에 가로로 길게 이어지는 색 덩어리가 있는지 */
function hasBottomBar(px: Uint8ClampedArray, w: number, h: number, bg: RGB): boolean {
  const from = Math.floor(h * 0.8);
  for (let y = from; y < h; y++) {
    let run = 0;
    let best = 0;
    let prev: RGB | null = null;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c: RGB = [px[i], px[i + 1], px[i + 2]];
      const isBg = dist(c[0], c[1], c[2], bg) <= BG_TOLERANCE;
      const sameAsPrev = prev ? dist(c[0], c[1], c[2], prev) < 24 : true;
      if (!isBg && sameAsPrev) {
        run++;
      } else {
        if (run > best) best = run;
        run = 0;
      }
      prev = c;
    }
    if (run > best) best = run;
    if (best > w * 0.45) return true;
  }
  return false;
}

function guessPreset(bg: RGB, bgLum: number, accent: RGB, gapPx: number): StylePreset {
  /* 어두운 배경은 '미니멀' 로 본다. 배경색 자체는 캡처에서 읽은 값을 그대로 쓴다. */
  if (bgLum < 90) return 'minimal';
  const s = sat(accent[0], accent[1], accent[2]);
  const hue = hueOf(accent);
  const beige = bg[0] > bg[1] && bg[1] > bg[2] && bgLum > 200;
  if (s < 0.14) return gapPx >= 80 ? 'minimal' : 'clean';
  if (beige && hue >= 20 && hue <= 50) return 'luxury';
  if (hue >= 300 || hue < 15) return 'emotional';
  if (hue >= 15 && hue < 55) return 'warm';
  if (s > 0.45) return 'bright';
  return 'clean';
}

/* --- 작은 도구들 --- */

function addBin(m: Map<string, Bin>, r: number, g: number, b: number): void {
  const k = (r >> 4) + '_' + (g >> 4) + '_' + (b >> 4);
  const cur = m.get(k);
  if (cur) {
    cur.n++;
    cur.r += r;
    cur.g += g;
    cur.b += b;
  } else {
    m.set(k, { n: 1, r, g, b });
  }
}

function topBin(m: Map<string, Bin>): RGB | null {
  let best: Bin | null = null;
  m.forEach((v) => {
    if (best === null || v.n > best.n) best = v;
  });
  if (best === null) return null;
  const b: Bin = best;
  return [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)];
}

function groupRows(values: number[], keep: (v: number) => boolean): { start: number; end: number; len: number }[] {
  const out: { start: number; end: number; len: number }[] = [];
  let start = -1;
  for (let i = 0; i < values.length; i++) {
    if (keep(values[i])) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      out.push({ start, end: i - 1, len: i - start });
      start = -1;
    }
  }
  if (start >= 0) out.push({ start, end: values.length - 1, len: values.length - start });
  return out;
}

function dist(r: number, g: number, b: number, c: RGB): number {
  return Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]);
}

function lum(c: RGB): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
}

function sat(r: number, g: number, b: number): number {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

function hueOf(c: RGB): number {
  const r = c[0] / 255;
  const g = c[1] / 255;
  const b = c[2] / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (d === 0) return 0;
  let hu = 0;
  if (mx === r) hu = ((g - b) / d) % 6;
  else if (mx === g) hu = (b - r) / d + 2;
  else hu = (r - g) / d + 4;
  hu *= 60;
  return hu < 0 ? hu + 360 : hu;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function toHex(c: RGB): string {
  return '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function median(list: number[]): number {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function brightWord(l: number): string {
  if (l > 235) return '아주 밝은';
  if (l > 190) return '밝은';
  if (l > 110) return '중간 밝기';
  return '어두운';
}
