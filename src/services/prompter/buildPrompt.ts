import type { ProjectData } from '@/types/project';
import { FONT_LABEL } from '@/types/project';

/**
 * SAY PROMPTER — 다른 생성형 AI 에 그대로 붙여넣을 **작업 요청문**을 만든다.
 *
 * 이 기능은 상세페이지를 직접 고치지 않는다.
 * 사용자가 하고 싶은 말을 정리해서, 어느 AI 에 넣어도 알아듣도록 만들어 줄 뿐이다.
 */

export type PromptTarget = 'basic' | 'chatgpt' | 'claude';

export const TARGET_LABEL: Record<PromptTarget, string> = {
  basic: '기본형',
  chatgpt: 'ChatGPT용',
  claude: 'Claude용',
};

export const TARGET_DESC: Record<PromptTarget, string> = {
  basic: '어떤 AI에서든 사용할 수 있는 공통 요청문입니다.',
  chatgpt: 'ChatGPT가 이해하기 쉽게 작업 내용을 단계별로 정리합니다.',
  claude: '기존 코드를 먼저 확인하고 안전하게 수정하도록 자세히 정리합니다.',
};

/** 처음 열었을 때 고를 값 */
export const DEFAULT_TARGET: PromptTarget = 'basic';

/* ------------------------------------------------------------------ */

/** 지금 작업 상태를 사람이 읽을 수 있게 정리한다 */
/** 요청문에 무엇을 담을지 */
export interface IncludeOpts {
  product: boolean;
  design: boolean;
  menus: boolean;
  photos: boolean;
}

export const DEFAULT_INCLUDE: IncludeOpts = {
  product: true, design: true, menus: true, photos: true,
};

