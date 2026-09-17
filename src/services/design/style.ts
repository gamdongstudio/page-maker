import type { DesignSettings, FontKey, MenuKind, ProjectData, StylePreset } from '@/types/project';
import { DESIGN_PRESETS } from '@/types/defaults';
import { templatesFor } from '@/components/preview/templates';

/**
 * 스타일 바꾸기.
 *
 * 스타일은 색만 바꾸는 것이 아니다. **분위기 전체**를 바꾼다.
 *   색 · 글씨체 · 제목 크기 · 여백 · 영역 간격 · 사진 모서리 · 버튼 · 구분선
 *   + 영역마다 어울리는 모양(가격 카드, 큰 사진, 포스터형 …)
 *
 * ⚠ 절대 지키는 것
 *   사용자가 넣은 **글과 사진은 한 글자도 바꾸지 않는다.**
 *   영역 모양(template)은 "어떻게 보여줄지"만 정한다 — 내용은 그대로 남는다.
 */

/** 스타일마다 어울리는 영역 모양 */
const STYLE_TEMPLATES: Record<StylePreset, Partial<Record<MenuKind, string>>> = {
  /* 고급스러운 — 과하지 않은 카드, 사진은 크게 */
  luxury: {
    event: 'D', perks: 'B', price: 'B', benefit: 'A', recommend: 'A',
    gallery: 'B', shootConcept: 'A', process: 'A', prepare: 'B',
  },
  /* 깔끔한 — 정보가 잘 보이게 */
  clean: {
    event: 'A', perks: 'A', price: 'A', benefit: 'A', recommend: 'A',
    gallery: 'A', shootConcept: 'B', process: 'B', prepare: 'A',
  },
  /* 따뜻한 — 사진과 설명을 나란히 */
  warm: {
    event: 'B', perks: 'C', price: 'C', benefit: 'D', recommend: 'B',
    gallery: 'C', shootConcept: 'D', process: 'A', prepare: 'B',
  },
  /* 감성적인 — 포스터와 이야기형 */
  emotional: {
    event: 'E', perks: 'E', price: 'D', benefit: 'C', recommend: 'C',
    gallery: 'D', shootConcept: 'E', process: 'A', prepare: 'A',
  },
  /* 모던한 — 숫자와 선 */
  minimal: {
    event: 'C', perks: 'B', price: 'D', benefit: 'B', recommend: 'A',
    gallery: 'C', shootConcept: 'C', process: 'B', prepare: 'A',
  },
  /* 밝고 경쾌한 — 할인과 혜택을 크게 */
  bright: {
    event: 'A', perks: 'A', price: 'A', benefit: 'C', recommend: 'B',
    gallery: 'A', shootConcept: 'E', process: 'B', prepare: 'B',
  },
};

/**
 * 스타일을 적용한다.
 *
 * @param opts.chosen    사용자가 직접 고른 것인지 (자동 추천이 다시 바꾸지 않게 기록)
 * @param opts.templates 영역 모양까지 바꿀지 (자동 추천은 내용에 맞춰 고른 모양을 지킨다)
 */
export function applyStyle(d: ProjectData, key: StylePreset, opts: { chosen: boolean; templates?: boolean }): void {
  const before = d.design;
  const next: DesignSettings = { ...DESIGN_PRESETS[key] };

  /* 직접 고른 글씨체는 지킨다 */
  if (before.fontLocked) {
    next.titleFont = before.titleFont;
    next.bodyFont = before.bodyFont;
    next.fontLocked = true;
  }
  /* 글자 크기를 '작게/크게'로 바꿔뒀다면 새 스타일에서도 같은 비율로 */
  const scale = textScaleOf(before);
  if (scale !== 'md') {
    const k = TEXT_SCALE[scale];
    next.titleSize = Math.round(next.titleSize * k);
    next.bodySize = Math.round(next.bodySize * k);
  }
  /* 대문 사진 모양은 사진에 딸린 선택이라 그대로 */
  next.heroShape = before.heroShape;
  next.styleChosen = opts.chosen || !!before.styleChosen;
  d.design = next;

  if (opts.templates === false) return;

  /* 영역 모양 — 글·사진이 다른 곳에 들어 있는 '가격표형'은 건드리지 않는다 */
  const shapes = STYLE_TEMPLATES[key];
  d.menus.forEach((m) => {
    const want = shapes[m.kind];
    if (!want) return;
    if (m.kind === 'price' && (m.template ?? 'A') === 'E') return;
    if (!templatesFor(m.kind).some((t) => t.key === want)) return;
    m.template = want;
  });
}

/* ------------------------------------------------------------------ */
/* 글자 크기 — 작게 / 기본 / 크게                                       */
/* ------------------------------------------------------------------ */

export type TextScale = 'sm' | 'md' | 'lg';

export const TEXT_SCALE: Record<TextScale, number> = { sm: 0.88, md: 1, lg: 1.14 };

export const TEXT_SCALE_LABEL: Record<TextScale, string> = { sm: '작게', md: '기본', lg: '크게' };

/** 지금 크기가 스타일 기본값의 어느 쪽에 가까운지 */
export function textScaleOf(d: DesignSettings): TextScale {
  const base = DESIGN_PRESETS[d.preset] ?? DESIGN_PRESETS.luxury;
  const ratio = d.bodySize / base.bodySize;
  if (ratio < 0.95) return 'sm';
  if (ratio > 1.06) return 'lg';
  return 'md';
}

export function setTextScale(d: ProjectData, scale: TextScale): void {
  const base = DESIGN_PRESETS[d.design.preset] ?? DESIGN_PRESETS.luxury;
  const k = TEXT_SCALE[scale];
  d.design.titleSize = Math.round(base.titleSize * k);
  d.design.bodySize = Math.round(base.bodySize * k);
}

/** 전체 글씨체 하나로 제목·본문을 함께 */
export function setAllFonts(d: ProjectData, key: FontKey): void {
  d.design.titleFont = key;
  d.design.bodyFont = key;
  d.design.fontLocked = true;
}
