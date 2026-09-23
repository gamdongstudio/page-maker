import type {
  Perk, Review, ShootConcept, StudioEvent, StudioInfo, StudioPricing,
} from './studio';
import type { FontKey } from '@/config/fonts';

/**
 * SAY PAGE MAKER PRO 데이터 모델
 *
 * 저장/불러오기의 기준이 되는 형식이다.
 * 나중에 서버 저장으로 확장할 수 있도록 순수 데이터(JSON 직렬화 가능)만 담는다.
 */

/* ------------------------------------------------------------------ */
/* 상품정보                                                             */
/* ------------------------------------------------------------------ */

export interface ProductInfo {
  /* 기본 */
  name: string;          // 상품명 (상세페이지 메인 제목)
  /** 스마트스토어 제목 — 처음 자동 추천 때만 메인 제목과 같게 넣고, 그 뒤로는 따로 고친다 */
  storeTitle?: string;
  brand: string;         // 브랜드
  category: string;      // 카테고리
  listPrice: string;     // 정상가격
  salePrice: string;     // 판매가격
  tagline: string;       // 한 줄 소개
  benefits: string;      // 핵심 장점
  target: string;        // 주요 고객
  description: string;   // 상세 설명

  /* 더보기 (추가정보) */
  shipping: string;      // 배송정보
  howToUse: string;      // 이용방법
  caution: string;       // 주의사항
  buyLink: string;       // 구매 링크
  contact: string;       // 문의 정보
  etc: string;           // 기타 설명
}

/* ------------------------------------------------------------------ */
/* 사진·미디어                                                          */
/* ------------------------------------------------------------------ */

/** 사진 유형 */
export type PhotoKind =
  | 'main'      // 대표사진
  | 'product'   // 상품사진
  | 'detail'    // 상세사진
  | 'concept'   // 콘셉트사진
  | 'compare'   // 비교사진
  | 'review'    // 후기사진
  | 'event'     // 이벤트 이미지
  | 'unused';   // 사용하지 않음

/**
 * 사진을 어디에 쓸지.
 * 저장되는 값은 예전과 같아서 옛 작업파일도 그대로 열린다. 보이는 이름만 사진관 말로 바꿨다.
 */
export const PHOTO_KIND_LABEL: Record<PhotoKind, string> = {
  main: '메인 (대표사진)',
  product: 'AI 자동 배치',
  detail: '상품소개',
  concept: '촬영 구성',
  compare: '보정 전후',
  event: '가격·혜택',
  review: '사진관 소개',
  unused: '사용하지 않음',
};

/**
 * 사진을 화면에 어떻게 맞출지.
 * 사용자 화면에는 개발 용어 대신 쉬운 말로 보여준다.
 */
export type PhotoFit =
  | 'auto'      // 자동 맞춤 (기본)
  | 'whole'     // 사진 전체 보기
  | 'fill';     // 화면 꽉 채우기

export const PHOTO_FIT_LABEL: Record<PhotoFit, string> = {
  auto: '자동 맞춤',
  whole: '사진 전체 보기',
  fill: '화면 꽉 채우기',
};

/**
 * 대문(대표) 사진을 어떤 모양으로 보여줄지.
 * '자동 추천'은 올린 사진의 원래 비율을 보고 알아서 정한다.
 */
export type HeroShape = 'auto' | 'landscape' | 'square' | 'portrait';

export const HERO_SHAPE_LABEL: Record<HeroShape, string> = {
  auto: '자동',
  landscape: '가로형',
  square: '정사각형',
  portrait: '세로형',
};

/** 사진이 어디서 왔는지 — 카드 구석에 작게만 보여준다 */
export type PhotoSource = 'upload' | 'blog' | 'place' | 'home' | 'store';

export const PHOTO_SOURCE_LABEL: Record<PhotoSource, string> = {
  upload: '직접 추가',
  blog: '블로그',
  place: '스마트플레이스',
  home: '홈페이지',
  store: '스마트스토어',
};

