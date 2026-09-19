import type { MenuKind, Photo, ProjectData } from '@/types/project';
import { shapeOf } from '@/utils/image';
import { stripBanned } from './types';

/**
 * 사진관 상세페이지 자동 구성.
 *
 * 사진 몇 장과 촬영상품 이름만 있으면 상세페이지 한 벌을 통째로 짠다.
 * 메뉴 구성 · 순서 · 제목 · 설명 · 사진 배치 · 검색 제목 · 대문 카피까지.
 *
 * ⚠ 지키는 것
 *  1. 사진을 **새로 만들지 않는다.** 올린 사진을 고르고 놓기만 한다.
 *     얼굴·표정·머리·옷·체형은 어떤 경우에도 건드리지 않는다. (docs/PHOTO-POLICY.md)
 *  2. 가격·전화번호·주소처럼 **틀리면 안 되는 값은 지어내지 않는다.**
 *     모르면 비워두고 "확인이 필요합니다" 라고 알린다.
 *  3. 아직 진짜 AI 에 연결돼 있지 않다. 규칙으로 짠 결과라고 화면에 그대로 밝힌다.
 */

export interface PlannedMenu {
  kind: MenuKind;
  title: string;
  body: string;
  lines: string[];
  photoIds: string[];
  template: string;
  /**
   * 확인된 내용이 없어 숨겨두는 섹션.
   * 없는 값을 지어내 채우지 않는다. 내용을 넣으면 사용자가 보이게 할 수 있다.
   */
  hidden?: boolean;
}

export interface StudioPlan {
  sourceLabel: string;
  productName: string;
  /** 실제 상품명에 가까운 보조 제목 (후보 맨 아래 '상품정보형') — 없으면 빈 값 */
  productTitle: string;
  searchTitles: string[];
  heroCopy: string[];
  subCopy: string;
  audience: string;
  mainPhotoId: string;
  menus: PlannedMenu[];
  /** 사용자가 확인해야 하는 것 */
  needsCheck: string[];
  /** 내용이 없어 숨겨둔 섹션 이름 */
  hiddenTitles: string[];
  /** 일반적인 내용으로 채워 둔 섹션 이름 (사진관에 맞게 고쳐야 한다) */
  draftTitles: string[];
}

/* ------------------------------------------------------------------ */
/* 촬영상품별 기본 구성                                                  */
/* ------------------------------------------------------------------ */

interface Recipe {
  /** 이 상품으로 볼 낱말들 */
  match: string[];
  menus: MenuKind[];
  audience: string;
  benefits: string[];
  concepts: string[];
  process: string[];
  prepare: string[];
  faq: string[];
  mood: string;
}

const BASE_PROCESS = ['예약 문의', '촬영일 상담', '촬영', '사진 고르기', '보정', '완성본 전달'];

