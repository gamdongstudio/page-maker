/**
 * 네이버 블로그 · 일반 홈페이지 — 브라우저 없이 HTML 만 읽는다.
 *
 * PM Connect 1.0.15 collectors/readPage.js (브라우저 안에서 돌던 추출 함수) 와 같은 규칙을
 * Cloudflare HTMLRewriter 로 옮겼다. 결과 모양도 같다 { title, description, ogTitle, text, images[] }.
 *
 * 브라우저가 아니므로 못 하는 것: 자바스크립트로 나중에 그려지는 글·사진, 계산된 배경그림(style 속성에 적힌 것만 본다).
 */

declare const HTMLRewriter: any;

export interface PageImage { url: string; width: number; height: number; alt: string; proxyUrl?: string }
export interface PageRead { title: string; description: string; ogTitle: string; text: string; images: PageImage[] }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', Accept: 'text/html,application/xhtml+xml' };
const MAX_HTML = 4 * 1024 * 1024;
const MAX_IMAGES = 40;
const MIN_SIZE = 200;
const MAX_TEXT = 200000;

const SPOTS = ['.se-main-container', '#postViewArea', '.post_ct', 'article', 'main'];
const LINK_CARD = '.se-oglink, .se-module-oglink, .se-oglink-info, .se-placesMap, .se-map, .se-mapInfo, figure.se-oglink, .link_thumb, .oglink';
const BLOCK = 'p, div, br, li, ul, ol, h1, h2, h3, h4, h5, h6, tr, td, th, section, article, header, footer, blockquote, pre, table, dt, dd, figcaption, hr';

/* ------------------------------------------------------------------ */
/* 받기                                                                 */
/* ------------------------------------------------------------------ */

/** 사용자가 넣은 공개 주소만 — 이 컴퓨터·사설망 주소는 받지 않는다 */
export function isPublicHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) return false; /* IP 로 적은 주소는 받지 않는다 */
    return h.includes('.');
  } catch {
    return false;
  }
}