export interface Photo {
  id: string;
  name: string;          // 파일 이름
  dataUrl: string;       // 실제 이미지 데이터 (저장/복원 대상)
  width: number;         // 원본 가로 (px)
  height: number;        // 원본 세로 (px)
  bytes: number;         // 파일 용량
  kind: PhotoKind;
  fit: PhotoFit;
  /** '위치 직접 조정' 값 — 0~100 (%) */
  focusX: number;
  focusY: number;
  caption: string;       // 사진 설명 (선택)
  /**
   * 올릴 때 알맞은 크기로 자동으로 줄였다면 그 기록.
   * 없으면 올린 그대로 쓴 것이다. (잘라낸 것이 아니라 크기만 줄인다)
   */
  resized?: {
    fromWidth: number;
    fromHeight: number;
    fromBytes: number;
  };
  /** 어디서 왔는지 (없으면 직접 추가) */
  source?: PhotoSource;
  /** 스마트플레이스 최신 소식 게시물의 첫 사진 — 맨 위 '최신 소식' 영역 전용 (대표사진·갤러리에 넣지 않는다) */
  news?: boolean;
  /**
   * 빼는 게 좋아 보이는 이유 (너무 작음 · 같은 사진 · 띠 모양 배너 …).
   * **추천일 뿐이다.** 자동으로 지우지 않는다. 사용자가 고른다.
   */
  exclude?: string;
  /** 같은 사진인지 견주는 짧은 지문 */
  hash?: string;
}

/** 동영상 URL */
export interface VideoRef {
  id: string;
  url: string;
  caption: string;
}

/* ------------------------------------------------------------------ */
/* 메뉴 (사용자 화면에서 '블록'이라는 말은 쓰지 않는다)                    */
/* ------------------------------------------------------------------ */

export type MenuKind =
  | 'main' | 'event' | 'discount' | 'intro' | 'recommend' | 'benefit'
  | 'feature' | 'concept' | 'scene' | 'gallery' | 'beforeAfter' | 'compare'
  | 'price' | 'review' | 'sns' | 'video' | 'howto' | 'shipping'
  | 'faq' | 'caution' | 'brand' | 'cta'
  /* --- 사진관 전용 --- */
  | 'perks'        // 특별한 혜택
  | 'shootConcept' // 촬영 콘셉트
  | 'process'      // 촬영 과정
  | 'prepare'      // 준비사항
  | 'free'         // 자유 영역 — 정해진 틀에 없는 내용을 직접 적는 칸
  | 'news';        // 최신 소식 — 스마트플레이스 최신 소식 첫 사진 (상세페이지 맨 위)

export interface MenuItem {
  id: string;
  kind: MenuKind;
  title: string;         // 메뉴 제목
  body: string;          // 메뉴 설명
  /** 이 메뉴에서 보여줄 사진 id 목록 — 메뉴마다 독립적으로 유지된다 */
  photoIds: string[];
  hidden: boolean;
  /** FAQ 등에서 쓰는 줄 목록 */
  lines: string[];
  /**
   * 이 메뉴를 어떤 모양으로 보여줄지 (A · B · C …).
   * 모양을 바꿔도 글·사진·가격 같은 **내용은 그대로 남는다.**
   * 없으면 'A' 로 본다.
   */
  template?: string;
  /**
   * 이 섹션의 글자만 다른 글꼴로.
   * 없으면 ④ 디자인의 **전체 기본 글꼴**을 따른다.
   * (전체를 바꾸는 것과 이 섹션만 바꾸는 것을 헷갈리지 않게 따로 둔다)
   */
  font?: FontKey;
  /** 자유 영역 등에서 쓰는 버튼 문구 — 비어 있으면 버튼을 그리지 않는다 */
  button?: string;
  /**
   * 자동으로 만들어 넣은 글의 자국.
   * 지금 글이 이 자국과 같으면 사용자가 손대지 않은 것이므로 [수정 내용 반영] 때 새 자료로 갱신한다.
   * 사용자가 한 글자라도 고치면 자국과 달라져 그 영역은 건드리지 않는다.
   */
  auto?: string;
}

