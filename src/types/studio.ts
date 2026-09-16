/**
 * 사진관 전용 자료 구조.
 *
 * 이 프로그램은 범용 쇼핑몰 도구가 아니라
 * 사진관 사장님이 사진 몇 장만 넣으면 상세페이지가 거의 완성되는 도구다.
 *
 * ⚠ 가장 중요한 규칙 — 원본 인물 보호
 *   업로드된 사진 속 사람의 얼굴·표정·머리·옷·체형은
 *   사용자가 직접 바꿔달라고 하지 않는 한 절대 바꾸지 않는다.
 *   이 프로그램은 사진을 새로 만들어내지 않는다. 크기·위치·배치만 다룬다.
 *   (자세한 내용은 docs/PHOTO-POLICY.md)
 */

/* ------------------------------------------------------------------ */
/* 사진관 공통정보 — 한 번 적어두고 모든 촬영상품에서 다시 쓴다            */
/* ------------------------------------------------------------------ */

export interface StudioInfo {
  name: string;        // 상호
  area: string;        // 지역 (예: 광명)
  address: string;     // 주소
  phone: string;       // 전화번호
  bookingUrl: string;  // 예약링크
  sns: string;         // SNS
  hours: string;       // 영업시간
  offDays: string;     // 휴무일
  intro: string;       // 사진관 소개
  logoDataUrl: string; // 로고 (선택)
}

export const EMPTY_STUDIO: StudioInfo = {
  name: '', area: '', address: '', phone: '', bookingUrl: '',
  sns: '', hours: '', offDays: '', intro: '', logoDataUrl: '',
};

export function studioIsEmpty(s: StudioInfo | undefined): boolean {
  if (!s) return true;
  return !s.name && !s.area && !s.phone && !s.address;
}

/* ------------------------------------------------------------------ */
/* 촬영상품 — 고정 목록이 아니다. 사용자가 자유롭게 관리한다              */
/* ------------------------------------------------------------------ */

export interface ShootProduct {
  id: string;
  name: string;
  /** 처음부터 들어있던 상품인지 — 지워도 '기본 상품 되살리기'로 돌아온다 */
  builtin: boolean;
  hidden: boolean;
}

/** 처음 보여주는 기본 촬영상품 */
export const DEFAULT_SHOOT_PRODUCTS = [
  '가족사진', '프로필사진', '증명사진', '취업사진', '아기사진',
  '스냅사진', '복원사진', '장수사진', '반려동물사진',
];

/* ------------------------------------------------------------------ */
/* 사진관 가격                                                          */
/* ------------------------------------------------------------------ */

export interface StudioPricing {
  listPrice: string;     // 정상가
  eventPrice: string;    // 이벤트가
  people: string;        // 기준 인원
  includes: string;      // 포함사항 (줄바꿈으로 여러 개)
  frame: string;         // 액자
  retouch: string;       // 수정본
  rawFiles: string;      // 원본 제공
  costume: string;       // 의상
  hairMakeup: string;    // 헤어·메이크업
  extraPerson: string;   // 추가 인원 비용
  weekendExtra: string;  // 주말 추가비용
  etcExtra: string;      // 기타 추가금
}

export const EMPTY_PRICING: StudioPricing = {
  listPrice: '', eventPrice: '', people: '', includes: '',
  frame: '', retouch: '', rawFiles: '', costume: '', hairMakeup: '',
  extraPerson: '', weekendExtra: '', etcExtra: '',
};

/* ------------------------------------------------------------------ */
/* 이벤트                                                              */
/* ------------------------------------------------------------------ */

export interface StudioEvent {
  title: string;       // 이벤트명
  period: string;      // 기간
  listPrice: string;   // 정상가
  eventPrice: string;  // 이벤트가
  body: string;        // 이벤트 설명
  photoId: string;     // 이미지 (선택)
}

export const EMPTY_EVENT: StudioEvent = {
  title: '', period: '', listPrice: '', eventPrice: '', body: '', photoId: '',
};

/* ------------------------------------------------------------------ */
/* 특별한 혜택 · 촬영 콘셉트                                             */
/* ------------------------------------------------------------------ */

export interface Perk {
  id: string;
  title: string;
  body: string;
  photoId: string;   // 사진 (선택)
  icon: string;      // 아이콘 대신 쓰는 짧은 글자/이모지 (선택)
}

export interface ShootConcept {
  id: string;
  name: string;        // 콘셉트명 (캐주얼 / 리마인드 / 한복 …)
  summary: string;     // 짧은 설명
  body: string;        // 상세설명
  mainPhotoId: string; // 대표사진
  photoIds: string[];  // 추가사진
}

/* ------------------------------------------------------------------ */
/* AI 가 읽은 내용 확인 — 틀리면 안 되는 정보는 사용자가 확인해야 한다     */
/* ------------------------------------------------------------------ */

/**
 * 한 항목의 읽기 결과.
 * confident 가 false 면 화면에 "확인이 필요합니다" 라고 표시한다.
 * 확실하지 않은 값을 지어내지 않는다.
 */
export interface ReadField {
  key: string;
  label: string;
  value: string;
  confident: boolean;
  /** 어디서 가져왔는지 — 사람이 읽는 말 */
  from: string;
}

export interface ReadResult {
  fields: ReadField[];
  /** 읽지 못한 이유 등 알려줄 말 */
  notes: string[];
}
