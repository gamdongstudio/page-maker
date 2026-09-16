/**
 * 스마트스토어 관련 규격값은 전부 여기 한 곳에서 관리한다.
 * 외부 정책이 바뀌면 이 파일만 고치면 된다. (코드 곳곳에 하드코딩 금지)
 */

/** 스마트스토어 상세페이지 기본 작업 폭 (px) */
export const SMARTSTORE_DETAIL_WIDTH = 860;

/** 모바일 미리보기 폭 (px) */
export const MOBILE_PREVIEW_WIDTH = 390;

/** 이미지 관련 정책 */
export const IMAGE_POLICY = {
  /** 사진 한 장 권장 최대 용량 (byte) */
  maxFileSize: 10 * 1024 * 1024,
  /** 이보다 가로폭이 작으면 저해상도로 보고 안내한다 */
  lowResolutionWidth: 640,
  /** 내보낸 JPG 한 장의 권장 최대 높이 (px) — 너무 길면 업로드가 어려움 */
  maxSliceHeight: 3000,
  /** 내보내기 품질 (0~1) */
  exportQuality: 0.92,
  /** 내보내기 배율 — 1이면 화면 그대로, 2면 2배 선명 */
  exportScale: 2,

  /* --- 올린 사진을 알맞은 크기로 줄일 때 쓰는 값 --- */
  /**
   * 저장할 사진의 최대 가로 (px).
   * 상세페이지는 860px 로 만들고 2배로 뽑으므로 1720px 보다 큰 사진은
   * 화면에서도 출력에서도 쓰이지 않는다. 그 이상은 저장 공간만 차지한다.
   */
  maxStoredWidth: 1720,
  /**
   * 저장할 사진의 최대 세로 (px).
   * 넉넉하게 둔다 — 이 값이 낮으면 흔한 휴대폰 세로 사진(9:16)이
   * 가로까지 같이 줄어들어 출력이 흐려진다.
   */
  maxStoredHeight: 3600,
  /** 줄인 사진을 저장할 때 품질 (0~1) — 출력이 흐려지지 않는 선 */
  storeQuality: 0.86,
  /** 이 크기(byte)를 넘으면 줄이지 않아도 다시 눌러본다 */
  recompressOver: 1.5 * 1024 * 1024,
} as const;

/** 검수에서 쓰는 기준값 */
export const CHECK_RULES = {
  /** 이 값보다 여백이 크면 "비정상적으로 큰 여백" 으로 본다 (px) */
  hugeGap: 240,
  /** 같은 낱말이 이 횟수를 넘으면 키워드 반복으로 본다 */
  keywordRepeat: 6,
  /** 모바일에서 이 크기보다 작은 글자는 읽기 어렵다고 본다 (px) */
  minMobileFontSize: 13,
} as const;

/** LITE / PRO 모드 */
export type EditionMode = 'lite' | 'pro';
