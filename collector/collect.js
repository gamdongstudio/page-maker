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

  return {
    title: clean(document.title),
    description: meta('description'),
    ogTitle: meta('title'),
    text,
    images,
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
    let target = url;

    /* 짧은 주소(naver.me)는 한 번 열어 실제 주소를 알아낸다 */
    if (/naver\.me/.test(url)) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      await sleep(1500);
      target = page.url();
    }

    /* 주소에서 가게 번호를 뽑아 가게 화면으로 바꾼다 */
    const id = target.match(/place\/(\d+)/)?.[1];
    if (id) target = `https://pcmap.place.naver.com/place/${id}/home`;

    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(2500);

    /* 내용이 iframe(entryIframe) 안에 있는 경우가 있다 */
    const frame = page.frames().find((f) => /entryIframe/.test(f.name() || ''));
    const where = frame ?? page;

    /* 영업시간은 접혀 있다 — 펼쳐야 요일별 시간이 보인다. 안 되면 그냥 넘어간다 */
    await expandHours(where);

    const got = await where.evaluate(readPage);

    /* 지도 메뉴 글자만 왔는지 본다 — 그러면 못 읽은 것이다 */
    if (isMapChromeOnly(got.text)) {
      return { ...got, text: '', images: [], unreadable: true };
    }
    return got;
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
