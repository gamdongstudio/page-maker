/** 값 표시용 도구 (컴포넌트 파일에서 분리 — 화면 갱신이 깨지지 않게) */

export function formatWon(v: string): string {
  const n = Number(String(v).replace(/[^\d]/g, ''));
  if (!v || Number.isNaN(n) || n <= 0) return '';
  return n.toLocaleString('ko-KR') + '원';
}

/** 배경색을 조금 밝게/어둡게 */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount * 2.55));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount * 2.55));
  const b = Math.max(0, Math.min(255, (num & 255) + amount * 2.55));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/** 배경색 위에서 읽기 좋은 글자색 */
export function pickReadable(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#1b1f27' : '#ffffff';
}
