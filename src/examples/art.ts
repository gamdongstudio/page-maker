import type { Photo, PhotoKind } from '@/types/project';

/**
 * 완성 예시에 쓰는 **사진 자리 표시.**
 *
 * 실제 사람 사진처럼 보이는 가짜 사진을 쓰지 않는다.
 * 예전에는 사람 모양을 도형으로 그렸는데, 둥근 덩어리가 고래·물고기 같은 아이콘으로 보여
 * 눌러야 하는 것인지 헷갈린다는 말이 있었다.
 * 이제는 **은은한 색 바탕에 "사진이 들어갈 자리" 라고만** 적는다. 도형은 그리지 않는다.
 */

const svgUrl = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

function placeholder(bg: [string, string], w: number, h: number, text = '사진이 들어갈 자리'): string {
  const inset = Math.round(Math.min(w, h) * 0.05);
  const fs = Math.round(Math.min(w, h) / 22);
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" rx="${Math.round(inset / 2)}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="2" stroke-dasharray="10 8"/>
<text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${fs}" fill="rgba(0,0,0,.38)">${text}</text>
<text x="${w / 2}" y="${h / 2 + fs * 1.5}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${Math.round(fs * 0.62)}" fill="rgba(0,0,0,.28)">예시</text>
</svg>`);
}

/** 가족사진 자리 (가로) — 두 번째 값은 예전 호출과 맞추려고 남긴 것 */
export function familyArt(bg: [string, string], _tones: string[] = [], w = 1200, h = 800): string {
  return placeholder(bg, w, h);
}

/** 프로필 사진 자리 (세로) */
export function portraitArt(bg: [string, string], _tone = '', _face = '', w = 900, h = 1200): string {
  return placeholder(bg, w, h);
}

/** 상품 사진 자리 (가로) */
export function boardArt(bg: [string, string], _wood = '', w = 1200, h = 800, _tilt = 0): string {
  return placeholder(bg, w, h, '상품 사진이 들어갈 자리');
}

let n = 0;
export function artPhoto(dataUrl: string, w: number, h: number, kind: PhotoKind, name: string): Photo {
  n += 1;
  return {
    id: `ex_photo_${n}`,
    name,
    dataUrl,
    width: w,
    height: h,
    bytes: 0,
    kind,
    fit: 'auto',
    focusX: 50,
    focusY: 45,
    caption: '',
    source: 'upload',
  };
}
