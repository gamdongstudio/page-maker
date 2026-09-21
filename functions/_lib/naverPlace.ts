/**
 * 네이버 스마트플레이스 공개정보 — 브라우저 없이 HTTP 로만 읽는다.
 *
 * PM Connect 1.0.15 (collectors/naverPlace.js) 와 같은 자료를 같은 모양으로 만든다.
 * m.place.naver.com 화면은 업체 자료를 HTML 안의 window.__APOLLO_STATE__ 에 담아 보내므로
 * 화면을 띄우지 않고 그 JSON 만 읽으면 된다.
 *
 * 하지 않는 일: 로그인 · 글 작성 · 링크 따라가기. 사용자가 넣은 업체 1곳의 home·feed 두 화면만 읽는다.
 */

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', Accept: 'text/html,application/xhtml+xml' };

type Json = Record<string, any>;
export interface FoundImage { url: string; width: number; height: number; alt: string; proxyUrl?: string }
export interface Hours {
  weekly: { day: string; time: string }[];
  offDays: string[];
  breakTime: string;
  lastOrder: string;
  special: string[];
  note: string;
  summary: string;
}
export interface CollectOut {
  ok: true; sourceType: 'naver-place'; url: string;
  title: string; description: string; text: string; images: FoundImage[];
  hours?: Hours; newsImage?: FoundImage;
}

/* ------------------------------------------------------------------ */
/* 주소 → 업체 번호                                                     */
/* ------------------------------------------------------------------ */

export function extractPlaceId(url: string): string | null {
  const patterns = [
    /\/place\/(\d+)/,
    /\/entry\/place\/(\d+)/,
    /(?:restaurant|hairshop|attraction|hospital|accommodation|cafe)\/(\d+)/,
    /[?&]placeId=(\d+)/,
    /[?&]pinId=(\d+)/,
    /[?&]id=(\d+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** 네이버 지도·플레이스·짧은 주소만 받는다 (다른 곳으로 요청을 보내지 않는다) */
export function isPlaceUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:'
      ? /(^|\.)(place\.naver\.com|map\.naver\.com|naver\.me)$/.test(u.hostname)
      : false;
  } catch {
    return false;
  }
}

/** naver.me 짧은 주소는 따라가서 업체 번호를 찾는다 (네이버 안에서만 따라간다) */
async function resolvePlaceId(url: string): Promise<string | null> {
  const direct = extractPlaceId(url);
  if (direct) return direct;
  let cur = url;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(cur, { headers: HEADERS, redirect: 'manual' });
    const loc = res.headers.get('location');
    if (!loc) break;
    cur = new URL(loc, cur).toString();
    if (!/(^|\.)naver\.(com|me)$/.test(new URL(cur).hostname)) break;
    const id = extractPlaceId(cur);
    if (id) return id;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* HTML 안의 __APOLLO_STATE__                                           */
/* ------------------------------------------------------------------ */

function apolloOf(html: string): Json | null {
  const at = html.indexOf('window.__APOLLO_STATE__');
  if (at < 0) return null;
  const start = html.indexOf('{', at);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = start; k < html.length; k++) {
    const c = html[k];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, k + 1)); } catch { return null; }
    }
  }
  return null;
}

