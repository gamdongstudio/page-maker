import { AiPanel } from './AiPanel';

/**
 * ⑤ AI 자동 작성.
 *
 * ⚠ 현재 PageMaker 화면에서는 쓰지 않는다 (어디에서도 불러오지 않음 — 이 파일과 AiPanel·ImportUrl 은 예전 흐름 보존용).
 *   주소 가져오기는 components/prepare/StepPrepare.tsx 가 담당하고, PM Connect 없이 웹으로 동작한다.
 *
 * 예전에는 AI 전용 화면이 따로 있었지만, 그러면 '만드는 곳'과 '고치는 곳'이 갈라진다.
 * 이제 AI 는 별도 결과물을 만드는 기능이 아니라 ①~④ 항목을 자동으로 채워주는 기능이라
 * 이 패널 안에서 전부 끝나고, 만드는 동안에도 왼쪽 미리보기가 그대로 보인다.
 */
export function StepAi() {
  return <AiPanel />;
}
