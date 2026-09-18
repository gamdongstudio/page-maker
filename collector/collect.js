import { openScrapeContext, sleep } from './browser.js';

/**
 * 사용자가 적어준 **공개 페이지 한 개**를 열어 상세페이지 제작에 쓸 자료를 읽어온다.
 *
 * 하는 일
 *  - 사용자가 직접 넣은 주소 하나만 연다
 *  - 글과 사진 주소를 읽어 돌려준다
 *
 * 하지 않는 일
 *  - 로그인 (아이디·비밀번호를 받지 않는다)
 *  - 글 작성·발행·수정 (읽기만 한다)
 *  - 사이트 전체 훑기 (링크를 따라가지 않는다)
 *
 * 페이지 구조가 바뀌면 아래 EXTRACTORS 만 고치면 된다.
 */

/** 주소를 보고 어떤 페이지인지 가른다 */
export function detectSource(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (/(^|\.)blog\.naver\.com$/.test(host) || /^m\.blog\.naver\.com$/.test(host)) return 'naver-blog';
    if (/place\.naver\.com|map\.naver\.com|naver\.me/.test(host)) return 'naver-place';
    return 'website';
  } catch {
    return 'website';
  }
}

/* ------------------------------------------------------------------ */
/* 페이지 안에서 도는 코드 — 바깥 변수를 쓰지 않는다                      */
/* ------------------------------------------------------------------ */

function readPage() {
  const clean = (s) => (s || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();

  /*
   * 글.
   *
   * 예전에는 아래 차례대로 보다가 **처음 있는 것**을 썼다.
   * 그런데 홈페이지 중에는 <main> 같은 자리가 있으면서 속은 비어 있는 곳이 있어서
   * (내용을 다른 칸에 그려 넣는 경우) 글을 0자로 돌려주는 일이 있었다.
   * 이제는 **글이 가장 많은 곳**을 고른다. 다 짧으면 페이지 전체를 쓴다.
   */
  const spots = ['.se-main-container', '#postViewArea', 'article', 'main'];
  let main = null;
  let most = 0;
  for (const spot of spots) {
    for (const el of document.querySelectorAll(spot)) {
      const len = (el.innerText || '').trim().length;
      if (len > most) { most = len; main = el; }
    }
  }
  /* 골라낸 곳이 너무 짧으면 믿지 않는다 */
  if (!main || most < 50) main = document.body;

  const text = clean(main?.innerText || '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');

  /* 사진 — 크기와 주소로 1차만 거른다 (사람·얼굴은 보지 않는다) */
  const seen = new Set();
  const images = [];
  for (const img of document.querySelectorAll('img')) {
    const src = img.currentSrc || img.src || '';
    if (!src || !/^https?:/.test(src)) continue;
    if (/\.svg($|\?)/i.test(src)) continue;
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    /* 아이콘·로고·버튼처럼 아주 작은 것은 뺀다 */
    if (w > 0 && w < 200) continue;
    if (h > 0 && h < 200) continue;
    if (/(logo|icon|btn|button|sprite|blank|profile|emoticon|badge)/i.test(src)) continue;
    const key = src.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    images.push({ url: src, width: w, height: h, alt: clean(img.alt) });
    if (images.length >= 40) break;
  }

  const meta = (name) =>
    clean(document.querySelector(`meta[name="${name}"]`)?.content
      || document.querySelector(`meta[property="og:${name}"]`)?.content || '');

  /* 스마트플레이스의 톡톡·예약·홈페이지처럼 실제로 존재하는 링크만 읽는다. */
  const links = [];
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.href || '';
    if (!/^https?:/i.test(href)) continue;
    const label = clean(a.innerText || a.getAttribute('aria-label') || a.title || '');
    if (!label && !/(talk\.naver\.com|booking\.naver\.com|map\.naver\.com|place\.naver\.com)/i.test(href)) continue;
    links.push({ label, href });
    if (links.length >= 80) break;
  }

  return {
    title: clean(document.title),
    description: meta('description'),
    ogTitle: meta('title'),
    text,
    images,
    links,
  };
}

/* ------------------------------------------------------------------ */

