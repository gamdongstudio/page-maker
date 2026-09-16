import type { AiProvider } from './types';
import { localPlanner } from './localPlanner';

/**
 * AI provider 등록소.
 *
 * 실제 AI 를 붙일 때는 이 파일에 provider 를 하나 추가하기만 하면 된다.
 * (화면 코드는 provider 이름을 몰라도 된다)
 *
 * ⚠ API 키를 화면 쪽 코드에 적지 말 것. 서버(또는 서버리스 함수)를 통해 부른다.
 */

/** 아직 연결되지 않은 실제 AI 자리 */
const remotePlanner: AiProvider = {
  id: 'remote',
  label: '고급 AI',
  isReady: () => false,
  notReadyReason:
    '고급 AI 추천을 쓰려면 서버 연결이 필요합니다. 연결 전에도 아래 기본 추천은 그대로 사용할 수 있습니다.',
  async plan() {
    throw new Error('아직 연결되지 않았습니다.');
  },
};

export const AI_PROVIDERS: AiProvider[] = [localPlanner, remotePlanner];

export function getProvider(id: string): AiProvider {
  return AI_PROVIDERS.find((p) => p.id === id) ?? localPlanner;
}

export { localPlanner };
export type { AiPlan, AiProvider } from './types';