const RECIPES: Recipe[] = [
  {
    match: ['가족', '부모님', '환갑', '칠순', '대가족'],
    menus: ['main', 'intro', 'recommend', 'shootConcept', 'benefit', 'event', 'perks', 'price', 'gallery', 'process', 'howto', 'prepare', 'caution', 'brand', 'review', 'cta'],
    audience: '온 가족이 함께 기념이 될 사진을 남기고 싶은 분',
    benefits: ['가족 모두가 편안하게 촬영할 수 있는 공간', '아이와 어르신 속도에 맞춘 촬영 진행', '오래 걸어둘 수 있는 보정과 액자'],
    concepts: ['캐주얼', '리마인드', '경성', '정장'],
    process: BASE_PROCESS,
    prepare: ['가족끼리 색을 맞춘 옷차림', '촬영 30분 전 도착', '아이가 있다면 여벌 옷과 간식'],
    faq: ['몇 명까지 촬영할 수 있나요?', '촬영 시간은 얼마나 걸리나요?', '주차는 가능한가요?'],
    mood: '따뜻하고 편안한',
  },
  {
    match: ['프로필', '오디션', '배우', '작가'],
    menus: ['main', 'intro', 'recommend', 'shootConcept', 'benefit', 'event', 'price', 'gallery', 'process', 'howto', 'prepare', 'caution', 'brand', 'cta'],
    audience: '나를 잘 보여줄 사진이 필요한 분',
    benefits: ['표정과 각도를 함께 찾아가는 촬영', '용도에 맞춘 다양한 컷', '자연스러운 보정'],
    concepts: ['내추럴', '시크', '밝은 톤', '흑백'],
    process: BASE_PROCESS,
    prepare: ['원하는 느낌의 참고 사진', '의상 2~3벌', '촬영 전날 충분한 휴식'],
    faq: ['의상은 몇 벌 준비하면 되나요?', '헤어·메이크업도 되나요?', '사진은 언제 받을 수 있나요?'],
    mood: '깔끔하고 세련된',
  },
  {
    match: ['증명', '여권', '비자', '사원증', '학교'],
    menus: ['main', 'intro', 'recommend', 'benefit', 'price', 'perks', 'process', 'prepare', 'caution', 'faq', 'brand', 'cta'],
    audience: '규격에 맞는 사진이 바로 필요한 분',
    benefits: ['규격에 맞춘 정확한 촬영', '당일 수령 가능', '자연스러운 기본 보정 포함'],
    concepts: [],
    process: ['방문 또는 예약', '촬영', '사진 확인', '보정', '인화·파일 전달'],
    prepare: ['용도에 맞는 복장', '안경 착용 여부 확인'],
    faq: ['예약 없이 가도 되나요?', '얼마나 걸리나요?', '파일도 받을 수 있나요?'],
    mood: '깔끔한',
  },
  {
    match: ['취업', '입사', '면접'],
    menus: ['main', 'event', 'price', 'benefit', 'recommend', 'gallery', 'process', 'prepare', 'faq', 'cta'],
    audience: '서류에 쓸 단정한 사진이 필요한 분',
    benefits: ['업종에 맞는 표정과 자세 안내', '정장 대여 가능 여부 안내', '빠른 전달'],
    concepts: [],
    process: ['예약', '헤어·메이크업', '촬영', '사진 고르기', '보정', '파일 전달'],
    prepare: ['정장 또는 단정한 상의', '지원 분야 알려주기'],
    faq: ['정장 대여가 되나요?', '보정은 어디까지 해주시나요?', '당일 수령 되나요?'],
    mood: '단정하고 신뢰감 있는',
  },
  {
    match: ['아기', '베이비', '신생아', '백일', '돌'],
    menus: ['main', 'event', 'perks', 'price', 'shootConcept', 'benefit', 'recommend', 'gallery', 'process', 'prepare', 'review', 'cta'],
    audience: '아이의 지금 이 시기를 남겨두고 싶은 부모님',
    benefits: ['아이 컨디션에 맞춘 여유로운 진행', '따뜻한 온도와 청결한 촬영 공간', '자연스러운 표정 위주의 촬영'],
    concepts: ['내추럴', '한복', '테마', '가족과 함께'],
    process: BASE_PROCESS,
    prepare: ['수유·기저귀 용품', '여벌 옷', '아이가 좋아하는 장난감'],
    faq: ['아이가 울면 어떻게 하나요?', '촬영 시간은 얼마나 걸리나요?', '부모님도 같이 찍을 수 있나요?'],
    mood: '포근하고 다정한',
  },
  {
    match: ['반려', '강아지', '고양이', '펫'],
    menus: ['main', 'event', 'price', 'shootConcept', 'benefit', 'recommend', 'gallery', 'process', 'prepare', 'review', 'cta'],
    audience: '반려동물과의 지금을 남기고 싶은 분',
    benefits: ['반려동물이 편안하게 있을 수 있는 환경', '보호자와 함께 촬영 가능', '움직임에 맞춘 촬영'],
    concepts: ['내추럴', '보호자와 함께', '테마'],
    process: BASE_PROCESS,
    prepare: ['평소 쓰던 간식과 장난감', '배변 패드', '목줄 또는 이동장'],
    faq: ['활발한 아이도 촬영되나요?', '여러 마리도 가능한가요?', '보호자도 같이 나올 수 있나요?'],
    mood: '밝고 사랑스러운',
  },
  {
    match: ['웨딩', '리마인드', '커플', '우정', '한복'],
    menus: ['main', 'event', 'perks', 'price', 'shootConcept', 'benefit', 'recommend', 'gallery', 'process', 'prepare', 'review', 'cta'],
    audience: '둘이 함께한 시간을 남기고 싶은 분',
    benefits: ['자연스러운 포즈 안내', '의상과 어울리는 배경 구성', '오래 두고 볼 수 있는 보정'],
    concepts: ['클래식', '내추럴', '한복', '야외'],
    process: BASE_PROCESS,
    prepare: ['서로 어울리는 의상', '준비된 소품이 있다면 함께'],
    faq: ['의상 대여가 되나요?', '촬영 시간은 얼마나 걸리나요?', '야외 촬영도 되나요?'],
    mood: '감성적이고 고급스러운',
  },
  {
    match: ['복원', '장수', '영정', '기념'],
    menus: ['main', 'price', 'perks', 'benefit', 'recommend', 'gallery', 'process', 'prepare', 'faq', 'cta'],
    audience: '오래된 사진을 되살리거나 기념 사진을 남기려는 분',
    benefits: ['원본을 최대한 살린 복원', '편안한 분위기의 촬영', '액자까지 한 번에'],
    concepts: [],
    process: ['상담', '원본 확인 또는 촬영', '작업', '확인', '인화·액자 전달'],
    prepare: ['복원할 원본 사진', '원하는 액자 크기'],
    faq: ['많이 손상된 사진도 되나요?', '작업 기간은 얼마나 걸리나요?', '액자도 같이 되나요?'],
    mood: '단정하고 정중한',
  },
  {
    match: ['스냅', '행사', '야외', '돌잔치'],
    menus: ['main', 'event', 'price', 'shootConcept', 'benefit', 'recommend', 'gallery', 'process', 'prepare', 'review', 'cta'],
    audience: '그날의 분위기를 그대로 남기고 싶은 분',
    benefits: ['현장 분위기를 살린 촬영', '자연스러운 순간 위주', '빠른 전달'],
    concepts: ['야외', '실내', '흑백'],
    process: BASE_PROCESS,
    prepare: ['일정과 장소 알려주기', '꼭 담고 싶은 장면 미리 알려주기'],
    faq: ['출장도 되나요?', '몇 시간 촬영하나요?', '원본도 받을 수 있나요?'],
    mood: '자연스럽고 생생한',
  },
];

