/**
 * GET /api/image-proxy?url=<네이버 사진 주소>
 *
 * 네이버 사진은 다른 사이트의 화면이 직접 읽어가지(canvas·fetch) 못한다 (CORS 헤더가 없다).
 * PageMaker 는 사진을 받아 작업에 저장하므로 같은 사이트 주소로 대신 받아 넘긴다.
 * PM Connect /api/v1/image-proxy 와 같은 역할 — 단, 네이버 사진 서버(pstatic.net)만 받는다 (열린 프록시 금지).
 */

const ALLOWED_HOST = /(^|\.)pstatic\.net$/;
const MAX_BYTES = 15 * 1024 * 1024;

export const onRequestGet = async ({ request }: { request: Request }): Promise<Response> => {
  const raw = new URL(request.url).searchParams.get('url') || '';
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response('bad url', { status: 400 });
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return new Response('bad url', { status: 400 });
  if (!ALLOWED_HOST.test(target.hostname)) return new Response('not allowed', { status: 403 });
  target.protocol = 'https:';

  const res = await fetch(target.toString(), {
    headers: { Referer: 'https://m.place.naver.com/', Accept: 'image/*,*/*;q=0.8' },
    cf: { cacheTtl: 86400, cacheEverything: true },
  } as RequestInit);
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.startsWith('image/')) return new Response('image not found', { status: 502 });
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return new Response('too large', { status: 413 });

  return new Response(res.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
