import type { Photo } from '@/types/project';

/**
 * 가져온 사진 살펴보기 — **빼는 게 좋아 보이는 사진**에 이유만 달아둔다.
 *
 * ⚠ 지키는 것
 *  - 자동으로 지우지 않는다. "제외 추천" 표시만 하고 사용자가 고른다.
 *  - 사람·얼굴을 알아보는 일은 하지 않는다. 크기·비율·같은 그림인지만 본다.
 *  - 확신이 없으면 아무 표시도 하지 않는다.
 */

/** 8×8 로 줄여 밝기 평균보다 밝은지 어두운지로 만든 짧은 지문 */
export function photoHash(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 8;
        c.height = 8;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;
        const lum: number[] = [];
        for (let i = 0; i < d.length; i += 4) lum.push(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
        const avg = lum.reduce((a, b) => a + b, 0) / lum.length;
        resolve(lum.map((v) => (v >= avg ? '1' : '0')).join(''));
      } catch {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

function distance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 99;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

/**
 * 새로 들어온 사진들에 지문과 '제외 추천' 이유를 달아준다.
 * 이미 있던 사진(before)과도 견줘 같은 사진을 찾는다.
 */
export async function reviewPhotos(added: Photo[], before: Photo[]): Promise<Photo[]> {
  const known = before.map((p) => p.hash ?? '').filter(Boolean);
  const out: Photo[] = [];

  for (const p of added) {
    const hash = p.hash || (await photoHash(p.dataUrl));
    const w = p.width;
    const h = p.height;
    const ratio = w && h ? w / h : 1;
    let why = '';

    if (Math.min(w, h) < 240) {
      why = '너무 작은 이미지 (아이콘·버튼일 수 있어요)';
    } else if (ratio > 3.2 || ratio < 1 / 3.2) {
      why = '가늘고 긴 이미지 (배너·띠 그림일 수 있어요)';
    } else if (hash && [...known, ...out.map((x) => x.hash ?? '')].some((k) => distance(k, hash) <= 2)) {
      why = '이미 있는 사진과 같은 사진';
    } else if (w < 500) {
      why = '해상도가 낮아 흐리게 보일 수 있어요';
    }

    out.push({ ...p, hash, ...(why ? { exclude: why } : {}) });
  }
  return out;
}

/** 사진을 오른쪽으로 90도 돌린 새 그림 — 원본 비율 그대로, 잘라내지 않는다 */
export function rotateDataUrl(dataUrl: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalHeight;
        c.height = img.naturalWidth;
        const ctx = c.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.translate(c.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, 0, 0);
        const png = /^data:image\/png/.test(dataUrl);
        resolve({
          dataUrl: png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92),
          width: c.width,
          height: c.height,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
