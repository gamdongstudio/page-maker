import type { Photo, PhotoKind } from '@/types/project';

/**
 * 완성 예시에 쓰는 그림.
 *
 * 실제 사람 사진처럼 보이는 가짜 사진을 쓰지 않는다.
 * 부드러운 도형으로 그린 **그림**이고, 모든 그림 구석에 "예시 이미지" 라고 적는다.
 */

const svgUrl = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

const label = (w: number, h: number) =>
  `<text x="${w - 24}" y="${h - 22}" text-anchor="end" font-family="sans-serif" font-size="${Math.round(w / 44)}" fill="rgba(0,0,0,.32)">예시 이미지</text>`;

/** 사람 모양 — 머리와 어깨만 부드럽게 */
function person(cx: number, base: number, size: number, tone: string, headTone = tone): string {
  const head = size * 0.34;
  return [
    `<ellipse cx="${cx}" cy="${base - size * 0.1}" rx="${size * 0.62}" ry="${size * 0.72}" fill="${tone}"/>`,
    `<circle cx="${cx}" cy="${base - size * 1.02}" r="${head}" fill="${headTone}"/>`,
  ].join('');
}

/** 가족 — 창가 빛이 드는 스튜디오 */
export function familyArt(bg: [string, string], tones: string[], w = 1200, h = 800): string {
  const base = h * 0.98;
  const people = [
    person(w * 0.33, base, h * 0.36, tones[0], tones[4] ?? '#e9d6c3'),
    person(w * 0.66, base, h * 0.37, tones[1], tones[4] ?? '#e9d6c3'),
    person(w * 0.46, base + h * 0.06, h * 0.25, tones[2], tones[4] ?? '#efdccb'),
    person(w * 0.56, base + h * 0.08, h * 0.2, tones[3], tones[4] ?? '#f1e1d2'),
  ].join('');
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
<radialGradient id="l" cx=".18" cy=".12" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<rect width="${w}" height="${h}" fill="url(#l)"/>
<rect x="0" y="${h * 0.8}" width="${w}" height="${h * 0.2}" fill="#000" opacity=".05"/>
${people}
${label(w, h)}
</svg>`);
}

/** 한 사람 — 프로필 */
export function portraitArt(bg: [string, string], tone: string, face = '#e8d2bf', w = 900, h = 1200): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<radialGradient id="g" cx=".5" cy=".38" r=".8"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<ellipse cx="${w / 2}" cy="${h * 1.02}" rx="${w * 0.42}" ry="${h * 0.34}" fill="${tone}"/>
<rect x="${w * 0.44}" y="${h * 0.56}" width="${w * 0.12}" height="${h * 0.14}" rx="${w * 0.04}" fill="${face}"/>
<ellipse cx="${w / 2}" cy="${h * 0.46}" rx="${w * 0.16}" ry="${h * 0.14}" fill="${face}"/>
<path d="M${w * 0.33} ${h * 0.44} Q${w / 2} ${h * 0.22} ${w * 0.67} ${h * 0.44} Q${w * 0.64} ${h * 0.33} ${w / 2} ${h * 0.3} Q${w * 0.36} ${h * 0.33} ${w * 0.33} ${h * 0.44}Z" fill="${tone}" opacity=".85"/>
${label(w, h)}
</svg>`);
}

/** 원목 도마 — 일반 상품 */
export function boardArt(bg: [string, string], wood: string, w = 1200, h = 800, tilt = -8): string {
  const bw = w * 0.56;
  const bh = h * 0.42;
  const x = (w - bw) / 2;
  const y = (h - bh) / 2;
  const grain = Array.from({ length: 7 }, (_, i) => {
    const gy = y + bh * (0.16 + i * 0.11);
    return `<path d="M${x + bw * 0.06} ${gy} C${x + bw * 0.3} ${gy - 8} ${x + bw * 0.6} ${gy + 10} ${x + bw * 0.86} ${gy - 4}" stroke="#000" stroke-opacity=".08" stroke-width="3" fill="none"/>`;
  }).join('');
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<g transform="rotate(${tilt} ${w / 2} ${h / 2})">
<rect x="${x + 14}" y="${y + 18}" width="${bw}" height="${bh}" rx="28" fill="#000" opacity=".08"/>
<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="28" fill="${wood}"/>
<rect x="${x + bw}" y="${y + bh * 0.38}" width="${w * 0.08}" height="${bh * 0.24}" rx="${bh * 0.12}" fill="${wood}"/>
<circle cx="${x + bw + w * 0.05}" cy="${y + bh / 2}" r="${bh * 0.055}" fill="${bg[0]}"/>
${grain}
</g>
<ellipse cx="${w * 0.2}" cy="${h * 0.8}" rx="${w * 0.07}" ry="${h * 0.035}" fill="#7d9a6a" opacity=".7" transform="rotate(-24 ${w * 0.2} ${h * 0.8})"/>
<ellipse cx="${w * 0.25}" cy="${h * 0.76}" rx="${w * 0.06}" ry="${h * 0.03}" fill="#8fae78" opacity=".7" transform="rotate(18 ${w * 0.25} ${h * 0.76})"/>
${label(w, h)}
</svg>`);
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
