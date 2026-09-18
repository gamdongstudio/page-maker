import type { PhotoSource } from '@/types/project';
import { photoSrc, type ImportResult, type SourceType } from './baroduTools';

/**
 * 가져온 페이지의 사진을 파일로 받아온다.
 *
 * 네이버처럼 사진을 밖에서 바로 받아가지 못하게 막아둔 곳이 있어
 * BARODU Tools 가 대신 받아주는 주소로 요청한다.
 * 받지 못한 사진은 조용히 건너뛰고 몇 장인지 알려준다.
 */

/** 어느 곳에서 왔는지 — 사진 카드 구석 표시용 */
export function photoSourceOf(t: SourceType): PhotoSource {
  if (t === 'naver-blog') return 'blog';
  if (t === 'naver-place') return 'place';
  if (t === 'naver-store') return 'store';
  return 'home';
}

export async function downloadImages(got: ImportResult, max = 20): Promise<{ files: File[]; failed: number }> {
  const urls = got.images
    .filter((im) => got.sourceType !== 'naver-place' || keepPlaceImage(im))
    .map((im) => localImageSrc(got.sourceType, im));
  const files: File[] = [];
  const seen = new Set<string>();
  let tried = 0;

  for (const u of urls) {
    if (files.length >= max) break;
    /*
     * 같은 사진이 여러 번 나오면 한 번만.
     * 대신 받아주는 주소는 앞부분이 모두 같고 진짜 주소가 뒤에 붙으므로 진짜 주소로 견준다.
     */
    const key = originalOf(u);
    if (seen.has(key)) continue;
    seen.add(key);
    tried++;

    try {
      /* 담아둔 답을 쓰지 않고 새로 받는다 (예전에 허락 표시가 없다며 막힌 적이 있다) */
      const res = await fetch(u, { cache: 'reload' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!/^image\//.test(blob.type)) continue;
      files.push(new File([blob], fileNameOf(key, blob.type), { type: blob.type }));
    } catch {
      /* 못 받아오는 사진은 건너뛴다 */
    }
  }
  return { files, failed: tried - files.length };
}


function localImageSrc(source: SourceType, image: ImportResult['images'][number]): string {
  const direct = photoSrc(image);
  if (image.proxyUrl) return direct;

  /*
   * 로컬 collector 성공본은 pstatic 사진을 /api/image 로 대신 받아왔다.
   * PM Connect가 proxyUrl을 주는 경우에는 기존 경로를 그대로 쓴다.
   */
  if (source === 'naver-place' && /(^|\.)pstatic\.net/i.test(safeHost(image.url))) {
    return `/api/image?url=${encodeURIComponent(image.url)}`;
  }
  return direct;
}

function keepPlaceImage(image: ImportResult['images'][number]): boolean {
  const url = String(image.url || '');
  const alt = String(image.alt || '');
  if (/(pup-review|review-phinf|visitor|profile|avatar|emoticon|badge|icon|sprite)/i.test(url)) return false;
  if (/(리뷰|방문자|프로필|광고|가격표|이벤트|할인|쿠폰|프로모션)/.test(alt)) return false;
  return true;
}

function safeHost(raw: string): string {
  try { return new URL(raw).hostname; } catch { return ''; }
}

function originalOf(u: string): string {
  try {
    const parsed = new URL(u, window.location.href);
    const inner = parsed.searchParams.get('url');
    return inner ? inner.split('?')[0] : parsed.origin + parsed.pathname;
  } catch {
    return u.split('?')[0];
  }
}

function fileNameOf(originalUrl: string, mime: string): string {
  const base = (originalUrl.split('/').pop() || 'photo').split('?')[0] || 'photo';
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return `${base}.${ext}`;
}
