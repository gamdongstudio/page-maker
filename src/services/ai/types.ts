import type { MenuKind, ProjectData } from '@/types/project';

/**
 * AI 서비스 연결 구조.
 *
 * 원칙:
 *  - AI 연결이 없어도 PAGE MAKER 핵심 기능은 전부 동작한다.
 *  - 연결 전에는 "AI가 분석했다" 고 속이지 않는다. 무엇으로 만든 결과인지 화면에 그대로 밝힌다.
 *  - 나중에 실제 provider(OpenAI 등)를 붙이기 쉽도록 이 인터페이스만 구현하면 된다.
 */

export interface AiPlan {
  /** 이 결과를 무엇으로 만들었는지 — 화면에 그대로 보여준다 */
  source: 'local' | 'api';
  sourceLabel: string;

  analysis: string;        // 상품 분석
  audience: string;        // 주요 고객 분석
  benefits: string[];      // 핵심 장점 정리
  searchTitles: string[];  // 검색용 상품 제목 후보
  heroCopy: string[];      // 상세페이지 대문 카피 후보
  menus: { kind: MenuKind; title: string; body: string }[];  // 추천 메뉴 + 순서 + 제목 + 설명
  cta: string;             // 마지막 CTA
}

export interface AiProvider {
  id: string;
  label: string;
  /** 지금 쓸 수 있는 상태인지 */
  isReady(): boolean;
  /** 못 쓰는 이유 (연결 안내 문구) */
  notReadyReason?: string;
  plan(project: ProjectData): Promise<AiPlan>;
}

/** 쓰면 안 되는 과장 표현 — 결과에서 걸러낸다 */
export const BANNED_PHRASES = [
  '무조건 상단노출', '상단노출 보장', '검색 1위', '검색1위', '1위 보장', '상위노출 보장', '상위 노출 보장',
];

export function stripBanned(text: string): string {
  let out = text;
  BANNED_PHRASES.forEach((p) => {
    out = out.split(p).join('');
  });
  return out.replace(/\s{2,}/g, ' ').trim();
}