/* ------------------------------------------------------------------ */
/* 가격표 · 상품 비교                                                   */
/* ------------------------------------------------------------------ */

/**
 * 촬영상품 하나.
 *
 * 한 장짜리 그림이 아니라 **고칠 수 있는 내용**이다.
 * 미리보기에서 상품명·가격을 눌러 바로 고칠 수 있다.
 */
export interface PricePackage {
  id: string;
  name: string;      // 상품명 (기본 상품 / 소가족 세트 …)
  price: string;     // 가격
  note: string;      // 짧은 설명
  includes: string;  // 포함 구성 (줄바꿈으로 여러 개)
  photoId: string;   // 대표사진 (선택)
}

/* ------------------------------------------------------------------ */
/* 디자인                                                              */
/* ------------------------------------------------------------------ */

export type StylePreset =
  | 'clean' | 'luxury' | 'emotional' | 'warm' | 'minimal' | 'bright';

/**
 * 스타일 이름.
 * 저장되는 값(키)은 예전과 같다 — 옛 작업파일도 그대로 열린다. 보이는 이름만 바꿨다.
 * 보여주는 순서도 이 순서다 (고급스러운이 기본).
 */
export const STYLE_PRESET_LABEL: Record<StylePreset, string> = {
  luxury: '고급스러운',
  clean: '깔끔한',
  warm: '따뜻한',
  emotional: '감성적인',
  minimal: '모던한',
  bright: '밝고 경쾌한',
};

/**
 * 글꼴은 `config/fonts.ts` 한 곳에서 관리한다.
 * 여기서는 다시 내보내기만 해서 예전 코드가 그대로 동작하게 둔다.
 */
export type { FontKey } from '@/config/fonts';
export { FONTS as FONT_LABEL } from '@/config/fonts';

export type ButtonStyle = 'round' | 'square' | 'pill';
export type AlignStyle = 'left' | 'center' | 'right';

export interface DesignSettings {
  preset: StylePreset;
  background: string;    // 배경색
  primary: string;       // 대표색
  accent: string;        // 강조색
  text: string;          // 글자색
  titleSize: number;     // 제목 크기 (px)
  bodySize: number;      // 본문 크기 (px)
  menuGap: number;       // 메뉴 간격 (px)
  padding: number;       // 여백 (px)
  photoRadius: number;   // 사진 모서리 (px)
  buttonStyle: ButtonStyle;
  align: AlignStyle;
  titleFont: FontKey;
  bodyFont: FontKey;
  /** 제목을 굵게 (없으면 굵게로 본다 — 예전 작업파일과 같게 보인다) */
  titleBold?: boolean;
  /** 본문을 굵게 (없으면 보통) */
  bodyBold?: boolean;
  /**
   * 사용자가 글꼴을 직접 골랐는지.
   * 골랐다면 간편 스타일을 바꿔도 그 글꼴을 그대로 둔다.
   */
  fontLocked?: boolean;
  /** 대문 사진 모양 */
  heroShape: HeroShape;
  /** 영역 사이 구분선 (없으면 없음) */
  divider?: 'none' | 'line';
  /** 사용자가 스타일을 직접 골랐는지 — 골랐다면 자동 추천이 스타일을 바꾸지 않는다 */
  styleChosen?: boolean;
}

/* ------------------------------------------------------------------ */
/* 프로젝트 전체                                                        */
/* ------------------------------------------------------------------ */

/**
 * 참고 캡처에서 읽어낸 느낌.
 * 캡처 사진 자체는 저장하지 않고(용량) 읽어낸 내용만 남긴다.
 * 픽셀을 그대로 베끼는 것이 아니라 구성 방식만 참고한다.
 */
