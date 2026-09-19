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
  /* 스마트플레이스는 방문자 리뷰 사진·프로필 아이콘이 함께 섞여 오는 경우가 있다.
     업체 사진으로 확실히 볼 수 있는 큰 사진을 우선하고, 리뷰 계열 URL은 기본 제외한다. */
  const sourceImages = got.sourceType === 'naver-place'
    ? smartPlaceImages(got.images)
    : got.images;
  const urls = sourceImages.map(photoSrc);
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


function smartPlaceImages(images: ImportResult['images']): ImportResult['images'] {
  /* 업체 사진만 남긴다. 걸러서 0장이면 0장 그대로 — 리뷰 사진으로 채우지 않는다.
     순서는 페이지 순서 그대로 두어 첫 업체 사진이 대표 사진이 되게 한다. */
  return images.filter((im) => {
    const u = innerOf(String(im.url || ''));
    const a = String(im.alt || '');
    if (/(pup-review|review-phinf|visitor|profile|avatar|emoticon|badge|icon|sprite)/i.test(u)) return false;
    /* 네이버 사진 서버는 업체가 올린 사진(ldb-phinf)만. myplace=방문자, phinf/contact=프로필, video=동영상 표지 */
    if (/pstatic\.net/i.test(u) && !/ldb-phinf\.pstatic\.net/i.test(u)) return false;
    /* '프로필사진 상반신' 같은 상품 이름은 막지 않는다 — 프로필 아이콘만 뺀다 */
    if (/(리뷰|방문자|광고)|^프로필$|프로필\s*(아이콘|이미지)/.test(a)) return false;
    if (/(이벤트|가격|요금|쿠폰|할인|특가|프로모션|혜택|광고|event|price|coupon|promo|sale)/i.test(fileTitle(u))) return false;
    if (im.width > 0 && im.height > 0 && Math.min(im.width, im.height) < 420) return false;
    if (im.width > 0 && im.height > 0 && (im.width / im.height > 3.2 || im.height / im.width > 3.2)) return false;
    return true;
  });
}

/** search.pstatic.net/common/?src=<원래 주소> 로 감싼 경우 원래 주소 */
function innerOf(u: string): string {
  try {
    const p = new URL(u);
    const src = p.searchParams.get('src');
    return /search\.pstatic\.net$/i.test(p.hostname) && src ? src : u;
  } catch {
    return u;
  }
}

/** 파일 이름 — 사장님이 올린 한글 파일명(EUC-KR 인코딩)도 읽는다 */
function fileTitle(u: string): string {
  const raw = u.split('?')[0].split('/').pop() || '';
  let name = raw;
  try { name = decodeURIComponent(raw); } catch { /* 그대로 */ }
  if (!/%[0-9a-f]{2}/i.test(name)) return name;
  try {
    const bytes: number[] = [];
    for (let i = 0; i < name.length; i++) {
      if (name[i] === '%' && /^[0-9a-f]{2}$/i.test(name.slice(i + 1, i + 3))) {
        bytes.push(parseInt(name.slice(i + 1, i + 3), 16)); i += 2;
      } else bytes.push(name.charCodeAt(i) & 0xff);
    }
    return new TextDecoder('euc-kr').decode(new Uint8Array(bytes));
  } catch {
    return name;
  }
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