const EXTRACTORS = {
  /**
   * 네이버 블로그는 본문이 iframe(#mainFrame) 안에 있다.
   * 그래서 iframe 주소로 한 번 더 들어간다.
   */
  'naver-blog': async (page, url) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(800);

    const frameSrc = await page.evaluate(() => {
      const f = document.querySelector('#mainFrame');
      return f ? f.getAttribute('src') : '';
    }).catch(() => '');

    if (frameSrc) {
      const abs = new URL(frameSrc, 'https://blog.naver.com').href;
      await page.goto(abs, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(1200);
    }
    /* 사진은 화면에 보여야 붙는다 — 한 번에 맨 아래로 가면 중간 사진이 빠진다 */
    await slowScroll(page);
    return page.evaluate(readPage);
  },

  /**
   * 스마트플레이스 — 공개적으로 보이는 범위만.
   *
   * 지도 화면(map.naver.com)으로 열면 지도 메뉴 글자만 읽혀서 영업시간·주소를 못 가져온다.
   * 가게 내용은 pcmap.place.naver.com 쪽에 있으므로 그 주소로 맞춰 연다.
   *
   * 네이버 쪽 화면이 자주 바뀌는 곳이라 **안 될 수 있다.**
   * 안 되면 읽은 척하지 않고 그대로 알린다.
   */
  'naver-place': async (page, url) => {
    /*
     * 스마트플레이스는 홈 한 화면만 읽지 않는다.
     * 정보·소식·예약·사진을 각각 읽어 합치되, 사진은 '업체' 사진을 우선한다.
     * 리뷰 사진/프로필 아이콘/배너는 기본 제외한다.
     */
    const { id, canonical } = await resolvePlace(page, url);
    if (!id) {
      const got = await page.evaluate(readPage).catch(() => null);
      return got ? { ...got, unreadable: isMapChromeOnly(got.text) } : {
        title: '', description: '', ogTitle: '', text: '', images: [], links: [], unreadable: true,
      };
    }

    const tabs = [
      ['홈', 'home'],
      ['정보', 'information'],
      ['소식', 'feed'],
      ['예약', 'booking'],
    ];

    const chunks = [];
    const allLinks = [];
    let title = '';
    let description = '';
    let homeImages = [];

    for (const [label, path] of tabs) {
      const target = `https://pcmap.place.naver.com/place/${id}/${path}`;
      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await sleep(path === 'home' ? 2200 : 1600);
        const frame = page.frames().find((f) => /entryIframe/.test(f.name() || ''));
        const where = frame ?? page;
        if (path === 'home' || path === 'information') await expandHours(where);
        if (path === 'feed' || path === 'booking') await slowScroll(where, 4);

        const got = await where.evaluate(readPage);
        if (!title) title = got.ogTitle || got.title || '';
        if (!description) description = got.description || '';
        if (got.text && !isMapChromeOnly(got.text)) chunks.push(`[${label}]\n${got.text}`);
        if (Array.isArray(got.links)) allLinks.push(...got.links);
        if (path === 'home') homeImages = got.images || [];
      } catch {
        /* 탭 하나를 못 읽어도 나머지는 계속한다. */
      }
    }

    /* 사진 탭은 업체 사진을 우선해서 읽고, 충분히 큰 원본만 남긴다. */
    let businessImages = [];
    try {
      await page.goto(`https://pcmap.place.naver.com/place/${id}/photo`, {
        waitUntil: 'domcontentloaded', timeout: 25000,
      });
      await sleep(1800);
      const frame = page.frames().find((f) => /entryIframe/.test(f.name() || ''));
      const where = frame ?? page;

      /* '업체' 필터가 있으면 그 필터만 누른다. 리뷰/방문자 탭은 누르지 않는다. */
      try {
        const owner = where.getByText('업체', { exact: true }).first();
        await owner.click({ timeout: 2500 });
        await sleep(1000);
      } catch { /* 필터가 없으면 현재 사진 탭을 그대로 읽는다. */ }

      await slowScroll(where, 8);
      const photo = await where.evaluate(readPage);
      businessImages = (photo.images || []).filter(isBusinessPhoto);
      if (Array.isArray(photo.links)) allLinks.push(...photo.links);
    } catch {
      businessImages = [];
    }

    const images = uniqueImages(
      businessImages.length ? businessImages : (homeImages || []).filter(isBusinessPhoto),
    ).slice(0, 40);

    /* 실제 존재하는 공개 링크만 글 끝에 붙여 파서가 기존 필드에 넣을 수 있게 한다. */
    const linkLines = placeLinkLines(allLinks, canonical);
    if (linkLines.length) chunks.push(`[링크]\n${linkLines.join('\n')}`);

    const text = chunks.join('\n\n').trim();
    return {
      title,
      description,
      ogTitle: title,
      text,
      images,
      links: allLinks,
      unreadable: !text && images.length === 0,
    };
  },

  /** 일반 홈페이지 */
  website: async (page, url) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(1200);
    await slowScroll(page);
    return page.evaluate(readPage);
  },
};

/* ------------------------------------------------------------------ */

/**
 * 스마트플레이스 주소에서 업체 번호를 찾는다.
 * naver.me 는 실제 주소까지 한 번 따라간다.
 */
