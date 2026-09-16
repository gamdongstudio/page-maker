import type { Photo, PhotoKind } from '@/types/project';
import { shapeOf } from '@/utils/image';

/**
 * 올린 사진을 살펴보고 **역할**을 추천한다.
 *
 * ⚠ 이 기능이 하는 일과 하지 않는 일
 *   한다: 비율 · 크기 · 밝기 · 색감 · 비슷한 사진 묶기 → 어디에 쓰면 좋을지 추천
 *   하지 않는다: 얼굴 알아보기, 사람 수 세기, 나이 짐작, 사진 고치기
 *
 *   사람이나 얼굴을 알아보는 기능은 넣지 않았다.
 *   따라서 "가족 단체사진" 같은 것을 아는 척하지 않는다. 화면에도 그대로 밝힌다.
 *   추천은 어디까지나 추천이고, 사용자가 언제든 바꿀 수 있다.
 */

export interface PhotoHint {
  id: string;
  shape: '가로' | '세로' | '정사각형';
  /** 0~255 */
  bright: number;
  /** 0~1 — 색이 얼마나 진한지 */
  colorful: number;
  /** 비슷한 사진끼리 같은 번호 */
  groupId: number;
  suggested: PhotoKind;
  /** 왜 그렇게 추천했는지 — 사람이 읽는 말 */
  why: string;
}

/** 살펴볼 때 이만큼 줄여서 본다 */
const SAMPLE = 32;

export async function classifyPhotos(photos: Photo[]): Promise<PhotoHint[]> {
  const stats = await Promise.all(photos.map(measure));

  /* 비슷한 사진 묶기 — 갤러리에 같은 장면이 반복되지 않게 */
  const groups: number[] = new Array(stats.length).fill(-1);
  let next = 0;
  for (let i = 0; i < stats.length; i++) {
    if (groups[i] >= 0) continue;
    groups[i] = next;
    for (let j = i + 1; j < stats.length; j++) {
      if (groups[j] >= 0) continue;
      if (similar(stats[i].sig, stats[j].sig)) groups[j] = next;
    }
    next++;
  }

  /* 대표사진 후보 하나 고르기 — 가로가 대문에 안정적이다 */
  let bestIdx = -1;
  let bestScore = -1;
  photos.forEach((p, i) => {
    const s = stats[i];
    const wide = shapeOf(p) === 'landscape' ? 1 : shapeOf(p) === 'square' ? 0.6 : 0.25;
    const bright = 1 - Math.abs(s.bright - 150) / 150;   // 너무 어둡거나 하얗지 않은 쪽
    const big = Math.min(1, p.width / 1600);
    const score = wide * 0.5 + bright * 0.3 + big * 0.2;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  });

  /* 눈에 띄는 사진 한 장만 이벤트 자리로 (여러 장이면 오히려 산만하다) */
  let eventIdx = -1;
  let eventScore = 0;
  photos.forEach((_, i) => {
    if (i === bestIdx) return;
    const s = stats[i];
    const score = s.colorful * (s.bright > 120 ? 1 : 0.5);
    if (score > eventScore) { eventScore = score; eventIdx = i; }
  });

  return photos.map((p, i) => {
    const s = stats[i];
    const shape = shapeOf(p) === 'landscape' ? '가로' : shapeOf(p) === 'portrait' ? '세로' : '정사각형';
    const first = groups.indexOf(groups[i]) === i;

    let suggested: PhotoKind = 'product';
    let why = '';

    if (i === bestIdx) {
      suggested = 'main';
      why = `${shape} 사진이고 밝기가 알맞아 대문에 잘 맞습니다.`;
    } else if (!first) {
      suggested = 'detail';
      why = '앞의 사진과 색·구도가 비슷해 보조 사진으로 두었습니다.';
    } else if (shape === '세로') {
      suggested = 'concept';
      why = '세로 사진이라 콘셉트 자리에 두 장씩 나란히 놓기 좋습니다.';
    } else if (i === eventIdx && s.colorful > 0.35) {
      suggested = 'event';
      why = '색이 진하고 밝아 이벤트 자리에서 눈에 띕니다.';
    } else {
      suggested = 'product';
      why = `${shape} 사진이라 갤러리에 넣기 좋습니다.`;
    }

    return {
      id: p.id,
      shape,
      bright: Math.round(s.bright),
      colorful: Number(s.colorful.toFixed(2)),
      groupId: groups[i],
      suggested,
      why,
    };
  });
}

/* ------------------------------------------------------------------ */

interface Stat { bright: number; colorful: number; sig: number[] }

function measure(photo: Photo): Promise<Stat> {
  return new Promise((resolve) => {
    const fallback: Stat = { bright: 150, colorful: 0.3, sig: [] };
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = SAMPLE;
          c.height = SAMPLE;
          const x = c.getContext('2d', { willReadFrequently: true });
          if (!x) { resolve(fallback); return; }
          x.drawImage(img, 0, 0, SAMPLE, SAMPLE);
          const { data } = x.getImageData(0, 0, SAMPLE, SAMPLE);

          let sum = 0;
          let sat = 0;
          const sig: number[] = [];
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            sum += 0.299 * r + 0.587 * g + 0.114 * b;
            const mx = Math.max(r, g, b);
            const mn = Math.min(r, g, b);
            sat += mx === 0 ? 0 : (mx - mn) / mx;
            /* 색 지문 — 16단계로 뭉뚱그린 값 */
            sig.push((r >> 4) * 256 + (g >> 4) * 16 + (b >> 4));
          }
          const n = data.length / 4;
          c.width = 0;
          c.height = 0;
          resolve({ bright: sum / n, colorful: sat / n, sig });
        } catch {
          resolve(fallback);
        }
      };
      img.onerror = () => resolve(fallback);
      img.src = photo.dataUrl;
    } catch {
      resolve(fallback);
    }
  });
}

/** 색 지문이 얼마나 겹치는지 — 같은 장면에서 연달아 찍은 사진을 묶는다 */
function similar(a: number[], b: number[]): boolean {
  if (!a.length || a.length !== b.length) return false;
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length > 0.6;
}
