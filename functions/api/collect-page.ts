import { isPublicHttpUrl, readBlogOrPage } from '../_lib/readHtml';

/**
 * POST /api/collect-page  { url }   — 네이버 블로그 글 · 일반 홈페이지
 *   → PM Connect /v1/collect 와 같은 모양 { ok:true, sourceType, url, title, description, text, images[] }
 *   → 실패하면 { ok:false, reason }
 *
 * 사용자가 넣은 주소 1개만 읽는다 (링크를 따라가지 않는다). 사진은 /api/image-proxy 로 받도록 proxyUrl 을 붙인다.
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
  if (!url || !isPublicHttpUrl(url)) return json({ ok: false, reason: '공개된 웹 주소만 가져올 수 있습니다.' }, 400);

  try {
    const got = await readBlogOrPage(url);
    if (!got.text && got.images.length === 0) {
      return json({ ok: false, reason: '이 페이지에서 글이나 사진을 찾지 못했습니다.' }, 422);
    }
    return json({
      ok: true,
      sourceType: got.sourceType,
      url,
      title: got.ogTitle || got.title || '',
      description: got.description || '',
      text: got.text || '',
      images: got.images.map((im) => ({ ...im, proxyUrl: '/api/image-proxy?url=' + encodeURIComponent(im.url) })),
    });
  } catch (e) {
    return json({ ok: false, reason: e instanceof Error ? e.message : '페이지 정보를 가져오지 못했습니다.' }, 502);
  }
};
