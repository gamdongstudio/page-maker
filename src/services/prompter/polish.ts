import type { MenuKind, ProjectData } from '@/types/project';
import { makeMenu } from '@/types/defaults';
import { stripBanned } from '@/services/ai/types';

/**
 * ChatGPT 로 문구 더 다듬기.
 *
 * BARODU 가 ChatGPT 를 직접 부르지 않는다. (연결된 서버가 없다)
 *   1. BARODU 가 요청문을 만든다
 *   2. 사용자가 ChatGPT 에 붙여넣는다
 *   3. 받은 답을 BARODU 에 다시 붙여넣는다
 *   4. [ChatGPT 결과 적용] 을 누르면 항목마다 제자리에 들어간다
 *
 * ⚠ 가격 · 전화번호 · 주소 · 영업시간처럼 **사실 정보는 바꾸지 않는다.**
 *   요청문에서도 바꾸지 말라고 적고, 답에 들어 있어도 그런 칸에는 넣지 않는다.
 */

/** 답에서 찾는 칸 — 요청문과 이름이 같아야 한다 */
export const POLISH_SLOTS = [
  { key: 'title', label: '메인 제목' },
  { key: 'tagline', label: '한 줄 소개' },
  { key: 'description', label: '상품 설명' },
  { key: 'benefits', label: '주요 장점' },
  { key: 'target', label: '추천 대상' },
  { key: 'howto', label: '이용 방법' },
  { key: 'booking', label: '예약 안내' },
  { key: 'closing', label: '마무리 문구' },
] as const;

export type PolishKey = typeof POLISH_SLOTS[number]['key'];

const bodyOf = (p: ProjectData, kind: MenuKind) => p.menus.find((m) => m.kind === kind && !m.hidden);

/** 지금 들어 있는 글 — 요청문에 담아 ChatGPT 가 고칠 재료로 쓴다 */
function currentText(p: ProjectData): Record<PolishKey, string> {
  const lines = (kind: MenuKind) => {
    const m = bodyOf(p, kind);
    if (!m) return '';
    return m.lines.filter((l) => l.trim()).join('\n') || m.body;
  };
  return {
    title: p.product.name,
    tagline: p.product.tagline,
    description: bodyOf(p, 'intro')?.body || p.product.description,
    benefits: bodyOf(p, 'benefit')?.body || p.product.benefits,
    target: lines('recommend') || p.product.target,
    howto: p.product.howToUse || lines('process'),
    booking: p.product.contact,
    closing: '',
  };
}

export function buildPolishPrompt(p: ProjectData): string {
  const now = currentText(p);
  const facts = [
    p.studio?.name && `상호: ${p.studio.name}`,
    p.shoot?.productName && `상품 종류: ${p.shoot.productName}`,
    p.product.listPrice && `정상가: ${p.product.listPrice}원`,
    p.product.salePrice && `판매가: ${p.product.salePrice}원`,
    p.studio?.area && `지역: ${p.studio.area}`,
    p.shoot?.emphasis && `강조하고 싶은 것: ${p.shoot.emphasis}`,
  ].filter(Boolean).join('\n');

  return [
    '상세페이지 문구를 더 자연스럽게 다듬어주세요.',
    '',
    '[상품 정보 — 바꾸지 마세요]',
    facts || '(없음)',
    '',
    '[지금 문구]',
    ...POLISH_SLOTS.map((s) => `[${s.label}]\n${now[s.key] || '(비어 있음 — 위 정보로 새로 써주세요)'}`),
    '',
    '[지켜주세요]',
    '- 가격·전화번호·주소·영업시간 같은 사실 정보는 바꾸거나 새로 만들지 마세요.',
    '- 없는 혜택·후기·수상 경력을 지어내지 마세요.',
    '- 과장된 표현(최고, 1위, 100% 등)은 쓰지 마세요.',
    '- 이모지와 특수기호는 쓰지 마세요.',
    '- 여러 줄 항목(주요 장점, 추천 대상)은 한 줄에 하나씩 적어주세요.',
    '',
    '[답하는 방법]',
    '아래 형식 그대로, 대괄호 제목을 바꾸지 말고 답해주세요. 다른 설명은 붙이지 마세요.',
    '',
    ...POLISH_SLOTS.map((s) => `[${s.label}]\n(여기에 다듬은 문구)`),
    '',
  ].join('\n');
}

/** ChatGPT 답을 칸별로 나눈다. 못 찾은 칸은 비워둔다 */
export function parsePolish(answer: string): Partial<Record<PolishKey, string>> {
  const out: Partial<Record<PolishKey, string>> = {};
  const text = (answer || '').replace(/\r/g, '');
  const heads = [...text.matchAll(/^\s*(?:#+\s*)?\*{0,2}\[\s*([^\]\n]+?)\s*\]\*{0,2}\s*:?\s*$/gm)];

  heads.forEach((h, i) => {
    const slot = POLISH_SLOTS.find((s) => s.label.replace(/\s/g, '') === h[1].replace(/\s/g, ''));
    if (!slot) return;
    const start = (h.index ?? 0) + h[0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index ?? text.length : text.length;
    const body = text.slice(start, end)
      .split('\n')
      .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, '').trim())
      /* 이모지와 장식 기호는 넣지 않는다 */
      .map((l) => l.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}★☆♥❤◆◇▶►✔✓✨※]/gu, '').trim())
      .filter((l) => l && !/^\(여기에 다듬은 문구\)$/.test(l))
      .map((l) => stripBanned(l))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (body) out[slot.key] = body;
  });

  return out;
}

/**
 * 고른 칸만 작업에 넣는다. (한 번에 넣어 실행취소 한 번이면 돌아간다)
 * 영역이 없으면 만들어 넣되, 가격·전화 같은 칸은 건드리지 않는다.
 */
export function applyPolish(d: ProjectData, got: Partial<Record<PolishKey, string>>, pick: PolishKey[]): void {
  const on = (k: PolishKey) => pick.includes(k) && !!got[k];
  const menu = (kind: MenuKind) => {
    let m = d.menus.find((x) => x.kind === kind);
    if (!m) {
      m = makeMenu(kind);
      const cta = d.menus.findIndex((x) => x.kind === 'cta');
      d.menus.splice(cta < 0 ? d.menus.length : cta, 0, m);
    }
    m.hidden = false;
    return m;
  };
  const list = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  if (on('title')) d.product.name = list(got.title!)[0];
  if (on('tagline')) d.product.tagline = list(got.tagline!).join(' ');
  if (on('description')) {
    d.product.description = got.description!;
    menu('intro').body = got.description!;
  }
  if (on('benefits')) {
    d.product.benefits = got.benefits!;
    menu('benefit').body = got.benefits!;
  }
  if (on('target')) {
    d.product.target = got.target!;
    const m = menu('recommend');
    m.lines = list(got.target!);
    m.body = '';
  }
  if (on('howto')) {
    d.product.howToUse = got.howto!;
    menu('howto').body = got.howto!;
  }
  if (on('booking') || on('closing')) {
    const m = menu('cta');
    const parts = [on('closing') ? got.closing! : '', on('booking') ? got.booking! : m.body]
      .filter((x) => x && x.trim());
    m.body = parts.join('\n\n');
  }
}
