import { AiPanel } from './AiPanel';

/**
 * ⑤ AI 자동 작성.
 *
 * 예전에는 AI 전용 화면이 따로 있었지만, 그러면 '만드는 곳'과 '고치는 곳'이 갈라진다.
 * 이제 AI 는 별도 결과물을 만드는 기능이 아니라 ①~④ 항목을 자동으로 채워주는 기능이라
 * 이 패널 안에서 전부 끝나고, 만드는 동안에도 왼쪽 미리보기가 그대로 보인다.
 */
export function StepAi() {
  return <AiPanel />;
}
