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

/** 사진 탭의 업체 사진만 읽고 방문자 리뷰 사진은 제외한다. */
function readPlacePhotos() {
  const clean = (s) => (s || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
  const original = (raw) => {
    try {
      const u = new URL(raw);
      if (u.hostname === 'search.pstatic.net' && u.pathname === '/common/' && u.searchParams.get('src')) {
        return u.searchParams.get('src');
      }
      if (/pstatic\.net$/.test(u.hostname)) {
        u.searchParams.delete('type');
        u.searchParams.delete('w');
        u.searchParams.delete('h');
      }
      return u.href;
    } catch { return raw; }
  };
  const seen = new Set();
  const images = [];
  for (const img of document.querySelectorAll('img')) {
    const alt = clean(img.alt);
    const photoLink = img.closest('a[href*="filterType="]');
    const href = photoLink?.getAttribute('href') || '';
    const isBusiness = /^business_/i.test(alt) || /filterType=%EC%97%85%EC%B2%B4/i.test(href);
    if (!isBusiness) continue;

    const candidates = [
      img.getAttribute('data-lazy-src'), img.getAttribute('data-src'),
      img.currentSrc, img.src,
      ...(img.srcset || '').split(',').map((x) => x.trim().split(/\s+/)[0]),
    ].filter(Boolean);
    const src = candidates[candidates.length - 1] || '';
    if (!/^https?:/.test(src) || /\.svg($|\?)/i.test(src) || /(profile|icon_default)/i.test(src)) continue;

    const url = original(src);
    /* 가격표·이벤트·쿠폰 홍보물은 갤러리 기본 대상에서 제외한다. */
    if (/(event|promo|coupon|price|menu|%C0%CC%BA%A5%C6%AE|%B0%A1%B0%DD%C7%A5)/i.test(url)) continue;
    if (/(이벤트|할인|쿠폰|가격표|프로모션)/.test(alt)) continue;

    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w > 0 && w < 420) continue;
    if (h > 0 && h < 420) continue;

    const key = url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    images.push({ url, width: w, height: h, alt });
    if (images.length >= 40) break;
  }
  return images;
}

/** 실제 페이지에 존재하는 예약·톡톡 링크만 가져온다. */
function pickPlaceLinks() {
  const links = [...document.querySelectorAll('a[href]')].map((a) => ({
    href: a.href,
    text: (a.innerText || a.getAttribute('aria-label') || '').trim(),
  }));
  return {
    bookingUrl: links.find((x) => /booking\.naver\.com/.test(x.href) && !/\/coupon\//.test(x.href))?.href || '',
    talkUrl: links.find((x) => /talk\.naver\.com/.test(x.href))?.href || '',
  };
}

/**
 * 소식 탭에서 이벤트·할인·쿠폰·프로모션만 남긴다.
 * 일반 공지·휴무 안내는 이벤트 혜택으로 넣지 않는다.
 */
function meaningfulNews(text) {
  const lines = (text || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const promo = /(이벤트|할인|쿠폰|프로모션|특가|혜택|증정)/;
  const stop = /^(홈|쿠폰|소식|예약|리뷰|사진|지도|정보|더보기|공유|알림받기)$/;
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!promo.test(lines[i])) continue;
    const chunk = [lines[i]];
    for (let j = i + 1; j < lines.length && chunk.length < 10; j += 1) {
      if (stop.test(lines[j])) continue;
      if (j > i + 1 && promo.test(lines[j]) && lines[j].length < 100) break;
      chunk.push(lines[j]);
    }
    out.push(...chunk);
    if (out.length >= 120) break;
  }

  return [...new Set(out)].join('\n');
}

/** 상품/예약에서 실제 상품명·가격·구성 문장을 한 덩어리로 넘긴다. */
function productText(home, menu, booking) {
  const between = (text, start, end) => {
    const from = text.indexOf(start);
    if (from < 0) return '';
    const to = text.indexOf(end, from + start.length);
    return text.slice(from, to < 0 ? undefined : to).trim();
  };
  const priceTable = between(home, '가격표', '홈페이지');
  const bookingProduct = (booking || '').split(/\n(?:별점|방문자 리뷰|이용약관)/)[0].trim();
  const menuProduct = (menu || '').split(/\n(?:별점|방문자 리뷰|이용약관)/)[0].trim();
  return [priceTable, menuProduct, bookingProduct].filter(Boolean).join('\n');
}