export interface ReferenceNote {
  fileName: string;
  readAt: number;
  /** 사람이 읽을 수 있는 관찰 결과 */
  findings: string[];
  /** 여백으로 나뉜 구간 수 (메뉴 개수 짐작) */
  sections: number;
  /** 아래쪽에 버튼처럼 보이는 부분이 있었는지 */
  ctaBottom: boolean;
  /** 추천한 간편 스타일 */
  presetGuess: StylePreset;
  /** 실제로 적용했는지 */
  applied: boolean;
}

export interface ProjectData {
  /** 저장 형식 버전 — 나중에 형식이 바뀌어도 옛 파일을 읽을 수 있게 */
  version: number;
  id: string;
  title: string;         // 작업 이름
  updatedAt: number;
  product: ProductInfo;
  photos: Photo[];
  videos: VideoRef[];
  menus: MenuItem[];
  design: DesignSettings;
  /** 참고 캡처에서 읽은 내용 (없을 수 있음) */
  reference?: ReferenceNote;

  /* --- 사진관 전용 (없으면 예전처럼 동작한다) --- */
  /** 이 상세페이지에 쓰는 사진관 공통정보 */
  studio?: StudioInfo;
  /** 어떤 촬영상품인지 + 사용자의 한 줄 요청 */
  shoot?: ShootBrief;
  /** 사진관 가격 */
  pricing?: StudioPricing;
  /** 이벤트 */
  event?: StudioEvent;
  /** 특별한 혜택 */
  perks?: Perk[];
  /** 후기 (없을 수 있다 — 예전 작업과 호환) */
  reviews?: Review[];
  /** 촬영 콘셉트 */
  concepts?: ShootConcept[];
  /** 가격표·상품 비교에 쓰는 촬영상품 목록 (없으면 예전처럼 동작한다) */
  packages?: PricePackage[];
  /**
   * 네이버 스마트플레이스에 넣을 때만 다르게 적어둔 글.
   *
   * ⚠ 이것은 **따로 보관하는 값**이다.
   *   여기서 고쳐도 위의 상세페이지 원본(`product`·`menus`·`studio`)은 바뀌지 않는다.
   *   비어 있으면 상세페이지 내용에서 그때그때 만들어 쓴다.
   */
  place?: Record<string, string>;
  /** ① 자료 준비에서 넣은 주소들 (없을 수 있음) */
  sources?: SourceLink[];
  /** 만드는 흐름 기록 — 자동 추천을 언제 했는지 등 (없을 수 있음) */
  flow?: FlowState;
}

/** ① 에서 넣은 주소 하나 */
export interface SourceLink {
  id: string;
  url: string;
  /** 마지막으로 가져온 결과 */
  state?: 'ok' | 'fail';
  at?: number;
}

export interface FlowState {
  /** 자동 추천을 마지막으로 만든 때 */
  recommendedAt?: number;
  /** 예약·문의를 맨 아래로 한 번 내렸는지 (그 뒤로는 사장님이 정한 순서를 그대로 둔다) */
  ctaMoved?: boolean;
  /** 마지막으로 이미지를 저장한 때 */
  savedAt?: number;
}

/** 무엇을 만들지에 대한 짧은 설명 — 전부 선택 입력이다 */
export interface ShootBrief {
  productName: string;  // 촬영상품 (가족사진 …)
  area: string;         // 지역
  mood: string;         // 원하는 분위기
  emphasis: string;     // 강조할 내용
  wish: string;         // 한 줄 요청 / 상세 프롬프트
  /** ① 에서 고른 촬영분야 (가족사진 …) — 이 분야 상품만 가격 안내에 쓴다. 가져온 실제 상품명(productName)과 따로 둔다 */
  field?: string;
  /** 가격 안내에서 사용자가 직접 고른 대표 상품 이름 (없으면 분야에 맞는 첫 상품) */
  pickedProduct?: string;
}

export const EMPTY_BRIEF: ShootBrief = {
  productName: '', area: '', mood: '', emphasis: '', wish: '',
};

export const PROJECT_VERSION = 1;
