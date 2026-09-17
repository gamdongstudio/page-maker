import type { MenuItem, MenuKind, ProjectData, ProductInfo } from '@/types/project';
import { hasContent } from '@/components/preview/sectionContent';

/**
 * 내용 칸과 상세페이지 영역을 **같은 글**로 묶는다.
 *
 * 자동 추천은 상품 설명·주요 특징 같은 글을 그 영역(소개·장점 …)에 옮겨 담는다.
 * 그 뒤에 내용 칸만 고치면 **영역에는 옛 글이 남아** 왼쪽이 안 바뀌었다.
 * 이제 내용 칸은 그 영역의 글을 그대로 보여주고, 고치면 둘 다 함께 바뀐다.
 */

type LinkedKey = 'description' | 'benefits' | 'target' | 'howToUse' | 'caution';

const KIND: Record<LinkedKey, MenuKind> = {
  description: 'intro',
  benefits: 'benefit',
  target: 'recommend',
  howToUse: 'howto',
  caution: 'caution',
};

export const isLinked = (k: keyof ProductInfo): k is LinkedKey => k in KIND;

/** 이 글을 담는 영역 — 보이는 것을 먼저 */
function sectionFor(p: ProjectData, key: LinkedKey): MenuItem | undefined {
  const list = p.menus.filter((m) => m.kind === KIND[key]);
  return list.find((m) => !m.hidden) ?? list[0];
}

/** 내용 칸에 보여줄 글 — 영역에 들어 있는 글이 있으면 그것 */
export function linkedValue(p: ProjectData, key: LinkedKey): string {
  const m = sectionFor(p, key);
  if (m) {
    if (key === 'target') {
      const lines = m.lines.filter((l) => l.trim());
      if (lines.length) return lines.join('\n');
    } else if (m.body.trim()) {
      return m.body;
    }
  }
  return p.product[key];
}

/**
 * 비어서 숨겨져 있던 영역은, 내용을 채우면 다시 보이게 한다.
 *
 * 자동 추천은 내용이 없는 영역을 숨긴다. 그 뒤에 내용 칸에서 가격·구성·설명을 적었는데
 * 영역이 계속 숨겨져 있으면 "적었는데 왜 안 나오지?" 가 된다.
 * ⚠ 내용이 있는데 사용자가 직접 숨긴 영역은 그대로 둔다.
 */
export function revealWhenFilled(d: ProjectData, kinds: MenuKind[], change: () => void): void {
  const emptyHidden = d.menus.filter((m) => kinds.includes(m.kind) && m.hidden && !hasContent(m, d));
  change();
  emptyHidden.forEach((m) => { if (hasContent(m, d)) m.hidden = false; });
}

/** 내용 칸을 고쳤다 — 상품정보와 영역 글을 함께 바꾼다 */
export function setLinked(d: ProjectData, key: LinkedKey, value: string): void {
  revealWhenFilled(d, [KIND[key]], () => {
    d.product[key] = value;
    const m = sectionFor(d, key);
    if (!m) return;
    if (key === 'target') {
      m.lines = value.split('\n').map((l) => l.trim()).filter(Boolean);
      m.body = '';
    } else {
      m.body = value;
    }
  });
}