export function describeCurrent(p: ProjectData, include: IncludeOpts = DEFAULT_INCLUDE): string {
  const d = p.design;
  const visible = p.menus.filter((m) => !m.hidden);
  const shapes = p.photos.reduce<Record<string, number>>((acc, ph) => {
    const r = ph.width / Math.max(1, ph.height);
    const k = r > 1.15 ? '가로' : r < 0.87 ? '세로' : '정사각형';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const shapeText = Object.keys(shapes).length
    ? ` (${Object.entries(shapes).map(([k, v]) => `${k} ${v}`).join(', ')})`
    : '';
  const placed = visible.filter((m) => m.photoIds.length)
    .map((m) => `${m.title} ${m.photoIds.length}장`).join(', ');
  const heroWord = d.heroShape === 'auto' ? '자동'
    : d.heroShape === 'landscape' ? '가로형'
      : d.heroShape === 'square' ? '정사각형' : '세로형';

  return [
    include.product ? `상품명: ${p.product.name || '(비어 있음)'}` : '',
    include.product && p.product.brand ? `사진관명: ${p.product.brand}` : '',
    include.product && p.product.category ? `촬영 종류: ${p.product.category}` : '',
    include.product && p.product.salePrice ? `판매가: ${p.product.salePrice}` : '',
    include.menus ? `상세페이지 구성: ${visible.map((m) => m.title).join(' → ') || '(없음)'}` : '',
    include.photos ? `사진: ${p.photos.length}장${shapeText}` : '',
    include.photos ? `사진 배치: ${placed || '(자동 배치)'}` : '',
    include.design
      ? `디자인: ${d.preset} 스타일 · 글꼴 ${FONT_LABEL[d.bodyFont]?.name ?? d.bodyFont} · 제목 ${d.titleSize}px · 본문 ${d.bodySize}px · 메뉴 간격 ${d.menuGap}px`
      : '',
    include.design ? `대문 사진 모양: ${heroWord}` : '',
    include.design && p.reference ? `참고 캡처에서 읽은 느낌: ${p.reference.findings.join(' / ')}` : '',
  ].filter(Boolean).join('\n');
}

/* ------------------------------------------------------------------ */

export function buildPrompt(
  p: ProjectData, wish: string, target: PromptTarget, include: IncludeOpts = DEFAULT_INCLUDE,
): string {
  const want = wish.trim() || '(수정하고 싶은 내용을 적어주세요)';
  const state = describeCurrent(p, include) || '(지금 상태는 담지 않았습니다)';

  if (target === 'chatgpt') return chatgpt(state, want);
  if (target === 'claude') return claude(state, want);
  return basic(state, want);
}

/* ------------------------------------------------------------------ */
/* 기본형 — 특정 AI 이름이나 그 서비스에서만 통하는 말을 쓰지 않는다        */
/* ------------------------------------------------------------------ */

function basic(state: string, want: string): string {
  return [
    '스마트스토어에 올릴 사진관 상세페이지를 수정하려고 합니다.',
    '아래 내용을 참고해서 도와주세요.',
    '',
    '[지금 상세페이지 상태]',
    state,
    '',
    '[이렇게 바꾸고 싶습니다]',
    want,
    '',
    '[그대로 두어야 하는 것]',
    '- 지금 잘 되고 있는 기능은 그대로 둡니다.',
    '- 상품명·가격·촬영 구성처럼 이미 적어둔 내용은 임의로 지우지 않습니다.',
    '- 위에서 말한 부분만 바꿉니다.',
    '',
    '[사진 규칙]',
    '- 올린 사진은 원본 그대로 씁니다.',
    '- 사진 속 인물의 얼굴·표정·머리·옷·체형을 바꾸거나 새로 만들지 않습니다.',
    '- 사진은 크기·위치·배치만 조정합니다. 원본 비율을 지키고 찌그러뜨리지 않습니다.',
    '',
    '[확인할 것]',
    '- PC 화면에서 자연스럽게 보이는지',
    '- 휴대폰 화면에서 글자와 사진이 화면 밖으로 넘치지 않는지',
    '- 바꾼 부분이 의도대로 보이는지',
    '- 바꾸지 않기로 한 부분이 그대로인지',
    '',
    '먼저 제가 원하는 것을 어떻게 이해했는지 짧게 정리한 뒤 진행해주세요.',
    '',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* ChatGPT용 — 작업 순서를 단계로 나눠 적는다                            */
/* ------------------------------------------------------------------ */

function chatgpt(state: string, want: string): string {
  return [
    '스마트스토어에 올릴 사진관 상세페이지를 수정하려고 합니다.',
    '아래 순서대로 진행해주세요.',
    '',
    '[지금 상세페이지 상태]',
    state,
    '',
    '[이렇게 바꾸고 싶습니다]',
    want,
    '',
    '[작업 순서]',
    '1. 지금 구조를 먼저 확인하고, 어떻게 이해했는지 짧게 정리합니다.',
    '2. 무엇을 바꿔야 하는지 대상을 분명히 정합니다.',
    '3. 지금 잘 되고 있는 기능과 내용은 그대로 둡니다.',
    '4. 요청한 부분만 수정합니다.',
    '5. PC 화면에서 확인합니다.',
    '6. 휴대폰 화면에서 확인합니다.',
    '7. 바꾼 것과 그대로 둔 것을 정리해서 알려줍니다.',
    '',
    '[사진 규칙]',
    '- 올린 사진은 원본 그대로 씁니다.',
    '- 인물의 얼굴·표정·머리·옷을 바꾸거나 새로 만들지 않습니다.',
    '- 크기·위치·배치만 조정하고 원본 비율을 지킵니다.',
    '',
    '[하지 말아야 할 것]',
    '- 요청하지 않은 부분까지 손대지 않기',
    '- 이미 적어둔 상품명·가격·구성 지우지 않기',
    '',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Claude용 — 실제 코드를 고치는 상황까지 생각해 더 자세히                */
/* ------------------------------------------------------------------ */

function claude(state: string, want: string): string {
  return [
    '사진관 상세페이지 제작 도구를 수정하려고 합니다.',
    '새로 만드는 작업이 아니라 기존 코드를 고치는 작업입니다.',
    '',
    '[지금 상세페이지 상태]',
    state,
    '',
    '[이렇게 바꾸고 싶습니다]',
    want,
    '',
    '[작업 방식]',
    '- 먼저 기존 코드와 구조를 확인한 뒤 시작해주세요.',
    '- 관련 있는 파일만 수정해주세요.',
    '- 전체를 다시 작성하지 마세요.',
    '- 같은 기능을 다른 곳에 새로 만들지 마세요.',
    '',
    '[반드시 지킬 것]',
    '- 지금 정상 작동하는 기능을 그대로 유지합니다.',
    '- 기존 데이터 구조를 유지합니다. 저장해 둔 작업파일이 열리지 않게 되면 안 됩니다.',
    '- 올린 사진은 원본 그대로 씁니다. 인물의 얼굴·표정·머리·옷을 바꾸지 않습니다.',
    '- 사진은 크기·위치·배치만 조정합니다.',
    '',
    '[작업 후 확인]',
    '- PC 화면 확인',
    '- 휴대폰 화면 확인 (가로 스크롤이 생기지 않는지)',
    '- 빌드가 정상인지',
    '- 오류가 없는지',
    '- 바꾸지 않기로 한 기능이 그대로인지',
    '',
    '먼저 무엇을 어떻게 고칠지 짧게 알려준 다음 진행해주세요.',
    '',
  ].join('\n');
}