async function page(placeId: string, tab: 'home' | 'feed'): Promise<{ html: string; st: Json | null }> {
  const res = await fetch(`https://m.place.naver.com/place/${placeId}/${tab}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`네이버 응답 ${res.status}`);
  const html = await res.text();
  return { html, st: apolloOf(html) };
}

/* ------------------------------------------------------------------ */
/* 업체 자료 (PM Connect readPlaceState / readFeeds 와 같은 규칙)          */
/* ------------------------------------------------------------------ */

interface Menu { name: string; price: string; images: string[] }
interface PlaceState {
  name: string; category: string; address: string; phone: string; talk: string; booking: string;
  description: string; menus: Menu[]; photos: FoundImage[];
}
interface Feed {
  category: string; title: string; desc: string; period: string; images: string[];
  blog: boolean; created: string; firstImage: string;
}

function readPlaceState(st: Json): PlaceState | null {
  const entries = Object.entries(st);
  const deref = (v: any) => (v && v.__ref ? st[v.__ref] : v);
  const field = (o: Json | undefined, name: string) => {
    if (!o) return undefined;
    const k = Object.keys(o).find((x) => x === name || x.startsWith(name + '('));
    return k ? deref(o[k]) : undefined;
  };
  const root = st.ROOT_QUERY || {};
  const pd = field(root, 'placeDetail') || {};
  const baseEntry = entries.find(([k]) => k.startsWith('PlaceDetailBase:'));
  const b: Json = baseEntry ? baseEntry[1] : {};
  if (!b.name) return null;
  const booking = field(pd, 'naverBooking') || {};

  const menus = entries
    .filter(([k]) => k.startsWith('Menu:'))
    .map(([, m]) => ({ name: String(m.name || '').trim(), price: String(m.price || '').trim(), images: (m.images || []) as string[] }))
    .filter((m) => m.name);

  /* 업체가 올린 사진만 (방문자·리뷰·동영상 제외) — 번호 순서대로 */
  const num = (id: string) => Number((id.match(/_(\d+)$/) || [])[1]);
  const photos = entries
    .filter(([k, v]) => k.startsWith('PlaceDetailTopPhotoItem:') && /_business_\d+$/.test(v.id || '') && !v.visitorReview && v.originalUrl)
    .sort((a, c) => num(a[1].id) - num(c[1].id))
    .map(([, v]) => ({ url: v.originalUrl as string, width: v.width || 0, height: v.height || 0, alt: v.title || '' }));

  return {
    name: b.name || '',
    category: b.category || '',
    address: b.roadAddress || b.address || '',
    phone: b.phone || b.virtualPhone || '',
    talk: b.talktalkUrl || '',
    booking: booking.naverBookingUrl || '',
    description: String(field(pd, 'description') || ''),
    menus,
    photos,
  };
}

function readFeeds(st: Json | null): Feed[] {
  return Object.values(st || {})
    .filter((v: any) => v && v.__typename === 'Feed' && !v.isDeleted)
    .map((v: any) => ({
      category: v.category || '',
      title: String(v.title || '').trim(),
      desc: String(v.desc || '').trim(),
      period: String(v.period || '').trim(),
      images: (v.media || []).map((m: any) => m && m.thumbnail).filter(Boolean)
        .concat(v.thumbnail && v.thumbnail.url ? [v.thumbnail.url] : []),
      blog: !!v.blogId,
      created: String(v.createdString || ''),
      firstImage: ((v.media || []).find((m: any) => m && m.mediaType === 'IMAGE' && m.thumbnail) || {}).thumbnail || '',
    }));
}

/* ------------------------------------------------------------------ */
/* 영업시간 — PM Connect placeHours 결과와 같은 모양                         */
/* ------------------------------------------------------------------ */

const DAY = '월화수목금토일';

function readHours(st: Json): Hours | null {
  const root = st.ROOT_QUERY || {};
  const pdKey = Object.keys(root).find((k) => k.startsWith('placeDetail'));
  const pd = pdKey ? (root[pdKey]?.__ref ? st[root[pdKey].__ref] : root[pdKey]) : null;
  const nbKey = pd && Object.keys(pd).find((k) => k.startsWith('newBusinessHours'));
  const list: Json[] = (nbKey && pd[nbKey]) || [];
  const first = list[0];
  if (!first || !Array.isArray(first.businessHours)) return null;

  const weekly: { day: string; time: string }[] = [];
  const offDays: string[] = [];
  const special: string[] = [];
  const notes: string[] = [];
  let breakTime = '', lastOrder = '';
  for (const w of first.businessHours) {
    const day = String(w.day || '');
    const bh = w.businessHours;
    if (bh && bh.start && bh.end) {
      weekly.push({ day, time: `${bh.start} - ${bh.end}` });
      const br = (w.breakHours || [])[0];
      if (br && br.start && !breakTime) breakTime = `${br.start} - ${br.end}`;
      const lo = (w.lastOrderTimes || [])[0];
      if (lo && !lastOrder) lastOrder = typeof lo === 'string' ? lo : (lo.time || '');
    } else if (/휴무/.test(String(w.description || ''))) {
      if (new RegExp(`^[${DAY}]$`).test(day)) { if (!offDays.includes(day)) offDays.push(day); }
      else if (day) special.push(`${day} 휴무`);
    }
    if (w.description && !/정기휴무/.test(w.description)) notes.push(String(w.description));
  }
  if (!weekly.length && !offDays.length) return null;
  const times = [...new Set(weekly.map((w) => w.time))];
  const summary = !weekly.length ? '' : times.length === 1 ? times[0] : weekly.map((w) => `${w.day} ${w.time}`).join(' · ');
  return { weekly, offDays, breakTime, lastOrder, special, note: notes.slice(0, 3).join('\n'), summary };
}

/* ------------------------------------------------------------------ */
/* PageMaker 가 알아보는 글 모양으로 (PM Connect buildPlaceText 와 같다)      */
/* ------------------------------------------------------------------ */

const EVENT_WORD = /(이벤트|할인|쿠폰|프로모션|특가|혜택)/;
const NOTICE_WORD = /(휴무|세미나|강의|참석|참가|운영\s?안내|공지|축제)/;

function won(price: string): string {
  const n = Number(String(price).replace(/[^\d]/g, ''));
  return n ? n.toLocaleString('ko-KR') + '원' : '';
}

function readPeriod(p: string): { text: string; end: Date } | null {
  const d = String(p).match(/(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.?\s*~\s*(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})/);
  if (!d) return null;
  const pad = (x: string) => String(x).padStart(2, '0');
  return {
    text: `${d[1]}.${pad(d[2])}.${pad(d[3])} ~ ${d[4]}.${pad(d[5])}.${pad(d[6])}`,
    /* 한국 날짜 기준 그날 끝까지 (서버 시간대와 무관하게) */
    end: new Date(Date.UTC(Number(d[4]), Number(d[5]) - 1, Number(d[6]), 23 - 9, 59, 59)),
  };
}

function currentEvents(feeds: Feed[]) {
  const now = new Date();
  return feeds
    .filter((f) => (f.category === 'EVENT' || EVENT_WORD.test(f.title)) && !NOTICE_WORD.test(f.title))
    .map((f) => ({ ...f, when: readPeriod(f.period) }))
    .filter((f): f is Feed & { when: { text: string; end: Date } } => !!f.when && f.when.end >= now);
}

function includesFor(price: string, events: Feed[]): string[] {
  const w = won(price);
  if (!w) return [];
  for (const ev of events) {
    const lines = ev.desc.split('\n').map((l) => l.trim());
    const at = lines.findIndex((l) => l.includes(w) || l.includes(w.replace(/,/g, '')));
    if (at < 0) continue;
    const items: string[] = [];
    for (let i = at + 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      if (!/^[•·\-*]/.test(lines[i])) break;
      items.push(lines[i].replace(/^[•·\-*]\s*/, ''));
    }
    if (items.length) return items;
  }
  return [];
}

function splitDescription(desc: string) {
  const paras = desc.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const headAt = paras.findIndex((p) => p.length <= 40 && /(장점|특징)\s*$/.test(p));
  const intro = (headAt > 0 ? paras.slice(0, headAt) : paras.slice(0, 3)).join('\n\n').slice(0, 900);
  let features = paras.filter((p) => /^>/.test(p)).map((p) => p.replace(/^>\s*/, '').replace(/\s*\n\s*/g, ' '));
  const isFieldList = (p: string) => (p.match(/,/g) || []).length >= 6 && (p.match(/(사진|촬영|스냅|액자|상)(,|\s)/g) || []).length >= 6;
  const fields = features.find(isFieldList) || '';
  features = features.filter((p) => p !== fields);
  const philosophy = paras.find((p) => /(철학|원칙|신념|모토)/.test(p)) || '';
  return { intro, fields, features, philosophy };
}

function findPhone(text: string): string {
  const m = String(text).match(/(?<!\d)(0\d{1,3})[-.\s]?(\d{3,4})[-.\s]?(\d{4})(?!\d)/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function buildPlaceText(s: PlaceState, feeds: Feed[], hours: Hours | null, placeId: string): string {
  const events = currentEvents(feeds);
  const L: string[] = [];
  const put = (label: string, v: string) => { if (v) L.push(label + ': ' + v); };

  put('상호', s.name);
  put('업종', s.category);
  put('주소', s.address);
  put('전화', findPhone(s.phone) || findPhone(s.description) || findPhone(events.map((e) => e.desc).join('\n')));
  if (hours && hours.summary) put('영업시간', hours.summary);
  if (hours && hours.offDays.length) {
    put('휴무일', [...new Set(hours.offDays.map((d) => (/^[월화수목금토일]$/.test(d) ? d + '요일' : d)))].join(', '));
  }
  put('예약링크', s.booking);
  put('네이버 톡톡', s.talk);
  put('네이버 플레이스', 'https://m.place.naver.com/place/' + placeId + '/home');

  const withIncludes = s.menus.map((m) => ({ m, inc: includesFor(m.price, events) }));
  const main = withIncludes.find((x) => x.inc.length)
    || withIncludes.find((x) => EVENT_WORD.test(x.m.name))
    || withIncludes[0];
  if (main) {
    L.push('', '[대표 상품]');
    L.push([main.m.name, won(main.m.price)].filter(Boolean).join(' '));
    if (main.inc.length) put('포함사항', main.inc.join(', '));
    const others = withIncludes.filter((x) => x !== main);
    if (others.length) {
      L.push('', '[다른 상품]');
      others.forEach((x) => L.push([x.m.name, won(x.m.price)].filter(Boolean).join(' ')));
    }
  }

  events.forEach((e, i) => {
    L.push('', i === 0 ? '[이벤트]' : '[이벤트 ' + (i + 1) + ']');
    put('이벤트 제목', e.title);
    put('이벤트 기간', e.when.text);
    L.push('이벤트 내용:', e.desc);
  });

  const d = splitDescription(s.description);
  if (d.intro) L.push('', '[소개]', d.intro);
  if (d.fields) L.push('', '[촬영분야]', d.fields);
  if (d.features.length) L.push('', '[주요 특징]', ...d.features.map((f) => '- ' + f));
  if (d.philosophy) L.push('', '[촬영철학]', d.philosophy);

  return L.join('\n');
}

/* ------------------------------------------------------------------ */
/* 사진 (PM Connect placeImages · latestNewsImage 와 같다)                 */
/* ------------------------------------------------------------------ */

const MAX_PLACE_PHOTOS = 10;
const BUSINESS_PHOTO = /^https?:\/\/ldb-phinf\.pstatic\.net\//;
const PROMO_FILE = /(이벤트|할인|쿠폰|가격표|가격|프로모션|특가|혜택|event|promotion|coupon|price|chart)/i;

function originalOf(u: string): string {
  let url = String(u || '');
  const wrapped = url.match(/[?&]src=([^&]+)/);
  if (wrapped) {
    try { url = decodeURIComponent(wrapped[1]); } catch { url = wrapped[1]; }
  }
  return url.split('?')[0];
}

function photoKey(u: string): string {
  let k = originalOf(u);
  try { k = decodeURIComponent(k); } catch { /* 그대로 */ }
  return k.toLowerCase();
}

/** 파일 이름 — UTF-8 로 풀고, 안 되면 EUC-KR 로 풀어본다 (이 환경에서 못 풀면 원래 글자 그대로) */
function fileNameOf(url: string): string {
  const raw = String(url).split('?')[0].split('/').pop() || '';
  const bytes: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '%' && /^[0-9a-f]{2}$/i.test(raw.substr(i + 1, 2))) { bytes.push(parseInt(raw.substr(i + 1, 2), 16)); i += 2; }
    else bytes.push(raw.charCodeAt(i) & 0xff);
  }
  const buf = new Uint8Array(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { /* UTF-8 아님 */ }
  try { return new TextDecoder('euc-kr').decode(buf); } catch { return raw; }
}

/** 홈 화면 HTML 에 보이는 업체 사진 주소 (PM Connect 의 '홈 화면에 보이던 업체 사진' 자리) */
function pagePhotos(html: string): string[] {
  return [...new Set(html.match(/https?:\/\/ldb-phinf\.pstatic\.net\/[^"'\s\\)]+/g) || [])];
}

function placeImages(s: PlaceState, feeds: Feed[], pageUrls: string[]): FoundImage[] {
  const promo = new Set(feeds.flatMap((f) => f.images || []).map(photoKey));
  const seen = new Set<string>();
  const out: FoundImage[] = [];
  const add = (im: FoundImage) => {
    if (out.length >= MAX_PLACE_PHOTOS) return;
    const url = originalOf(im.url);
    const key = photoKey(url);
    if (!BUSINESS_PHOTO.test(url) || seen.has(key) || promo.has(key) || PROMO_FILE.test(fileNameOf(url))) return;
    seen.add(key);
    out.push({ ...im, url });
  };
  s.photos.forEach(add);
  s.menus.forEach((m) => m.images.forEach((u) => add({ url: u, width: 0, height: 0, alt: m.name })));
  pageUrls.forEach((u) => add({ url: u, width: 0, height: 0, alt: s.name }));
  return out;
}

function latestNewsImage(feeds: Feed[]): FoundImage | null {
  const own = feeds.filter((f) => !f.blog && f.created).sort((a, b) => b.created.localeCompare(a.created));
  const latest = own[0];
  if (!latest || !latest.firstImage) return null;
  return { url: originalOf(latest.firstImage), width: 0, height: 0, alt: latest.title || '최신 소식' };
}

function metaOf(html: string, prop: string): string {
  const m = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'));
  return m ? m[1] : '';
}

/* ------------------------------------------------------------------ */
/* 한 번에                                                              */
/* ------------------------------------------------------------------ */

export async function collectSmartPlace(url: string, proxy: (u: string) => string): Promise<CollectOut> {
  const placeId = await resolvePlaceId(url);
  if (!placeId) throw new Error('주소에서 업체를 찾지 못했습니다. 스마트플레이스 주소인지 확인해주세요.');

  const home = await page(placeId, 'home');
  const place = home.st ? readPlaceState(home.st) : null;
  if (!place) throw new Error('업체 정보를 읽지 못했습니다.');

  /* 소식을 못 읽어도 나머지는 넘긴다 */
  const feeds = await page(placeId, 'feed').then((f) => readFeeds(f.st)).catch(() => [] as Feed[]);
  const hours = home.st ? readHours(home.st) : null;

  const withProxy = (im: FoundImage): FoundImage => ({ ...im, proxyUrl: proxy(im.url) });
  const out: CollectOut = {
    ok: true,
    sourceType: 'naver-place',
    url,
    title: place.name,
    description: metaOf(home.html, 'og:description'),
    text: buildPlaceText(place, feeds, hours, placeId),
    images: placeImages(place, feeds, pagePhotos(home.html)).map(withProxy),
  };
  if (hours) out.hours = hours;
  const news = latestNewsImage(feeds);
  if (news) out.newsImage = withProxy(news);
  return out;
}
