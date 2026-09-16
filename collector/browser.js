// 수집 전용 브라우저.
//
// 이 파일은 기존 `naver-blog-auto` (공부 2 폴더) 의 server/lib/browser.js 에서
// **수집에 필요한 부분만** 가져온 것이다.
//  - 가져온 것: openScrapeContext (로그인과 완전히 분리된 일회용 컨텍스트), UA/컨텍스트 설정, 자동화 탐지 회피
//  - 가져오지 않은 것: 로그인 세션(openPersistentContext), 글 작성·발행, 이미지 생성
//
// 기존 프로그램은 건드리지 않았다. 그쪽 자동 발행 기능과 이쪽 정보 가져오기는 역할이 분리돼 있다.

import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-default-browser-check',
  '--no-first-run',
];

const CONTEXT_OPTIONS = {
  userAgent: UA,
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  viewport: { width: 1440, height: 960 },
};

/** navigator.webdriver 를 지운다 */
async function hardenContext(context) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
}

/**
 * 수집 전용 컨텍스트.
 * 로그인 세션을 쓰지 않는다. 공개된 페이지만 읽는다.
 */
export async function openScrapeContext() {
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  const context = await browser.newContext(CONTEXT_OPTIONS);
  await hardenContext(context);
  return {
    context,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