/** 정보 탭에서 소개·촬영분야·주요특징·촬영철학을 기존 필드용으로 구조화한다. */
function structurePlaceInfo(text) {
  const lines = (text || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const introAt = lines.indexOf('소개');
  const body = lines.slice(introAt >= 0 ? introAt + 1 : 0);
  const featureAt = body.findIndex((x) => /(장점|특징)/.test(x));
  const introLines = (featureAt > 0 ? body.slice(0, featureAt) : body.slice(0, 8))
    .filter((x) => !/^(홈|쿠폰|소식|예약|리뷰|사진|지도|주변|정보)$/.test(x));
  const featureLines = featureAt >= 0 ? body.slice(featureAt + 1, featureAt + 18) : [];
  const categories = [...new Set(
    text.match(/(?:가족|증명|여권|반려동물|프로필|우정|장수|제품|리마인드웨딩|아기|돌|백일|만삭)\s*사진/g) || [],
  )];
  const philosophy = body.filter((x) => /(철학|마음|원칙|최선|노력|정성)/.test(x)).slice(0, 4).join(' ');
  return {
    intro: introLines.slice(0, 8).join('\n'),
    shootingFields: categories.join(', '),
    features: featureLines.join('\n'),
    philosophy,
  };
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await sleep(1100);
  for (let i = 1; i <= 4; i += 1) {
    await page.evaluate((n) => window.scrollTo(0, document.body.scrollHeight * n / 4), i).catch(() => {});
    await sleep(350);
  }
}

async function readPlaceTab(context, root, tab) {
  const p = await context.newPage();
  try {
    await p.goto(`${root}/${tab}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await settle(p);
    if (tab === 'home') {
      await p.locator('[data-nlog-area="plc_btp.bzhour"]').first().click({ timeout: 1500 }).catch(() => {});
      await sleep(300);
    }
    const got = await p.evaluate(readPage);
    if (tab === 'home') {
      got.text = (await p.locator('body').innerText()).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
    }
    return got;
  } finally {
    await p.close().catch(() => {});
  }
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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await settle(page);

    const finalUrl = page.url();
    const id = finalUrl.match(/(?:place|restaurant|hairshop)\/(\d+)/)?.[1]
      || url.match(/(?:place|restaurant|hairshop)\/(\d+)/)?.[1]
      || finalUrl.match(/[?&]placeId=(\d+)/)?.[1]
      || url.match(/[?&]placeId=(\d+)/)?.[1];

    if (!id) {
      const frame = page.frames().find((f) => /entryIframe|place/.test(f.name() || f.url()));
      const got = await (frame ?? page).evaluate(readPage);
      return { ...got, unreadable: isMapChromeOnly(got.text) };
    }

    /*
     * 예전 성공본에서 실제로 검증된 방식:
     * 홈·정보·소식·메뉴·예약을 각각 읽고, 사진 탭에서는 업체 사진만 별도로 읽는다.
     */
    const root = `https://m.place.naver.com/place/${id}`;
    const [home, info, news, menu, booking] = await Promise.all([
      readPlaceTab(page.context(), root, 'home'),
      readPlaceTab(page.context(), root, 'information'),
      readPlaceTab(page.context(), root, 'feed'),
      readPlaceTab(page.context(), root, 'menu'),
      readPlaceTab(page.context(), root, 'booking'),
    ]);

    await page.goto(`${root}/photo`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await settle(page);

    /* 소식 탭에 쓰인 홍보 이미지는 갤러리에서 한 번 더 제외한다. */
    const newsImageKeys = new Set((news.images || []).map((im) => {
      try { return new URL(im.url).searchParams.get('src') || im.url.split('?')[0]; }
      catch { return im.url.split('?')[0]; }
    }));

    const images = (await page.evaluate(readPlacePhotos))
      .filter((im) => !newsImageKeys.has(im.url));

    const photoLinks = await page.evaluate(pickPlaceLinks);

    await page.goto(`${root}/home`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await settle(page);
    const homeLinks = await page.evaluate(pickPlaceLinks);

    const structured = structurePlaceInfo(info.text || home.text);
    const eventNews = meaningfulNews(news.text);
    const products = productText(home.text, menu.text, booking.text);

    return {
      ...home,
      text: [home.text, info.text, eventNews, menu.text, booking.text].filter(Boolean).join('\n'),
      images,
      place: {
        placeUrl: root,
        info: [home.text, info.text].filter(Boolean).join('\n'),
        ...structured,
        news: eventNews,
        products,
        bookingUrl: homeLinks.bookingUrl || photoLinks.bookingUrl,
        talkUrl: homeLinks.talkUrl || photoLinks.talkUrl,
      },
      unreadable: !home.text && !info.text && !products && images.length === 0,
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
      ...(got.place ? { place: got.place } : {}),
    };
  } finally {
    await close();
  }
}