/** 사진관이 아닌 일반 상품 (완성 예시 '일반 상품 상세페이지' 에서 시작했을 때 등) */
const GENERAL: Recipe = {
  match: ['일반상품', '제품'],
  menus: ['main', 'benefit', 'event', 'price', 'intro', 'gallery', 'recommend', 'howto', 'caution', 'faq', 'cta'],
  audience: '이 상품을 찾고 계신 분',
  benefits: ['꼭 필요한 기능에 집중한 구성', '오래 써도 편안한 사용감', '받아보는 날부터 바로 쓸 수 있는 준비'],
  concepts: [],
  process: ['주문', '준비', '발송', '받아보기'],
  prepare: [],
  faq: ['주문 후 언제 받을 수 있나요?', '교환·반품은 어떻게 하나요?', '사용 방법이 궁금해요'],
  mood: '깔끔하고 믿음직한',
};

/** 사용자가 직접 만든 촬영상품처럼 아는 낱말이 없을 때 */
const FALLBACK: Recipe = {
  match: [],
  menus: ['main', 'event', 'price', 'shootConcept', 'benefit', 'recommend', 'gallery', 'process', 'prepare', 'faq', 'cta'],
  audience: '이 촬영을 찾고 계신 분',
  benefits: ['원하는 느낌을 먼저 듣고 시작하는 촬영', '편안한 분위기의 촬영 진행', '자연스러운 보정'],
  concepts: ['기본', '추가 콘셉트'],
  process: BASE_PROCESS,
  prepare: ['원하는 느낌의 참고 사진', '촬영에 필요한 의상이나 소품'],
  faq: ['촬영 시간은 얼마나 걸리나요?', '예약은 어떻게 하나요?', '사진은 언제 받을 수 있나요?'],
  mood: '편안하고 정갈한',
};

export function recipeFor(productName: string): Recipe {
  const name = (productName || '').replace(/\s/g, '');
  if (GENERAL.match.some((m) => name.includes(m))) return GENERAL;
  const found = RECIPES.find((r) => r.match.some((m) => name.includes(m)));
  return found ?? FALLBACK;
}

/**
 * 영역 기본 순서.
 * 대표 이미지 → (한 줄 소개) → 주요 장점 → 상품 구성·가격 → 상세 설명 → 실제 사례
 * → 추천 대상 → 이용 방법 → 예약·문의(마무리)
 */
const PAGE_ORDER: MenuKind[] = [
  /* 최신 이벤트 블록(최신 소식 이미지 + 이벤트 제목·기간·핵심) → 메인(업체명·대표사진) → 소개 → 촬영상품 → 가격 → 갤러리 → 나머지.
     이벤트가 없으면 이벤트 영역은 숨겨지므로 메인부터 시작한다 */
  'news', 'event', 'main', 'brand', 'intro', 'shootConcept', 'price', 'compare', 'gallery',
  'perks', 'benefit', 'review', 'recommend',
  'process', 'howto', 'prepare', 'caution', 'faq', 'cta',
];

function inPageOrder(kinds: MenuKind[]): MenuKind[] {
  const rank = (k: MenuKind) => {
    const i = PAGE_ORDER.indexOf(k);
    return i < 0 ? PAGE_ORDER.length : i;
  };
  return [...kinds].sort((a, b) => rank(a) - rank(b));
}

