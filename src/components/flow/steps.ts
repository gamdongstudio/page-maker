import type { ProjectData } from '@/types/project';

/**
 * 만드는 순서 — 네 단계만.
 *
 *   ① 자료 준비 → ② 자동 추천 → ③ 보면서 고치기 → ④ 저장
 *
 * 화면 자체가 설명서가 되도록 단계마다 **한두 줄 안내**와,
 * 필요한 사람만 여는 **자세한 도움말**을 둔다.
 *
 * 컴포넌트 파일이 아닌 곳에 둔다.
 * (컴포넌트 파일이 컴포넌트가 아닌 것을 내보내면 화면이 통째로 깨진 적이 있다)
 */

export type FlowStep = 'prepare' | 'recommend' | 'edit' | 'save';

/** ③ 보면서 고치기 안의 탭 */
export type EditTab = 'content' | 'photos' | 'menus' | 'design';

export interface StepInfo {
  key: FlowStep;
  no: number;
  label: string;
  /** 단계 맨 위 안내 */
  lead: string;
  /** [이 단계가 어려우신가요?] 를 눌렀을 때 */
  help: string[];
}

export const STEPS: StepInfo[] = [
  {
    key: 'prepare',
    no: 1,
    label: '자료 준비',
    lead: '가지고 있는 페이지 주소를 넣어주세요. 주소가 없으면 아래에 직접 입력하셔도 됩니다.',
    help: [
      '네이버 블로그·스마트플레이스·스마트스토어·홈페이지 주소를 넣고 [글과 사진 가져오기]를 누르면 아래 칸이 채워집니다.',
      '주소가 여러 개면 [+ 다른 주소 추가]로 함께 넣으세요. 자료가 합쳐집니다.',
      '가져오기가 안 되는 페이지는 글을 복사해서 [내용 붙여넣기]에 넣으면 됩니다.',
      '자료가 없으면 아래 칸에 알고 있는 것만 적으셔도 됩니다. 비워둔 칸은 괜찮습니다.',
      '사진은 [사진 추가]로 올리세요. 가져온 사진과 올린 사진은 한 곳에서 관리됩니다.',
    ],
  },
  {
    key: 'recommend',
    no: 2,
    label: '자동 추천',
    lead: '입력한 내용과 사진을 이용해 상세페이지 초안을 만들어드립니다.',
    help: [
      '[자동 추천 만들기]를 한 번 누르면 제목·소개글·영역 순서·사진 배치·디자인까지 한 번에 만들어집니다.',
      '가격·전화번호처럼 틀리면 안 되는 정보는 지어내지 않습니다. 적어주신 것만 씁니다.',
      '만든 뒤에도 전부 고칠 수 있습니다. 마음에 안 들면 되돌리기로 돌아갈 수 있습니다.',
      '문장을 더 자연스럽게 하고 싶으면 [ChatGPT로 문구 더 다듬기]를 쓰세요. 쓰지 않아도 완성됩니다.',
    ],
  },
  {
    key: 'edit',
    no: 3,
    label: '보면서 고치기',
    lead: '왼쪽 결과를 보면서 오른쪽에서 원하는 부분만 고쳐주세요.',
    help: [
      '왼쪽 상세페이지의 글자를 눌러 바로 고칠 수도 있습니다.',
      '[내용]은 글, [사진]은 사진, [구성]은 영역 순서·추가·삭제, [디자인]은 스타일·글씨체입니다.',
      '영역을 누르면 [구성]에서 그 영역이 열립니다.',
      '잘못 고쳤으면 위쪽 되돌리기 단추(또는 Ctrl+Z)를 누르세요.',
    ],
  },
  {
    key: 'save',
    no: 4,
    label: '저장',
    lead: '완성된 상세페이지를 원하는 방식으로 저장하세요.',
    help: [
      '[긴 이미지로 저장]은 한 장짜리 긴 그림, [여러 장으로 나누어 저장]은 영역 사이에서 나눈 여러 장입니다.',
      '스마트스토어에 올리실 거면 여러 장으로 나누어 저장하는 것이 편합니다.',
      '작업 중인 내용은 자동으로 저장되고 있습니다. 여기서는 결과 이미지를 파일로 받습니다.',
    ],
  },
];

export const stepInfo = (k: FlowStep): StepInfo => STEPS.find((s) => s.key === k) ?? STEPS[0];

/** 단계마다 끝냈다고 볼 만한지 — 작은 체크 표시에만 쓴다 (막지는 않는다) */
export function stepDone(p: ProjectData): Partial<Record<FlowStep, boolean>> {
  return {
    prepare: !!(p.product.name.trim() || p.photos.length || p.shoot?.productName),
    recommend: !!p.flow?.recommendedAt,
  };
}

/** 아무것도 넣지 않은 새 작업인지 */
export function isEmptyProject(p: ProjectData): boolean {
  return !p.product.name.trim()
    && p.photos.length === 0
    && !p.shoot?.productName
    && !p.studio?.name
    && !p.flow?.recommendedAt
    && p.menus.every((m) => !m.body.trim() && !m.lines.some((l) => l.trim()));
}

export const EDIT_TABS: { key: EditTab; label: string }[] = [
  { key: 'content', label: '내용' },
  { key: 'photos', label: '사진' },
  { key: 'menus', label: '구성' },
  { key: 'design', label: '디자인' },
];
