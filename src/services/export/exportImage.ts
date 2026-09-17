import { getFontEmbedCSS, toCanvas } from 'html-to-image';
import JSZip from 'jszip';
import { IMAGE_POLICY, SMARTSTORE_DETAIL_WIDTH } from '@/config/smartstore';

/**
 * 상세페이지를 실제 업로드용 이미지로 만든다.
 *
 * 중요:
 *  - 미리보기와 같은 화면을 그대로 그린다 (같은 컴포넌트를 쓴다)
 *  - 화면에서 줄여 보고 있어도 원래 크기(860px)로 선명하게 뽑는다
 *  - 자를 때 글자·얼굴·상품 한가운데가 잘리지 않게 자연스러운 자리를 찾는다
 */

export interface SliceResult {
  blobs: Blob[];
  width: number;
  totalHeight: number;
}

/** 너무 오래 걸리면 멈춘 것으로 보고 알려준다 (무한 대기 방지) */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${what} 시간이 너무 오래 걸립니다. 사진 수나 크기를 줄여보세요.`)), ms),
    ),
  ]);
}

/**
 * 고른 글꼴을 이미지 안에 함께 넣는다.
 *
 * 이미지로 뽑을 때는 브라우저 밖에서 그리는 것과 같아서
 * 글꼴을 같이 넣어주지 않으면 **화면과 다른 글씨로 저장된다.**
 * 다만 글꼴 파일을 받아오다 멈추면 안 되므로 시간 제한을 두고,
 * 실패하면 글꼴 없이라도 이미지를 만든다. (그림·글자는 그대로 나온다)
 */
let fontCache: { at: number; css: string } | null = null;

async function embedFontCss(node: HTMLElement): Promise<string> {
  /* 한 번 받아두면 잠시 동안 다시 받지 않는다 (분할·ZIP 은 여러 번 그린다) */
  if (fontCache && Date.now() - fontCache.at < 60000) return fontCache.css;
  try {
    const css = await withTimeout(getFontEmbedCSS(node), 12000, '글꼴을 챙기는');
    fontCache = { at: Date.now(), css };
    return css;
  } catch {
    /* 글꼴을 못 챙겨도 이미지는 만든다 */
    return '';
  }
}

/** 저장할 때 고르는 것 */
export interface ExportOptions {
  /**
   * 배율. 2 면 가로 1720px 로 선명하게, 1 이면 스마트스토어 권장 크기(가로 860px).
   * 비워두면 기본(선명하게)이다.
   */
  scale?: number;
}

/**
 * 화면 배율에 영향받지 않도록 원래 크기로 그린다.
 *
 * ⚠ 높이를 **넉넉히** 잡는다.
 *   화면에 보이는 글자와 그림으로 그린 글자는 글꼴 준비 상태에 따라 줄 높이가 조금 다르다.
 *   딱 맞춰 잡으면 아래가 잘릴 수 있어서 넉넉히 그린 뒤, 남는 빈 곳은 잘라낸다.
 */
export async function renderDetailCanvas(node: HTMLElement, opts: ExportOptions = {}): Promise<HTMLCanvasElement> {
  const fontEmbedCSS = await embedFontCss(node);
  const height = Math.round(node.scrollHeight * 1.2 + 200);

  return withTimeout(
    toCanvas(node, {
      pixelRatio: opts.scale ?? IMAGE_POLICY.exportScale,
      /* 사진이 data 주소라서 cacheBust 를 켜면 주소가 망가져 멈춘다 — 켜지 않는다 */
      cacheBust: false,
      /* 고른 글꼴을 함께 넣는다. 못 챙겼으면 빈 값이라 예전처럼 동작한다 */
      fontEmbedCSS,
      /* 화면에서 줄여 보던 배율을 없애고 원래 크기로 그린다 */
      style: { transform: 'none', transformOrigin: 'top left' },
      width: SMARTSTORE_DETAIL_WIDTH,
      height,
    }),
    60000,
    '이미지를 만드는',
  );
}

/** 글꼴을 다시 챙기도록 초기화 (글꼴을 바꾼 뒤 저장할 때) */
export function resetFontCache(): void {
  fontCache = null;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했습니다.'))),
      'image/jpeg',
      IMAGE_POLICY.exportQuality,
    );
  });
}

/* ------------------------------------------------------------------ */
/* 그림에서 직접 자리를 찾는다                                           */
/*                                                                    */
/* 예전에는 화면에 보이는 위치로 자를 곳을 정했다.                        */
/* 그런데 그림으로 그리면 줄 높이가 조금씩 달라져서                        */
/*   - 글 한가운데가 잘리고                                             */
/*   - 끝에 빈 장이 생겼다.                                             */
/* 이제는 **다 그린 그림을 보고** 영역 경계와 내용 끝을 찾는다.           */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * 영역과 영역 사이에 숨겨 두는 표시선 색.
 * 배경색과 **눈으로는 구별되지 않을 만큼만** 다르다. 저장할 때 다시 배경색으로 덮는다.
 */
export function cutMarkColor(background: string): string {
  const [r, g, b] = hexToRgb(background);
  const r2 = r >= 3 ? r - 3 : r + 3;
  return '#' + [r2, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export interface Layout {
  /** 내용이 끝나는 곳 (여백 포함) */
  bottom: number;
  /** 영역 경계 표시선이 있는 줄 */
  marks: number[];
  /** 한 줄이 통째로 배경인지 */
  blank: Uint8Array;
  bg: RGB;
}

function readLayout(canvas: HTMLCanvasElement, background: string, padBottom: number): Layout {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const W = canvas.width;
  const H = canvas.height;
  const bg = hexToRgb(background);
  const mark = hexToRgb(cutMarkColor(background));
  const blank = new Uint8Array(H);
  const marks: number[] = [];
  if (!ctx) return { bottom: H, marks, blank, bg };

  const CHUNK = 256;
  const step = Math.max(2, Math.round(W / 860));
  const from = Math.round(W * 0.3);
  const to = Math.round(W * 0.7);

  for (let y = 0; y < H; y += CHUNK) {
    const h = Math.min(CHUNK, H - y);
    const d = ctx.getImageData(0, y, W, h).data;
    for (let r = 0; r < h; r++) {
      const row = r * W * 4;
      let isBlank = 1;
      for (let x = 0; x < W; x += step) {
        const i = row + x * 4;
        /* 그리지 않은 투명한 곳도 빈 곳이다 */
        if (d[i + 3] < 10) continue;
        if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 24) {
          isBlank = 0;
          break;
        }
      }
      blank[y + r] = isBlank;

      if (isBlank) {
        let isMark = 1;
        for (let x = from; x < to; x += step) {
          const i = row + x * 4;
          if (Math.abs(d[i] - mark[0]) > 1 || Math.abs(d[i + 1] - mark[1]) > 1 || Math.abs(d[i + 2] - mark[2]) > 1) {
            isMark = 0;
            break;
          }
        }
        if (isMark) marks.push(y + r);
      }
    }
  }

  let last = H - 1;
  while (last > 0 && blank[last]) last--;
  const bottom = Math.min(H, last + 1 + padBottom);

  /* 붙어 있는 표시선 줄은 하나로 (배율 2면 두 줄로 그려진다) */
  const merged = marks.filter((y, i) => i === 0 || y - marks[i - 1] > 1).filter((y) => y < bottom);
  return { bottom, marks: merged, blank, bg };
}

/** 한 조각을 잘라 새 그림으로. 표시선은 배경색으로 덮는다 */
function cropPart(src: HTMLCanvasElement, top: number, h: number, lay: Layout): HTMLCanvasElement {
  const part = document.createElement('canvas');
  part.width = src.width;
  part.height = h;
  const ctx = part.getContext('2d');
  if (!ctx) return part;
  ctx.fillStyle = `rgb(${lay.bg.join(',')})`;
  ctx.fillRect(0, 0, part.width, part.height);
  ctx.drawImage(src, 0, top, src.width, h, 0, 0, src.width, h);
  lay.marks.forEach((y) => {
    if (y >= top - 2 && y < top + h + 2) ctx.fillRect(0, y - top - 1, part.width, 4);
  });
  return part;
}

/** 이 줄 범위가 전부 비어 있는지 */
function allBlank(lay: Layout, top: number, bottom: number): boolean {
  for (let y = top; y < bottom; y++) if (!lay.blank[y]) return false;
  return true;
}

/**
 * 자를 곳 정하기.
 *
 *  1. **영역 경계**에서만 자른다. 한 장이 너무 길어지기 직전 경계에서 끊는다.
 *  2. 영역 하나가 한 장보다 길면, 그 안에서 **글과 사진이 없는 빈 줄**을 찾아 자른다.
 *  3. 빈 줄도 없으면(아주 긴 사진 한 장 등) 어쩔 수 없이 정해진 길이에서 자른다.
 */
export function planCuts(lay: Layout, maxH: number): number[] {
  const end = lay.bottom;
  const cuts = [0];
  const bounds = lay.marks.filter((y) => y > 0 && y < end);

  let start = 0;
  while (end - start > maxH) {
    const limit = start + maxH;
    /* 한 장에 들어가는 가장 먼 영역 경계 */
    const fit = bounds.filter((y) => y > start + maxH * 0.25 && y <= limit);
    let cut = fit.length ? fit[fit.length - 1] : -1;

    if (cut < 0) {
      /* 영역 안에서 가장 아래쪽의 넉넉한 빈 줄 (글 줄 사이보다 넓은 곳) */
      let best = -1;
      let run = 0;
      for (let y = start + Math.round(maxH * 0.4); y <= limit; y++) {
        if (lay.blank[y]) {
          run++;
          if (run >= 12) best = y - Math.floor(run / 2);
        } else {
          run = 0;
        }
      }
      cut = best > 0 ? best : limit;
    }

    cuts.push(cut);
    start = cut;
  }
  cuts.push(end);
  return cuts;
}

function backgroundOf(node: HTMLElement): { bg: string; pad: number } {
  const root = node.querySelector<HTMLElement>('[data-detail-root]') ?? node;
  const cs = getComputedStyle(root);
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(cs.backgroundColor);
  const bg = m
    ? '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')
    : '#ffffff';
  return { bg, pad: parseFloat(cs.paddingBottom) || 0 };
}

/** 전체를 한 장으로 — 끝에 남는 빈 곳은 잘라낸다 */
export async function exportWhole(node: HTMLElement, opts: ExportOptions = {}): Promise<Blob> {
  const canvas = await renderDetailCanvas(node, opts);
  const scale = canvas.width / SMARTSTORE_DETAIL_WIDTH;
  const { bg, pad } = backgroundOf(node);
  const lay = readLayout(canvas, bg, Math.round(pad * scale));
  return canvasToBlob(cropPart(canvas, 0, lay.bottom, lay));
}

/**
 * 자연스러운 자리에서 나눠 여러 장으로.
 *
 * 두 번째 값(화면 기준 자를 곳)은 예전 호출과 맞추려고 남겨둔 것이다.
 * 이제는 쓰지 않는다 — 그림에서 직접 찾는 것이 더 정확하다.
 */
export async function exportSlices(
  node: HTMLElement,
  _cutHints: number[] = [],
  opts: ExportOptions = {},
): Promise<SliceResult> {
  const canvas = await renderDetailCanvas(node, opts);
  const scale = canvas.width / SMARTSTORE_DETAIL_WIDTH;
  const { bg, pad } = backgroundOf(node);
  const lay = readLayout(canvas, bg, Math.round(pad * scale));
  const cuts = planCuts(lay, IMAGE_POLICY.maxSliceHeight);

  const blobs: Blob[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const top = cuts[i];
    const h = cuts[i + 1] - top;
    if (h <= 0) continue;
    /* 아무것도 없는 조각은 만들지 않는다 (빈 장 방지) */
    if (allBlank(lay, top, top + h)) continue;
    blobs.push(await canvasToBlob(cropPart(canvas, top, h, lay)));
  }

  return { blobs, width: canvas.width, totalHeight: lay.bottom };
}

/** ZIP 으로 묶기 */
export async function zipBlobs(blobs: Blob[], baseName: string): Promise<Blob> {
  const zip = new JSZip();
  blobs.forEach((b, i) => {
    zip.file(`${baseName}_${String(i + 1).padStart(2, '0')}.jpg`, b);
  });
  return zip.generateAsync({ type: 'blob' });
}

/** 파일 내려받기 */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** 윈도우에서 쓸 수 없는 문자 정리 */
export function safeName(s: string): string {
  return (s || '상세페이지').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 50) || '상세페이지';
}

/**
 * 어디에서 자르면 자연스러운지 알려준다 (메뉴와 메뉴 사이 여백).
 * 검수·완성 화면과 스마트스토어 등록자료가 **같은 자리**에서 자르도록 한 곳에 둔다.
 */
export function cutHintsOf(stage: HTMLElement): number[] {
  const top = stage.getBoundingClientRect().top;
  return Array.from(stage.querySelectorAll<HTMLElement>('.detail__menu'))
    .slice(1)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(el).marginBottom) || 0;
      return Math.round(r.top - top - gap / 2);
    })
    .filter((y) => y > 0);
}

/** 사진이 전부 그려질 때까지 기다린다 (안 그러면 빈 칸으로 나온다) */
export async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
            setTimeout(res, 3000);
          }),
    ),
  );
  /* 글꼴까지 준비되면 글자가 흐리게 나오지 않는다 */
  if ('fonts' in document) {
    try { await (document as Document & { fonts: FontFaceSet }).fonts.ready; } catch { /* 무시 */ }
  }
}