/** 적어주신 글을 줄 목록으로 (쉼표로 이어 적은 것도 나눈다) */
function listOf(text: string): string[] {
  const byLine = text.split('\n').map((s) => s.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;
  return text.split(/[,·]/).map((s) => s.trim()).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* 본체                                                                */
/* ------------------------------------------------------------------ */

export function planStudioPage(project: ProjectData): StudioPlan {
  const brief = project.shoot;
  const studio = project.studio;
  const product = (brief?.productName || '촬영').trim();
  const area = (brief?.area || studio?.area || '').trim();
  const shopName = (studio?.name || '').trim();
  const recipe = recipeFor(product);
  const wish = `${brief?.wish ?? ''} ${brief?.mood ?? ''} ${brief?.emphasis ?? ''}`.trim();
  /* 강조점은 짧은 말일 때만 제목·문구에 끼워 넣는다. 스마트플레이스 촬영철학처럼 긴 글은 사진관 소개에 그대로 싣는다 */
  const shortEmphasis = (brief?.emphasis ?? '').trim().length <= 20 ? (brief?.emphasis ?? '').trim() : '';
  const mood = brief?.mood?.trim() || moodFromWish(wish) || recipe.mood;

  /* ---- 사진 고르기 (새로 만들지 않는다. 있는 것 중에서 고른다) ----
     '사용하지 않음' 과 '제외 추천' 이 붙은 사진은 배치하지 않는다 (보관함에는 그대로 남는다) */
  /* 최신 소식 이미지는 맨 위 영역 전용 — 대표사진·갤러리·다른 영역에 배치하지 않는다 */
  const photos = project.photos.filter((p) => p.kind !== 'unused' && !p.exclude && !p.news);
  const newsPhoto = project.photos.find((p) => p.news);
  const mainPhoto = pickMainPhoto(photos);
  const spread = spreadPhotos(photos, mainPhoto?.id);

  /* ---- 사용자의 요청을 구성에 반영 ---- */
  let kinds = [...recipe.menus];
  const prod = project.product;
  const want = (k: MenuKind, has: boolean) => { if (has && !kinds.includes(k)) kinds.push(k); };
  want('intro', !!prod.description.trim());
  want('benefit', !!prod.benefits.trim());
  want('recommend', !!prod.target.trim());
  want('howto', !!prod.howToUse.trim());
  want('caution', !!prod.caution.trim());
  /* 실제로 가져온 이벤트가 있을 때만 이벤트 영역을 넣는다 */
  want('event', !!(project.event?.title?.trim() || project.event?.eventPrice || project.event?.period));
  if (newsPhoto && !kinds.includes('news')) kinds.push('news');
  kinds = inPageOrder(kinds);
  if (/가격|혜택|할인|이벤트/.test(wish)) kinds = moveEarlier(kinds, ['event', 'perks', 'price']);
  if (/사진.*(많|위주)|갤러리/.test(wish)) kinds = moveEarlier(kinds, ['gallery']);
  if (photos.length === 0) kinds = kinds.filter((k) => k !== 'gallery');

  const needsCheck: string[] = [];
  if (!shopName) needsCheck.push('사진관 상호가 비어 있습니다.');
  if (!area) needsCheck.push('지역이 비어 있습니다. 검색용 제목에 지역을 넣으면 좋습니다.');
  if (!project.pricing?.eventPrice && !project.pricing?.listPrice) {
    needsCheck.push('가격을 아직 확인하지 못했습니다. 직접 넣어주세요. (임의로 만들지 않았습니다)');
  }
  if (!studio?.phone && !studio?.bookingUrl) {
    needsCheck.push('전화번호나 예약링크가 없습니다. 마지막 예약·문의에 넣어주세요.');
  }
  if (photos.length === 0) needsCheck.push('사진이 아직 없습니다. 사진을 넣으면 배치까지 만들어 드립니다.');
  const menus: PlannedMenu[] = kinds.map((kind) =>
    buildMenu(kind, {
      product, area, shopName, mood, recipe, project, spread, mainPhoto,
      portraitCount: photos.filter((ph) => shapeOf(ph) === 'portrait').length,
      emphasis: shortEmphasis,
    }),
  );

  const hiddenTitles = menus.filter((m) => m.hidden).map((m) => m.title);
  const draftTitles = menus
    .filter((m) => !m.hidden && DRAFT_KINDS.includes(m.kind))
    .map((m) => m.title);

  return {
    sourceLabel:
      '넣어주신 자료와 촬영상품을 규칙대로 정리한 결과입니다. (진짜 AI 연결 전 · 사진은 올리신 것을 고르기만 합니다)',
    /* 촬영분야 — 실제 상품명('가족사진 기본촬영(4인이하)')에서 분야 이름만 ('가족사진') */
    productName: shootField(product) || product,
    /* 구체적인 서비스 문구는 실제 자료에 적혀 있을 때만 */
    searchTitles: searchTitles(product, area, [
      project.studio?.intro, project.product.benefits, project.product.description,
      project.pricing?.etcExtra, project.pricing?.includes, brief?.productName,
    ].filter(Boolean).join('\n')),
    productTitle: productInfoTitle(product, area),
    heroCopy: heroCopy(shootField(product) || product, mood, area, shortEmphasis),
    subCopy: subCopy(product, area, shopName),
    audience: recipe.audience,
    mainPhotoId: mainPhoto?.id ?? '',
    menus,
    needsCheck,
    hiddenTitles,
    draftTitles,
  };
}

/** 사진관마다 다를 수 있어 '일반적인 내용'으로 채워 둔 섹션 */
const DRAFT_KINDS: MenuKind[] = ['benefit', 'recommend', 'process', 'prepare', 'faq'];

/* ------------------------------------------------------------------ */
/* 메뉴 하나 만들기                                                     */
/* ------------------------------------------------------------------ */

interface Ctx {
  product: string;
  area: string;
  shopName: string;
  mood: string;
  recipe: Recipe;
  project: ProjectData;
  spread: Map<MenuKind, string[]>;
  mainPhoto: Photo | null;
  /** 세로 사진이 몇 장인지 — 콘셉트 모양을 고를 때 쓴다 */
  portraitCount: number;
  /** 강조해달라고 적어주신 내용 */
  emphasis: string;
}

/**
 * 섹션 하나 만들기.
 *
 * 규칙
 *  - 확인된 값이 있으면 그것을 쓴다.
 *  - 없으면 **지어내지 않고** 그 섹션을 숨긴다. (샘플 글이 결과에 섞이면 안 된다)
 *  - 모양(템플릿)은 내용 양과 사진 모양을 보고 알맞은 것을 고른다.
 */
function buildMenu(kind: MenuKind, c: Ctx): PlannedMenu {
  const photoIds = c.spread.get(kind) ?? [];
  const base = { kind, photoIds, lines: [] as string[], template: 'A' };
  const pr = c.project.pricing;
  const ev = c.project.event;
  const perks = c.project.perks ?? [];

  switch (kind) {
    case 'news': {
      /* 최신 소식 첫 사진 1장만 — 없으면 영역을 만들지 않는다 */
      const news = c.project.photos.find((p) => p.news);
      return { ...base, title: '최신 소식', body: '', photoIds: news ? [news.id] : [], hidden: !news };
    }

    case 'main':
      return {
        ...base,
        title: '메인',
        photoIds: c.mainPhoto ? [c.mainPhoto.id] : [],
        body: '',
      };

    case 'event': {
      const has = !!(ev?.title || ev?.body || ev?.eventPrice || ev?.period);
      /* 최신 소식 이미지가 있으면 그것이 이 이벤트의 사진이다 — 업체사진을 한 장 더 넣지 않는다 (한 묶음) */
      const own = c.project.photos.some((p) => p.news) ? [] : photoIds;
      return {
        ...base,
        photoIds: own,
        title: ev?.title || '이벤트',
        body: ev?.body ?? '',
        template: pickEventTemplate(ev, own.length),
        hidden: !has,
      };
    }

    case 'perks': {
      const lines = perks.map((p) => (p.body ? `${p.title} | ${p.body}` : p.title));
      return {
        ...base,
        title: '특별한 혜택',
        body: '',
        lines,
        template: pickPerkTemplate(lines.length, photoIds.length),
        hidden: lines.length === 0,
      };
    }

    case 'price': {
      const prod = c.project.product;
      const listP = pr?.listPrice || prod.listPrice;
      const saleP = pr?.eventPrice || prod.salePrice;
      /* 미리보기가 상품정보의 가격도 보여주므로, 숨길지 판단할 때도 같이 본다 */
      const has = !!(listP || saleP || pr?.includes);
      const includeCount = (pr?.includes ?? '').split('\n').filter((x) => x.trim()).length;
      return {
        ...base,
        title: '가격 안내',
        body: '',
        template: pickPriceTemplate(listP, saleP, includeCount),
        hidden: !has,
      };
    }

    case 'shootConcept': {
      const own = (c.project.concepts ?? []).map((x) => x.name).filter(Boolean);
      const names = own.length ? own : c.recipe.concepts;
      return {
        ...base,
        title: `${c.product} 콘셉트`,
        body: `${c.mood} 느낌으로 담아드립니다.`,
        lines: names,
        template: pickConceptTemplate(names.length, photoIds.length, c.portraitCount),
        hidden: names.length === 0,
      };
    }

    case 'benefit': {
      /* 적어주신 주요 특징이 있으면 그것을 쓴다. 없을 때만 일반적인 문구 */
      const own = listOf(c.project.product.benefits);
      const items = own.length ? own : c.recipe.benefits;
      const general = c.recipe === GENERAL;
      return {
        ...base,
        title: general ? '이 상품의 장점' : c.shopName ? `${c.shopName}의 장점` : '우리 사진관의 장점',
        body: items.join('\n'),
        template: items.length >= 4 ? 'B' : 'A',
      };
    }

    case 'recommend': {
      const own = listOf(c.project.product.target);
      const lines = own.length ? own : recommendLines(c.product, c.recipe, c.emphasis);
      return {
        ...base,
        title: '이런 분께 추천합니다',
        body: c.recipe.audience,
        lines,
        template: lines.length >= 4 ? 'B' : 'A',
      };
    }

    case 'gallery':
      return {
        ...base,
        title: '갤러리',
        body: '',
        template: pickGalleryTemplate(photoIds.length),
        hidden: photoIds.length === 0,
      };

    case 'process':
      return {
        ...base,
        title: c.recipe === GENERAL ? '구매 과정' : '촬영 과정',
        body: '',
        lines: c.recipe.process,
        template: c.recipe.process.length >= 5 ? 'A' : 'B',
      };

    case 'prepare':
      return {
        ...base,
        title: '준비사항',
        body: '',
        lines: c.recipe.prepare,
        template: c.recipe.prepare.length >= 4 ? 'B' : 'A',
      };

    case 'review':
      /* 후기는 실제로 받은 것만 쓸 수 있다. 지어내지 않는다. */
      return { ...base, title: '후기', body: '', hidden: true };

    case 'intro': {
      const text = c.project.product.description.trim();
      /* 가져온 사진관 소개를 그대로 옮겨둔 것이면 '사진관 소개' 에서만 보여준다 (같은 글 두 번 금지) */
      const same = !!text && text === (c.project.studio?.intro ?? '').trim();
      return { ...base, title: `${c.product} 소개`, body: same ? '' : text, hidden: !text || same };
    }

    case 'howto': {
      const text = c.project.product.howToUse.trim();
      return { ...base, title: '이용 안내', body: text, hidden: !text };
    }

    case 'caution': {
      const text = c.project.product.caution.trim();
      return { ...base, title: '유의사항', body: text, hidden: !text };
    }

    case 'brand': {
      /* 긴 촬영철학(가져온 원문)은 소개 아래 그대로 싣는다 — 짧은 강조점은 제목·문구에서 이미 쓴다 */
      const intro = (c.project.studio?.intro ?? '').trim();
      const philosophy = c.emphasis ? '' : (c.project.shoot?.emphasis ?? '').trim();
      const text = [intro, philosophy && `촬영 철학\n${philosophy}`].filter(Boolean).join('\n\n');
      return { ...base, title: c.shopName ? `${c.shopName} 소개` : '사진관 소개', body: text, hidden: !text };
    }

    case 'faq':
      return { ...base, title: '자주 묻는 질문', body: '', lines: c.recipe.faq };

    case 'cta':
      return {
        ...base,
        title: '예약·문의',
        body: bookingText(c),
        template: 'A',
      };

    default:
      return { ...base, title: kind, body: '' };
  }
}

/* ------------------------------------------------------------------ */
/* 알맞은 모양 고르기 — 내용 양과 사진 모양을 보고 정한다                  */
/* ------------------------------------------------------------------ */

export function pickPerkTemplate(count: number, photos: number): string {
  if (count === 0) return 'A';
  if (photos >= count) return 'C';       // 혜택마다 사진이 있으면 사진 + 설명
  if (count <= 3) return 'A';            // 셋 이하는 번호를 크게
  if (count <= 6) return 'B';            // 넷~여섯은 카드 두 줄
  return 'E';                            // 많으면 세로로 길게
}

export function pickPriceTemplate(list?: string, event?: string, includes = 0): string {
  const l = num(list);
  const e = num(event);
  const off = l && e && e < l ? (1 - e / l) * 100 : 0;
  if (off >= 25) return 'C';             // 할인이 크면 정상가 → 할인가
  if (includes >= 4) return 'D';         // 포함사항이 많으면 그것 중심
  if (includes >= 1) return 'B';         // 패키지 카드
  return 'A';
}

export function pickEventTemplate(ev: { listPrice?: string; eventPrice?: string; period?: string } | undefined, photos: number): string {
  const l = num(ev?.listPrice);
  const e = num(ev?.eventPrice);
  const off = l && e && e < l ? (1 - e / l) * 100 : 0;
  if (off >= 30) return 'A';             // 할인율이 크면 크게 강조
  if (photos > 0) return 'B';            // 사진이 있으면 사진 + 가격
  if (ev?.period) return 'C';            // 기간이 있으면 배너
  return 'D';
}

export function pickConceptTemplate(names: number, photos: number, portraits: number): string {
  if (photos >= 3) return 'D';           // 사진이 많으면 콜라주
  if (portraits >= 2) return 'B';        // 세로가 많으면 사진 왼쪽 / 설명 오른쪽
  if (names >= 4) return 'E';            // 콘셉트가 많으면 카드 갤러리
  return 'A';
}

export function pickGalleryTemplate(photos: number): string {
  if (photos >= 5) return 'D';           // 많으면 모자이크
  if (photos >= 3) return 'A';           // 격자
  if (photos === 2) return 'C';          // 두 장 나란히
  return 'B';                            // 한 장은 크게
}

function num(v?: string): number {
  return Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
}

function bookingText(c: Ctx): string {
  const s = c.project.studio;
  const lines: string[] = [];
  if (s?.phone) lines.push(`전화 ${s.phone}`);
  if (s?.hours) lines.push(`영업시간 ${s.hours}`);
  if (s?.offDays) lines.push(`휴무 ${s.offDays}`);
  if (s?.address) lines.push(s.address);
  /* 적어두신 예약·구매 안내가 있으면 함께 */
  const own = c.project.product.contact.trim();
  if (own && !lines.some((l) => own.includes(l.replace(/^전화 /, '')))) lines.push(own);
  /*
   * 없는 정보를 지어내지 않는다.
   * 예전에는 비어 있으면 "예약 방법과 문의처를 적어주세요." 를 넣었는데
   * 그 안내 문장이 **저장 이미지에 그대로 찍혔다.** 이제는 비워둔다.
   */
  if (!lines.length) return '';
  /* 마무리 한 줄 — 적어주신 정보(상호·상품)로만 만든다 */
  const who = c.shopName ? `${c.shopName}에서 ` : '';
  const closing = c.recipe === GENERAL
    ? '궁금한 점은 편하게 문의해주세요.'
    : `${who}편안하게 남겨보세요. 궁금한 점은 편하게 문의해주세요.`;
  return [closing, '', ...lines].join('\n');
}

function recommendLines(product: string, recipe: Recipe, emphasis: string): string[] {
  const p = product && product !== '촬영' ? product : '';
  const out = [
    p ? `${josaEul(p)} 처음 찍어보시는 분` : '사진 촬영이 처음이신 분',
    recipe.audience,
    '어떤 느낌이 좋을지 아직 못 정하신 분',
  ];
  /* 강조해달라고 적어주신 내용이 있으면 그대로 살린다 */
  const want = emphasis.trim();
  if (want) out.unshift(`${want} 준비하고 계신 분`);
  return out;
}

/* ------------------------------------------------------------------ */
/* 제목과 카피                                                          */
/* ------------------------------------------------------------------ */

/** 검색용 제목 — 정보 중심 (과장 표현은 쓰지 않는다) */
/*
 * 촬영분야별 제목 — 메인 제목과 스마트스토어 상품명에 쓴다.
 *   지역 + 촬영분야 + 실제 촬영 내용·장점·사용 목적 (정보·검색 위주, 과한 감성 문구 없이)
 *   지역은 주소에서 읽은 값만 쓰고, 없으면 넣지 않는다 (추측하지 않음 · ① 에서 직접 넣을 수 있다)
 *   실제 상품명은 가격 영역에서 그대로 쓰고, 제목에는 기계적으로 붙이지 않는다.
 */
const FIELD_WORDS: [RegExp, string][] = [
  [/리마인드/, '리마인드웨딩'],
  [/증명|여권|비자|반명함|민증|면허/, '증명사진'],
  [/취업|입사|면접/, '취업사진'],
  [/프로필/, '프로필사진'],
  [/아기|베이비|신생아|백일|돌/, '아기사진'],
  [/반려|강아지|고양이|펫/, '반려동물사진'],
  [/장수|영정/, '장수사진'],
  [/복원/, '복원사진'],
  [/스냅|행사/, '스냅사진'],
  [/웨딩/, '웨딩사진'],
  [/우정/, '우정사진'],
  [/가족|부모님|환갑|칠순/, '가족사진'],
];

const FIELD_POINTS: Record<string, string[]> = {
  가족사진: ['부모님과 함께하는 가족촬영', '가족·대가족 기념촬영', '자연스럽고 편안한 가족촬영'],
  리마인드웨딩: ['결혼기념일 부부 촬영', '부모님 기념촬영', '가족과 함께하는 기념촬영'],
  증명사진: ['여권·면허·취업사진 촬영', '용도별 규격 맞춤 촬영', '취업·여권·면허사진'],
  아기사진: ['돌·백일·성장기념 촬영', '가족과 함께하는 기념촬영', '성장기록 촬영'],
  프로필사진: ['개인·비즈니스 프로필 촬영', '취업·업무용 프로필 촬영', '상반신·전신 프로필 촬영'],
  취업사진: ['면접·입사지원서 사진 촬영', '업종별 단정한 취업사진 촬영', '이력서용 취업사진 촬영'],
  반려동물사진: ['반려견·반려묘 기념촬영', '보호자와 함께하는 반려동물 촬영', '반려동물 프로필 촬영'],
  장수사진: ['부모님 장수사진 촬영', '부모님 기념촬영', '편안한 분위기의 장수사진 촬영'],
  복원사진: ['오래된 사진 복원', '훼손된 사진 복원·보정', '소중한 사진 복원'],
  스냅사진: ['행사·야외 스냅 촬영', '행사·기념 스냅 촬영', '자연스러운 순간 스냅 촬영'],
  웨딩사진: ['웨딩 스튜디오 촬영', '커플·웨딩 기념촬영', '웨딩 기념촬영'],
  우정사진: ['친구·단체 우정 촬영', '기념일 우정사진 촬영', '단체 기념촬영'],
};

/*
 * 실제 자료(소개·특징·상품·가격 목록·구성)에 그 서비스가 적혀 있을 때만 쓰는 구체적인 문구.
 * 없는 서비스를 있는 것처럼 보이게 하지 않으려고 기본 추천에서는 뺐다.
 * [분야, 자료에서 찾을 낱말, 바꿔 넣을 자리(0~2), 문구]
 */
const DETAIL_POINTS: [string, RegExp, number, string][] = [
  ['복원사진', /인화/, 2, '가족사진 복원·인화'],
  ['장수사진', /액자|영정/, 1, '장수·영정 액자 촬영'],
  ['웨딩사진', /웨딩\s*액자/, 2, '웨딩액자 촬영'],
  ['스냅사진', /돌잔치/, 1, '돌잔치·행사 스냅 촬영'],
];

/** 상품명·상품 종류에서 촬영분야 이름만 ('가족사진 기본촬영(4인이하)' → '가족사진'). 모르면 적힌 그대로 */
export function shootField(product: string): string {
  const p = (product || '').trim();
  if (!p || p === '촬영') return '';
  return FIELD_WORDS.find(([re]) => re.test(p))?.[1] ?? p;
}

/** 지역은 맨 앞에 한 번만 */
function withArea(area: string, text: string): string {
  const a = (area || '').trim();
  const t = text.trim();
  if (!a) return t;
  return t.startsWith(a) ? t : `${a} ${t}`;
}

export function searchTitles(product: string, area: string, evidence = ''): string[] {
  /* 지역을 모르면 제목을 완성하지 않는다 — ② 에서 지역을 넣으면 그때 만든다 (추측하지 않음) */
  if (!(area || '').trim()) return [];
  const field = shootField(product) || '사진';
  const points = [...(FIELD_POINTS[field] ?? ['촬영', '기념촬영', '스튜디오 촬영'])];
  DETAIL_POINTS.forEach(([f, re, at, text]) => { if (f === field && re.test(evidence)) points[at] = text; });
  const out = points.map((pt) => withArea(area, `${field} ${pt}`));
  /* 실제 상품명에 가까운 제목은 맨 아래 보조 후보로만 */
  const extra = productInfoTitle(product, area);
  if (extra) out.push(extra);
  /* 같은 낱말을 억지로 반복하지 않는다 */
  return [...new Set(out.map((t) => stripBanned(t.trim())))].filter(Boolean);
}

/** 상품정보형 보조 제목 — '가족사진 기본촬영(4인이하)' → '구미 가족사진 4인 이하 기본촬영'. 분야 이름뿐이면 만들지 않는다 */
export function productInfoTitle(product: string, area: string): string {
  const p = (product || '').trim();
  const field = shootField(p);
  if (!p || !field || p === field || !(area || '').trim()) return '';
  const rest = p.replace(field, '').trim();
  /* '증명&여권사진' 처럼 사진 종류 이름뿐이면 더할 정보가 없다 */
  if (/^[가-힣&·,/\s]*사진$/.test(rest) && !/\d/.test(rest)) return '';
  const paren = rest.match(/\(([^)]*)\)/)?.[1]?.trim() ?? '';
  const body = rest.replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  const text = [paren, body].filter(Boolean).join(' ').replace(/(\d+)\s*인\s*(이하|이상)/g, '$1인 $2').trim();
  return text ? stripBanned(withArea(area, `${field} ${text}`)) : '';
}

/** 대문 카피 — 고객 설득 중심 (검색 제목과 역할이 다르다) */
export function heroCopy(product: string, mood: string, area = '', emphasis = ''): string[] {
  /* '가족사진' → '가족' 처럼 끝의 '사진'을 떼어 말이 자연스럽게 만든다 */
  const subject = (product && product !== '촬영' ? product : '순간').replace(/사진$/, '') || '순간';
  const want = emphasis.trim();
  const out = [
    `오늘의 ${josaEul(subject)} 오래 기억하는 방법`,
    `${mood} 순간으로 남겨드립니다`,
  ];
  if (want) out.unshift(`${want}, 오래 남을 한 장으로`);
  if (area) out.push(`${area}에서 남기는 ${subject}의 하루`);
  out.push('오래 두고 볼수록 좋은 사진');
  return [...new Set(out.map(stripBanned))];
}

function subCopy(product: string, area: string, shop: string): string {
  const where = area ? `${area}에서 ` : '';
  const who = shop ? `${shop}이 ` : '';
  return stripBanned(`${where}${who}${product || '촬영'}을 준비합니다.`.replace('  ', ' '));
}

function moodFromWish(wish: string): string {
  if (!wish) return '';
  if (/고급|럭셔리|우아/.test(wish)) return '고급스러운';
  if (/따뜻|포근|정겨/.test(wish)) return '따뜻한';
  if (/감성|분위기/.test(wish)) return '감성적인';
  if (/밝|화사|경쾌/.test(wish)) return '밝고 화사한';
  if (/깔끔|심플|단정/.test(wish)) return '깔끔한';
  return '';
}

/* ------------------------------------------------------------------ */
/* 사진 고르기·배치 — 있는 사진을 고르기만 한다                          */
/* ------------------------------------------------------------------ */

/**
 * 대표사진 고르기.
 * 사용자가 이미 정해뒀으면 그대로 둔다. (사람이 정한 것을 뒤집지 않는다)
 */
export function pickMainPhoto(photos: Photo[]): Photo | null {
  if (photos.length === 0) return null;
  const chosen = photos.find((p) => p.kind === 'main');
  if (chosen) return chosen;
  /* 스마트플레이스에서 가져온 사진은 업체가 올린 순서대로 — 첫 업체 사진이 대표 */
  if (photos[0].source === 'place') return photos[0];
  /* 가로 사진이 대문에 안정적이다. 없으면 첫 사진. */
  return photos.find((p) => shapeOf(p) === 'landscape') ?? photos[0];
}

/**
 * 메뉴별로 사진 나눠주기.
 *  - 같은 사진을 여러 곳에 반복해서 쓰지 않는다
 *  - 세로 사진은 둘씩 짝지어 나란히 놓이게 둔다
 *  - 가로 사진은 넓게 보이는 자리에 둔다
 */
export function spreadPhotos(photos: Photo[], mainId?: string): Map<MenuKind, string[]> {
  const out = new Map<MenuKind, string[]>();
  const rest = photos.filter((p) => p.id !== mainId);
  if (rest.length === 0) return out;

  const portraits = rest.filter((p) => shapeOf(p) === 'portrait');
  const others = rest.filter((p) => shapeOf(p) !== 'portrait');
  const queue = [...others, ...portraits];
  const take = (n: number) => queue.splice(0, Math.min(n, queue.length)).map((p) => p.id);

  /* 콘셉트에는 세로 2장을 우선 (나란히 놓인다) */
  const conceptPair = portraits.slice(0, 2).map((p) => p.id);
  if (conceptPair.length === 2) {
    conceptPair.forEach((id) => {
      const i = queue.findIndex((p) => p.id === id);
      if (i >= 0) queue.splice(i, 1);
    });
    out.set('shootConcept', conceptPair);
  } else {
    out.set('shootConcept', take(2));
  }

  /*
   * 사진관에서는 갤러리가 가장 중요한 자리다.
   * 장식용으로 한 장씩 빼가느라 갤러리가 비어버리면 안 되므로
   * 사진이 넉넉할 때만 다른 칸에 한 장씩 나눠준다.
   */
  const spare = queue.length - 3;
  if (spare > 0) out.set('event', take(1));
  if (spare > 1) out.set('perks', take(1));
  if (spare > 2) out.set('benefit', take(1));

  /*
   * 남은 사진은 갤러리로. 다만 **최대 8장**까지만 싣는다.
   * 50장을 가져왔다고 50장을 다 올리면 상세페이지가 끝없이 길어진다.
   * 싣지 않은 사진도 보관함에는 그대로 남아 언제든 넣을 수 있다.
   */
  const left = queue.map((p) => p.id).slice(0, 8);
  if (left.length) out.set('gallery', left);

  return out;
}

function moveEarlier(kinds: MenuKind[], wanted: MenuKind[]): MenuKind[] {
  const picked = kinds.filter((k) => wanted.includes(k));
  const rest = kinds.filter((k) => !wanted.includes(k));
  /* 메인 바로 다음으로 올린다 */
  /* 맨 위 최신 소식 이미지가 있으면 그것과 메인 둘 다 앞에 둔다 */
  const n = rest[0] === 'news' ? 2 : 1;
  const head = rest.slice(0, n);
  return [...head, ...picked, ...rest.slice(n)];
}

/* ------------------------------------------------------------------ */
/* 한국어 조사                                                          */
/* ------------------------------------------------------------------ */

/** 받침이 있으면 '을', 없으면 '를' */
export function josaEul(word: string): string {
  return word + (hasJong(word) ? '을' : '를');
}

function hasJong(word: string): boolean {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  /* 숫자도 읽는 소리로 따진다 */
  if (/[0-9]/.test(last)) return !'2459'.includes(last);
  return false;
}
