import type { MenuKind } from '@/types/project';

/**
 * 섹션 모양(템플릿) 목록.
 *
 * 핵심: **내용과 모양은 완전히 따로다.**
 * 모양을 바꿔도 글·사진·가격·혜택은 그대로 남는다.
 * 여기 있는 것은 "어떻게 보여줄지"일 뿐이라 데이터에 손대지 않는다.
 *
 * 색만 다른 것이 아니라 **배치 자체가 다르게** 보이도록 만든다.
 */

export interface TemplateOption {
  key: string;
  label: string;
}

export const SECTION_TEMPLATES: Partial<Record<MenuKind, TemplateOption[]>> = {
  event: [
    { key: 'A', label: '큰 할인 강조' },
    { key: 'B', label: '사진 + 가격' },
    { key: 'C', label: '기간 강조 배너' },
    { key: 'D', label: '고급 카드' },
    { key: 'E', label: '이벤트 포스터형' },
  ],
  perks: [
    { key: 'A', label: '번호 강조' },
    { key: 'B', label: '카드' },
    { key: 'C', label: '사진 + 설명' },
    { key: 'D', label: '아이콘' },
    { key: 'E', label: '세로 스토리' },
  ],
  price: [
    { key: 'A', label: '큰 가격 강조' },
    { key: 'B', label: '패키지 카드' },
    { key: 'C', label: '정상가 → 할인가' },
    { key: 'D', label: '포함사항 중심' },
    { key: 'E', label: '가격표형 (여러 상품)' },
  ],
  compare: [
    { key: 'A', label: '상품 카드 나란히' },
    { key: 'B', label: '가격표' },
  ],
  shootConcept: [
    { key: 'A', label: '큰 사진 중심' },
    { key: 'B', label: '사진 왼쪽 / 설명 오른쪽' },
    { key: 'C', label: '설명 왼쪽 / 사진 오른쪽' },
    { key: 'D', label: '콜라주' },
    { key: 'E', label: '카드 갤러리' },
  ],
  benefit: [
    { key: 'A', label: '포인트 카드' },
    { key: 'B', label: '숫자' },
    { key: 'C', label: '키워드 강조' },
    { key: 'D', label: '사진 + 설명' },
  ],
  recommend: [
    { key: 'A', label: '체크리스트' },
    { key: 'B', label: '상황별 카드' },
    { key: 'C', label: '질문형' },
    { key: 'D', label: '큰 문장' },
  ],
  gallery: [
    { key: 'A', label: '갤러리 격자' },
    { key: 'B', label: '큰 사진 하나씩' },
    { key: 'C', label: '두 장씩 나란히' },
    { key: 'D', label: '모자이크' },
  ],
  process: [
    { key: 'A', label: '번호 세로' },
    { key: 'B', label: '가로 단계' },
  ],
  prepare: [
    { key: 'A', label: '체크 목록' },
    { key: 'B', label: '카드' },
  ],
};

export function templatesFor(kind: MenuKind): TemplateOption[] {
  return SECTION_TEMPLATES[kind] ?? [];
}

export function templateLabel(kind: MenuKind, key: string | undefined): string {
  const list = templatesFor(kind);
  return list.find((t) => t.key === (key ?? 'A'))?.label ?? '';
}

/** 다음 모양으로 (내용은 그대로) */
export function nextTemplateFor(kind: MenuKind, now: string | undefined): string {
  const list = templatesFor(kind);
  if (list.length === 0) return now ?? 'A';
  const i = list.findIndex((t) => t.key === (now ?? 'A'));
  return list[(i + 1) % list.length].key;
}

/**
 * 이 모양이 사진을 **직접** 배치하는지.
 * true 면 아래쪽 공통 사진 칸을 따로 그리지 않는다. (사진이 두 번 나오면 안 된다)
 */
export function ownsPhotos(kind: MenuKind, tpl: string | undefined): boolean {
  const t = tpl ?? 'A';
  if (kind === 'gallery') return true;
  if (kind === 'compare') return true;
  if (kind === 'shootConcept') return t !== 'A';
  if (kind === 'perks') return t === 'C';
  if (kind === 'benefit') return t === 'D';
  if (kind === 'event') return t === 'B' || t === 'E';
  if (kind === 'price') return t === 'E';
  return false;
}
