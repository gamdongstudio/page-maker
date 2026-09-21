import { collectSmartPlace, isPlaceUrl } from '../_lib/naverPlace';

/**
 * POST /api/collect-smartplace  { url }
 *   → PM Connect /v1/collect 와 같은 모양 { ok:true, sourceType, url, title, description, text, images[], hours?, newsImage? }
 *   → 실패하면 { ok:false, reason }
 *
 * 네이버 스마트플레이스 공개정보만 읽는다. 사진은 같은 사이트의 /api/image-proxy 로 받도록 proxyUrl 을 붙인다.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export const onRequestPost = async ({ request }: { request: Request }): Promise<Response> => {
  let url = '';
  try {
    const body = (await request.json()) as { url?: unknown };
    url = typeof body?.url === 'string' ? body.url.trim() : '';
  } catch {
    return json({ ok: false, reason: '요청 형식이 올바르지 않습니다.' }, 400);
  }
  if (!url || !isPlaceUrl(url)) {
    return json({ ok: false, reason: '네이버 스마트플레이스 주소만 가져올 수 있습니다.' }, 400);
  }

  try {
    const out = await collectSmartPlace(url, (u) => '/api/image-proxy?url=' + encodeURIComponent(u));
    return json(out);
  } catch (e) {
    return json({ ok: false, reason: e instanceof Error ? e.message : '페이지 정보를 가져오지 못했습니다.' }, 502);
  }
};
