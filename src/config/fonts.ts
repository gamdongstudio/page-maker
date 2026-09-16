/**
 * 상세페이지에 쓰는 글꼴.
 *
 * 고르는 기준
 *  - 상업적으로 쓸 수 있는 것만 넣는다 (전부 무료 상업용 허용 글꼴)
 *  - 너무 많이 두지 않는다. 다섯 개면 충분하다.
 *  - 고른 글꼴만 불러온다. 굵기도 보통(400)·굵게(700) 두 가지만 받는다.
 *  - 글꼴을 못 받아와도 화면이 깨지지 않게 대체 글꼴을 함께 적어둔다.
 */

export type FontKey = 'pretendard' | 'notoSansKR' | 'spoqa' | 'gmarket' | 'nanumGothic';

export interface FontDef {
  key: FontKey;
  /** 화면에 보이는 이름 */
  name: string;
  /** 어떤 느낌인지 한 마디 */
  feel: string;
  /** 실제로 적용할 글꼴 목록 (뒤쪽은 못 받아왔을 때 쓸 글꼴) */
  stack: string;
  /** 불러올 스타일시트 주소 — 없으면 따로 받아오지 않는다 */
  href?: string;
  /** 스타일시트가 없는 글꼴은 직접 적어준다 (굵기는 두 가지만) */
  face?: string;
  /** 라이선스 (사용자에게 보여주지는 않지만 근거로 남긴다) */
  license: string;
}

const FALLBACK = `'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif`;

export const FONTS: Record<FontKey, FontDef> = {
  pretendard: {
    key: 'pretendard',
    name: 'Pretendard',
    feel: '깔끔하고 무난한',
    stack: `'Pretendard Variable','Pretendard',${FALLBACK}`,
    href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css',
    license: 'SIL Open Font License 1.1',
  },
  notoSansKR: {
    key: 'notoSansKR',
    name: 'Noto Sans KR',
    feel: '단정하고 안정적인',
    stack: `'Noto Sans KR',${FALLBACK}`,
    href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap',
    license: 'SIL Open Font License 1.1',
  },
  spoqa: {
    key: 'spoqa',
    name: 'Spoqa Han Sans Neo',
    feel: '부드럽고 편안한',
    stack: `'Spoqa Han Sans Neo',${FALLBACK}`,
    href: 'https://spoqa.github.io/spoqa-han-sans/css/SpoqaHanSansNeo.css',
    license: 'SIL Open Font License 1.1',
  },
  gmarket: {
    key: 'gmarket',
    name: 'Gmarket Sans',
    feel: '또렷하고 눈에 띄는',
    stack: `'GmarketSans',${FALLBACK}`,
    /* 이 글꼴은 제공되는 스타일시트가 없어 직접 적는다.
       필요한 굵기(보통·굵게)만 받는다. */
    face: [
      "@font-face{font-family:'GmarketSans';font-style:normal;font-weight:400;font-display:swap;",
      "src:url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff') format('woff');}",
      "@font-face{font-family:'GmarketSans';font-style:normal;font-weight:700;font-display:swap;",
      "src:url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff') format('woff');}",
    ].join(''),
    license: '무료 상업용 이용 허용 (G마켓)',
  },
  nanumGothic: {
    key: 'nanumGothic',
    name: '나눔고딕',
    feel: '익숙하고 읽기 쉬운',
    stack: `'Nanum Gothic',${FALLBACK}`,
    href: 'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&display=swap',
    license: 'SIL Open Font License 1.1',
  },
};

export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

/** 처음 쓰는 글꼴 */
export const DEFAULT_FONT: FontKey = 'pretendard';

/** 글꼴 미리보기에 쓰는 예문 — 모든 글꼴에 같은 문장을 보여준다 */
export const FONT_SAMPLE = '우리 가족의 오늘을 오래도록 간직하세요';

/**
 * 예전 작업파일에 들어 있던 글꼴 이름을 지금 목록으로 옮긴다.
 * 옛 파일을 열었을 때 글꼴이 없다고 화면이 깨지면 안 된다.
 */
const OLD_TO_NEW: Record<string, FontKey> = {
  pretendard: 'pretendard',
  nanumMyeongjo: 'notoSansKR',
  gothicA1: 'nanumGothic',
  blackHanSans: 'gmarket',
};

export function normalizeFont(value: unknown): FontKey {
  if (typeof value !== 'string') return DEFAULT_FONT;
  if (value in FONTS) return value as FontKey;
  return OLD_TO_NEW[value] ?? DEFAULT_FONT;
}