/** HTML 을 받아 글자로 푼다 (EUC-KR 홈페이지도 있다) */
export async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`페이지 응답 ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (type && !/html|xml/i.test(type)) throw new Error('웹 페이지가 아닙니다.');
  const buf = new Uint8Array(await res.arrayBuffer()).slice(0, MAX_HTML);
  const head = new TextDecoder('latin1').decode(buf.slice(0, 4096));
  const charset = (type.match(/charset=([\w-]+)/i)?.[1] || head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] || 'utf-8').toLowerCase();
  let html: string;
  try { html = new TextDecoder(charset).decode(buf); } catch { html = new TextDecoder('utf-8').decode(buf); }
  return { html, finalUrl: res.url || url };
}

/* ------------------------------------------------------------------ */
/* 읽기 (readPage 와 같은 규칙)                                          */
/* ------------------------------------------------------------------ */

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch { return m; }
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const clean = (s: string) => decode(s || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();

function fromSrcset(v: string | null): string {
  if (!v) return '';
  const list = v.split(',').map((p) => p.trim().split(/\s+/)).filter((p) => p[0]);
  if (!list.length) return '';
  let best = list[0], bestN = -1;
  for (const p of list) {
    const n = parseInt(p[1] || '0', 10) || 0;
    if (n >= bestN) { bestN = n; best = p; }
  }
  return best[0];
}

const sameKey = (u: string) => { try { const p = new URL(u); return p.origin + p.pathname; } catch { return u.split('?')[0]; } };

function biggerIfNaver(u: string): string {
  try {
    const p = new URL(u);
    if (!/(^|\.)pstatic\.net$/.test(p.hostname) || !p.searchParams.has('type')) return u;
    const now = p.searchParams.get('type') || '';
    if (!/^w\d+$/.test(now) || parseInt(now.slice(1), 10) >= 966) return u;
    p.searchParams.set('type', 'w966');
    return p.href;
  } catch {
    return u;
  }
}

const looksNotPhoto = (u: string) =>
  /(logo|icon|btn|button|sprite|blank|spacer|profile|emoticon|sticker|badge|banner|ad[_-]|advert|favicon|avatar|noimage|no_img)/i.test(u)
  || /dthumb-phinf\.pstatic\.net/i.test(u)
  || /[?&]type=ff\d+/i.test(u);

interface RawImg { src: string; w: number; h: number; alt: string; spots: number[]; card: boolean }

export async function readHtml(html: string, baseUrl: string): Promise<PageRead> {
  const abs = (c: string) => { try { const a = new URL(decode(c), baseUrl).href; return /^https?:/.test(a) ? a : ''; } catch { return ''; } };

  let skip = 0, card = 0;
  const spotText: string[] = [];          // 자리(본문 후보)마다 글
  const openSpots: number[] = [];          // 지금 안에 있는 자리들
  let body = '';
  const imgs: RawImg[] = [];
  const bgs: { src: string; spots: number[] }[] = [];
  let title = '';
  let inTitle = false;
  const meta: Record<string, string> = {};

  const push = (s: string) => {
    if (skip) return;
    body += s;
    for (const i of openSpots) spotText[i] += s;
  };

  let rw = new HTMLRewriter()
    .on('script, style, noscript, template, svg, iframe', {
      element(el: any) { skip++; el.onEndTag(() => { skip--; }); },
    })
    .on(LINK_CARD, { element(el: any) { card++; el.onEndTag(() => { card--; }); } })
    .on(BLOCK, { element() { push('\n'); } })
    .on('title', { element(el: any) { inTitle = true; el.onEndTag(() => { inTitle = false; }); } })
    .on('meta', {
      element(el: any) {
        const k = (el.getAttribute('name') || el.getAttribute('property') || '').toLowerCase();
        const v = el.getAttribute('content');
        if (k && v && !(k in meta)) meta[k] = v;
      },
    })
    .on('img', {
      element(el: any) {
        if (skip) return;
        const cands = [
          el.getAttribute('data-lazy-src'), el.getAttribute('data-src'), el.getAttribute('data-original'), el.getAttribute('data-echo'),
          fromSrcset(el.getAttribute('srcset')), fromSrcset(el.getAttribute('data-srcset')), el.getAttribute('src'),
        ];
        let src = '';
        for (const c of cands) {
          if (!c || /^data:/i.test(c) || /(blank|spacer|dummy|placeholder|loading)/i.test(c)) continue;
          src = abs(c);
          if (src) break;
        }
        if (!src) return;
        const num = (a: string) => parseInt(el.getAttribute(a) || '0', 10) || 0;
        imgs.push({ src, w: num('width') || num('data-width'), h: num('height') || num('data-height'), alt: clean(el.getAttribute('alt') || ''), spots: [...openSpots], card: card > 0 });
      },
    })
    .on('[style*="url("]', {
      element(el: any) {
        if (skip) return;
        const m = (el.getAttribute('style') || '').match(/background(?:-image)?\s*:[^;]*url\((['"]?)(.*?)\1\)/i);
        const src = m && !/^data:/i.test(m[2]) ? abs(m[2]) : '';
        if (src) bgs.push({ src, spots: [...openSpots] });
      },
    });

  for (const sel of SPOTS) {
    rw = rw.on(sel, {
      element(el: any) {
        const id = spotText.push('') - 1;
        openSpots.push(id);
        el.onEndTag(() => { const at = openSpots.indexOf(id); if (at >= 0) openSpots.splice(at, 1); });
      },
    });
  }

  rw = rw.onDocument({
    text(t: any) {
      if (inTitle) { title += t.text; return; }
      push(t.text);
    },
  });

  await rw.transform(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })).arrayBuffer();

  /* 글이 가장 많은 자리 — 다 짧으면 페이지 전체 */
  let main = -1, most = 0;
  spotText.forEach((t, i) => { const n = clean(t).length; if (n > most) { most = n; main = i; } });
  if (most < 50) main = -1;
  const lines = (s: string) => s.split('\n').map((l) => clean(l)).filter(Boolean).join('\n').slice(0, MAX_TEXT);
  const text = lines(main >= 0 ? spotText[main] : body);

  /* 사진 — 본문 안(작은 사진도 진짜) 먼저, 그다음 페이지 전체 */
  const seen = new Set<string>();
  const images: PageImage[] = [];
  const scopes = main >= 0 ? [{ inMain: true, floor: 120 }, { inMain: false, floor: MIN_SIZE }] : [{ inMain: false, floor: MIN_SIZE }];
  for (const scope of scopes) {
    for (const im of imgs) {
      if (images.length >= MAX_IMAGES) break;
      if (scope.inMain && !im.spots.includes(main)) continue;
      if (/\.svg($|\?)/i.test(im.src) || looksNotPhoto(im.src) || im.card) continue;
      if ((im.w > 0 && im.w < scope.floor) || (im.h > 0 && im.h < scope.floor)) continue;
      const src = biggerIfNaver(im.src);
      const key = sameKey(src);
      if (seen.has(key)) continue;
      seen.add(key);
      images.push({ url: src, width: im.w, height: im.h, alt: im.alt });
    }
  }
  /* <img> 로 찾은 사진이 적으면 style 에 적힌 배경그림도 본다 */
  if (images.length < 3) {
    for (const b of bgs) {
      if (images.length >= MAX_IMAGES) break;
      if (main >= 0 && !b.spots.includes(main)) continue;
      if (/\.svg($|\?)/i.test(b.src) || looksNotPhoto(b.src)) continue;
      const key = sameKey(b.src);
      if (seen.has(key)) continue;
      seen.add(key);
      images.push({ url: biggerIfNaver(b.src), width: 0, height: 0, alt: '' });
    }
  }

  return {
    title: clean(title),
    description: clean(meta['description'] || meta['og:description'] || ''),
    ogTitle: clean(meta['og:title'] || ''),
    text,
    images,
  };
}

/* ------------------------------------------------------------------ */
/* 네이버 블로그 — 본문이 mainFrame 안에 있으므로 그 주소를 한 번 더 받는다     */
/* ------------------------------------------------------------------ */

export async function readBlogOrPage(url: string): Promise<PageRead & { sourceType: 'naver-blog' | 'website' }> {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const isBlog = /(^|\.)blog\.naver\.com$/.test(host);
  let { html, finalUrl } = await fetchHtml(url);
  if (isBlog) {
    const frame = html.match(/<iframe[^>]*id=["']mainFrame["'][^>]*>/i)?.[0] || '';
    const src = frame.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    if (src) {
      const next = new URL(decode(src), 'https://blog.naver.com').href;
      ({ html, finalUrl } = await fetchHtml(next));
    }
  }
  const got = await readHtml(html, finalUrl);
  return { ...got, sourceType: isBlog ? 'naver-blog' : 'website' };
}