async function resolvePlace(page, url) {
  let target = url;
  if (/naver\.me/i.test(target)) {
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(1200);
      target = page.url();
    } catch { /* 아래에서 원래 주소도 다시 본다. */ }
  }

  let id = target.match(/place\/(\d+)/)?.[1]
    || target.match(/[?&]placeId=(\d+)/i)?.[1]
    || '';

  /* 검색 결과 화면이라면 entryIframe 주소에서도 번호를 찾는다. */
  if (!id) {
    try {
      const src = await page.evaluate(() =>
        document.querySelector('#entryIframe')?.getAttribute('src') || '',
      );
      id = src.match(/place\/(\d+)/)?.[1] || '';
    } catch { /* 못 찾으면 빈 값 */ }
  }

  return {
    id,
    canonical: id ? `https://map.naver.com/p/entry/place/${id}` : target,
  };
}

/** 리뷰/프로필/광고 이미지를 빼고 업체 사진으로 볼 수 있는 것만 남긴다. */
function isBusinessPhoto(im) {
  const url = String(im?.url || '');
  const alt = String(im?.alt || '');
  const w = Number(im?.width || 0);
  const h = Number(im?.height || 0);

  if (!/^https?:/i.test(url)) return false;
  if (/(pup-review|review-phinf|visitor|profile|avatar|emoticon|badge|icon|logo|sprite)/i.test(url)) return false;
  if (/(리뷰|방문자|프로필|광고)/.test(alt)) return false;
  if (w && h && Math.min(w, h) < 420) return false;
  if (w && h && (w / h > 3.2 || h / w > 3.2)) return false;
  return true;
}

function uniqueImages(images) {
  const seen = new Set();
  const out = [];
  for (const im of images || []) {
    const key = String(im?.url || '').replace(/[?&](?:type|w|h|width|height)=[^&]*/gi, '').split('?')[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(im);
  }
  return out;
}

/**
 * 실제 발견한 링크만 전달한다.
 * 톡톡 링크가 없으면 절대 임의로 만들지 않는다.
 */
function placeLinkLines(links, canonical) {
  const out = [];
  const add = (label, href) => {
    if (!href || out.some((x) => x.endsWith(href))) return;
    out.push(`${label}: ${href}`);
  };

  add('네이버 플레이스', canonical);
  for (const x of links || []) {
    const href = String(x?.href || '');
    const label = String(x?.label || '');
    if (/talk\.naver\.com/i.test(href)) add('네이버 톡톡', href);
    else if (/booking\.naver\.com/i.test(href) || /예약/.test(label)) add('예약링크', href);
  }
  return out;
}

/**
 * 조금씩 나눠 내려간다.
 * 한 번에 맨 아래로 뛰면 중간 사진들이 화면에 보이지 않아 붙지 않는다.
 * (블로그에서 사진이 한 장만 오던 이유)
 */
async function slowScroll(page, steps = 6) {
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((n) => {
      window.scrollTo(0, (document.body.scrollHeight * n) / 6);
    }, i).catch(() => {});
    await sleep(500);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await sleep(600);
}

/**
 * 스마트플레이스의 영업시간은 '펼쳐보기' 를 눌러야 요일별로 보인다.
 * 누르는 곳을 못 찾아도 그냥 넘어간다 — 나머지는 그대로 읽는다.
 */
async function expandHours(where) {
  /* '펼쳐보기' 딱 그것만 누른다.
     '더보기' 처럼 넓게 잡으면 사진·홈페이지 쪽으로 넘어가 버려서
     오히려 읽을 내용이 사라진다 (814자 → 202자). */
  try {
    const btn = where.getByText('펼쳐보기', { exact: true }).first();
    await btn.click({ timeout: 3000 });
    await sleep(1200);
  } catch {
    /* 못 눌러도 문제 없다 — 나머지는 그대로 읽는다 */
  }
}

/** 가게 내용 대신 지도 메뉴 글자만 왔는지 */
function isMapChromeOnly(text) {
  if (!text) return true;
  const mapWords = ['지도 홈', '길찾기', '지적편집도', '거리뷰', '반경측정', '면적측정', '패널 접기', '위성지도'];
  const hits = mapWords.filter((w) => text.includes(w)).length;
  return hits >= 3 || /요청하신 페이지를 찾을 수 없습니다/.test(text);
}

/* ------------------------------------------------------------------ */

export async function collectFromUrl(url) {
  const sourceType = detectSource(url);
  const run = EXTRACTORS[sourceType] ?? EXTRACTORS.website;

  const { context, close } = await openScrapeContext();
  try {
    const page = await context.newPage();
    /* 무거운 것은 받지 않는다 — 빠르고 가볍게 */
    await page.route('**/*', (route) => {
      const t = route.request().resourceType();
      if (t === 'media' || t === 'font') return route.abort();
      return route.continue();
    }).catch(() => {});

    const got = await run(page, url);
    return {
      ok: true,
      sourceType,
      url,
      title: got.ogTitle || got.title || '',
      description: got.description || '',
      text: got.text || '',
      images: got.images || [],
      /* 열기는 했지만 가게 내용을 못 읽은 경우 — 읽은 척하지 않는다 */
      unreadable: !!got.unreadable,
    };
  } finally {
    await close();
  }
}
