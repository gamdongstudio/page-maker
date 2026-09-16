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

/** 화면 배율에 영향받지 않도록 원래 크기로 그린다 */
export async function renderDetailCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  const fontEmbedCSS = await embedFontCss(node);

  return withTimeout(
    toCanvas(node, {
      pixelRatio: IMAGE_POLICY.exportScale,
      /* 사진이 data 주소라서 cacheBust 를 켜면 주소가 망가져 멈춘다 — 켜지 않는다 */
      cacheBust: false,
      /* 고른 글꼴을 함께 넣는다. 못 챙겼으면 빈 값이라 예전처럼 동작한다 */
      fontEmbedCSS,
      /* 화면에서 줄여 보던 배율을 없애고 원래 크기로 그린다 */
      style: { transform: 'none', transformOrigin: 'top left' },
      width: SMARTSTORE_DETAIL_WIDTH,
      height: node.scrollHeight,
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

/** 전체를 한 장으로 */
export async function exportWhole(node: HTMLElement): Promise<Blob> {
  const canvas = await renderDetailCanvas(node);
  return canvasToBlob(canvas);
}

/**
 * 자연스러운 자리에서 나눠 여러 장으로.
 * 메뉴와 메뉴 사이(여백)를 우선으로 자른다.
 */
export async function exportSlices(node: HTMLElement, cutHints: number[]): Promise<SliceResult> {
  const canvas = await renderDetailCanvas(node);
  const scale = canvas.width / SMARTSTORE_DETAIL_WIDTH;
  const maxH = Math.round(IMAGE_POLICY.maxSliceHeight * scale);

  const cuts = pickCuts(canvas.height, cutHints.map((y) => Math.round(y * scale)), maxH);

  const blobs: Blob[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const top = cuts[i];
    const h = cuts[i + 1] - top;
    if (h <= 0) continue;
    const part = document.createElement('canvas');
    part.width = canvas.width;
    part.height = h;
    const ctx = part.getContext('2d');
    if (!ctx) continue;
    /* 배경을 흰색으로 깔아 JPG 에서 검게 나오지 않게 한다 */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, part.width, part.height);
    ctx.drawImage(canvas, 0, top, canvas.width, h, 0, 0, canvas.width, h);
    blobs.push(await canvasToBlob(part));
  }

  return { blobs, width: canvas.width, totalHeight: canvas.height };
}

/**
 * 자를 위치 정하기.
 * 메뉴 사이 여백(hints)을 먼저 쓰고, 그래도 너무 길면 그 안에서 더 나눈다.
 */
export function pickCuts(total: number, hints: number[], maxH: number): number[] {
  const sorted = [...new Set(hints.filter((y) => y > 0 && y < total))].sort((a, b) => a - b);
  const cuts: number[] = [0];

  for (const y of sorted) {
    const last = cuts[cuts.length - 1];
    /* 너무 짧은 조각은 만들지 않는다 */
    if (y - last < maxH * 0.35) continue;
    if (y - last > maxH) {
      /* 여백까지 거리가 너무 멀면 중간에서 한 번 더 나눈다 */
      let cur = last;
      while (y - cur > maxH) {
        cur += maxH;
        cuts.push(cur);
      }
    }
    cuts.push(y);
  }

  /* 마지막 조각이 너무 길면 나눈다 */
  let last = cuts[cuts.length - 1];
  while (total - last > maxH) {
    last += maxH;
    cuts.push(last);
  }
  cuts.push(total);

  return [...new Set(cuts)].sort((a, b) => a - b);
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
