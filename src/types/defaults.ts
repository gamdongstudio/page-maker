import {
  PROJECT_VERSION,
  type DesignSettings,
  type MenuItem,
  type MenuKind,
  type ProductInfo,
  type ProjectData,
  type StylePreset,
} from './project';

export function uid(prefix = 'id'): string {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

/* ------------------------------------------------------------------ */
/* 메뉴 후보                                                            */
/* ------------------------------------------------------------------ */

export const MENU_CATALOG: { kind: MenuKind; title: string; body: string }[] = [
  { kind: 'main',        title: '메인',            body: '' },
  { kind: 'event',       title: '이벤트·혜택',      body: '' },
  { kind: 'discount',    title: '할인 혜택',        body: '' },
  { kind: 'intro',       title: '촬영상품 소개',     body: '' },
  { kind: 'recommend',   title: '이런 분께 추천',    body: '' },
  { kind: 'benefit',     title: '촬영 구성',        body: '' },
  { kind: 'feature',     title: '상세 특징',        body: '' },
  { kind: 'concept',     title: '콘셉트',          body: '' },
  { kind: 'scene',       title: '사용 장면',        body: '' },
  { kind: 'gallery',     title: '갤러리',          body: '' },
  { kind: 'beforeAfter', title: '보정 전후',        body: '' },
  { kind: 'compare',     title: '가격표 · 상품 비교', body: '' },
  { kind: 'price',       title: '가격 안내',        body: '' },
  { kind: 'review',      title: '후기',            body: '' },
  { kind: 'sns',         title: 'SNS 후기',         body: '' },
  { kind: 'video',       title: '동영상',          body: '' },
  { kind: 'howto',       title: '의상·헤어·메이크업', body: '' },
  { kind: 'shipping',    title: '촬영 안내',        body: '' },
  { kind: 'faq',         title: 'FAQ',            body: '' },
  { kind: 'caution',     title: '유의사항',         body: '' },
  { kind: 'brand',       title: '사진관 소개',      body: '' },
  { kind: 'cta',         title: '예약·문의',        body: '' },
  /* --- 사진관 전용 --- */
  { kind: 'perks',        title: '특별한 혜택',     body: '' },
  { kind: 'shootConcept', title: '촬영 콘셉트',     body: '' },
  { kind: 'process',      title: '촬영 과정',       body: '' },
  { kind: 'prepare',      title: '촬영 전 준비사항', body: '' },
  { kind: 'free',         title: '자유 영역',       body: '' },
];

/**
 * 사진관 상세페이지에서 **꼭 있어야 하는** 영역.
 * 지울 수는 있지만, 지우기 전에 한 번 여쭤본다.
 */
export const KEY_MENU_KINDS: MenuKind[] = ['price', 'event', 'cta'];

/**
 * 새 상세페이지의 기본 구성.
 * 사진관 상세페이지에서 보통 들어가는 순서대로 미리 깔아 둔다.
 * 필요 없으면 숨기거나 지우면 된다 — 없는 것을 새로 찾아 넣는 것보다 쉽다.
 */
export const DEFAULT_MENU_KINDS: MenuKind[] = [
  'main', 'intro', 'recommend', 'benefit', 'gallery',
  'price', 'event', 'process', 'prepare', 'brand', 'cta',
];


/**
 * LITE 에서 보여주는 기본 메뉴.
 * PRO 는 위 후보 전체를 쓴다. (프로그램을 둘로 나누지 않고 노출만 다르게 한다)
 */
export const LITE_MENU_KINDS: MenuKind[] = [
  'main', 'intro', 'event', 'perks', 'price', 'compare', 'shootConcept',
  'benefit', 'recommend', 'gallery', 'process', 'prepare', 'review', 'faq', 'cta', 'free',
];

export function makeMenu(kind: MenuKind, title?: string): MenuItem {
  const found = MENU_CATALOG.find((m) => m.kind === kind);
  return {
    id: uid('menu'),
    kind,
    title: title ?? found?.title ?? '새 메뉴',
    body: found?.body ?? '',
    photoIds: [],
    hidden: false,
    lines: [],
  };
}

/* ------------------------------------------------------------------ */
/* 디자인 프리셋                                                        */
/* ------------------------------------------------------------------ */

export const DESIGN_PRESETS: Record<StylePreset, DesignSettings> = {
  clean: {
    preset: 'clean', background: '#ffffff', primary: '#2f6bff', accent: '#111827', text: '#1f2937',
    titleSize: 34, bodySize: 17, menuGap: 64, padding: 40, photoRadius: 12,
    buttonStyle: 'round', align: 'center', titleFont: 'pretendard', bodyFont: 'pretendard', heroShape: 'auto',
  },
  luxury: {
    preset: 'luxury', background: '#f7f5f2', primary: '#8b7355', accent: '#2b2620', text: '#2b2620',
    titleSize: 36, bodySize: 17, menuGap: 80, padding: 52, photoRadius: 0,
    buttonStyle: 'square', align: 'center', titleFont: 'notoSansKR', bodyFont: 'notoSansKR', heroShape: 'auto',
  },
  emotional: {
    preset: 'emotional', background: '#fbf8f6', primary: '#c9807a', accent: '#6b4f4a', text: '#4a3f3c',
    titleSize: 32, bodySize: 17, menuGap: 72, padding: 44, photoRadius: 20,
    buttonStyle: 'pill', align: 'center', titleFont: 'gmarket', bodyFont: 'spoqa', heroShape: 'auto',
  },
  warm: {
    preset: 'warm', background: '#fffaf3', primary: '#e08a3c', accent: '#8a5a2b', text: '#4a3b2c',
    titleSize: 32, bodySize: 17, menuGap: 64, padding: 40, photoRadius: 16,
    buttonStyle: 'pill', align: 'center', titleFont: 'spoqa', bodyFont: 'spoqa', heroShape: 'auto',
  },
  minimal: {
    preset: 'minimal', background: '#ffffff', primary: '#111111', accent: '#111111', text: '#333333',
    titleSize: 28, bodySize: 16, menuGap: 88, padding: 32, photoRadius: 0,
    buttonStyle: 'square', align: 'left', titleFont: 'pretendard', bodyFont: 'pretendard', heroShape: 'auto',
  },
  bright: {
    preset: 'bright', background: '#ffffff', primary: '#00b8a9', accent: '#0a7c73', text: '#22333b',
    titleSize: 34, bodySize: 17, menuGap: 64, padding: 40, photoRadius: 18,
    buttonStyle: 'pill', align: 'center', titleFont: 'nanumGothic', bodyFont: 'nanumGothic', heroShape: 'auto',
  },
};

/* ------------------------------------------------------------------ */
/* 처음 시작할 때 쓰는 기본값                                             */
/* ------------------------------------------------------------------ */

export const EMPTY_PRODUCT: ProductInfo = {
  name: '', brand: '', category: '', listPrice: '', salePrice: '',
  tagline: '', benefits: '', target: '', description: '',
  shipping: '', howToUse: '', caution: '', buyLink: '', contact: '', etc: '',
};

/* ------------------------------------------------------------------ */
/* 새 프로젝트                                                          */
/* ------------------------------------------------------------------ */

/**
 * 촬영상품을 고르면 그 상품에 맞는 사진관용 초안을 돌려준다.
 *
 * ⚠ 이미 사용자가 적어둔 값이 있으면 **그 값이 우선이다.**
 *   초안은 빈 칸만 채운다. (지어낸 가격 같은 것은 넣지 않는다)
 */
export function studioDraft(productName: string): Partial<ProductInfo> {
  const name = (productName || '').trim();
  if (!name) return {};

  const TAGLINE: { match: string; tagline: string; target: string }[] = [
    { match: '가족', tagline: '우리 가족의 오늘을 오래도록 간직하세요',
      target: '가족의 소중한 순간을 사진으로 남기고 싶은 분' },
    { match: '프로필', tagline: '나를 가장 나답게 보여주는 한 장',
      target: '어울리는 프로필 사진이 필요한 분' },
    { match: '증명', tagline: '규격에 맞게, 자연스럽게',
      target: '규격에 맞는 사진이 바로 필요한 분' },
    { match: '취업', tagline: '첫인상을 단정하게 만들어 드립니다',
      target: '서류에 쓸 단정한 사진이 필요한 분' },
    { match: '아기', tagline: '지금 이 시기는 지금밖에 담을 수 없습니다',
      target: '아이의 지금을 남겨두고 싶은 부모님' },
    { match: '스냅', tagline: '그날의 공기까지 그대로',
      target: '자연스러운 순간을 남기고 싶은 분' },
    { match: '복원', tagline: '오래된 사진을 다시 또렷하게',
      target: '소중한 옛 사진을 되살리고 싶은 분' },
    { match: '장수', tagline: '단정하고 편안하게 담아드립니다',
      target: '기념이 될 사진을 준비하시는 분' },
    { match: '반려', tagline: '우리 아이와 함께한 오늘',
      target: '반려동물과의 지금을 남기고 싶은 분' },
    { match: '웨딩', tagline: '둘이 함께한 시간을 오래 남기세요',
      target: '결혼을 준비하거나 기념하고 싶은 분' },
  ];

  const hit = TAGLINE.find((t) => name.includes(t.match));
  return {
    name,
    category: name,
    tagline: hit?.tagline ?? `${name}, 오래 두고 보고 싶은 한 장`,
    target: hit?.target ?? `${name}을(를) 준비하고 계신 분`,
  };
}

/**
 * 새 프로젝트.
 * 사진관 도구이므로 다른 업종의 샘플 상품은 넣지 않는다.
 * (예전에 커피 샘플이 들어 있어 사진관 사장님이 혼란스러워했다)
 */
export function createProject(_opts?: { sample?: boolean }): ProjectData {
  return {
    version: PROJECT_VERSION,
    id: uid('prj'),
    title: '새 상세페이지',
    updatedAt: Date.now(),
    product: { ...EMPTY_PRODUCT },
    photos: [],
    videos: [],
    menus: DEFAULT_MENU_KINDS.map((k) => makeMenu(k)),
    design: { ...DESIGN_PRESETS.clean },
  };
}
