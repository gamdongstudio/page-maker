/**
 * ⚠ 현재 PageMaker 화면에서는 쓰지 않는다 (어디에서도 불러오지 않음 — 예전 흐름 보존용).
 *
 * 링크로 가져오기 — 예전 이름으로 들어오던 곳.
 *
 * 예전에는 제작기 폴더 안의 작은 수집 서비스(`collector/`)를 직접 켜서 썼다.
 * 지금은 그 일을 **BARODU Tools** 가 맡는다. 여러 BARODU 프로그램이 함께 쓰는 공통 엔진이다.
 *
 * 이 파일은 옮겨가는 동안 이름만 이어주는 얇은 층이다.
 * 실제 내용은 `baroduTools.ts` 에 있다. 새 코드는 그쪽을 바로 쓰면 된다.
 */

export type {
  SourceType, FoundImage, ImportResult, ImportFail, ToolsState, ToolsStatus,
} from './baroduTools';

export {
  SOURCE_LABEL, guessSource, checkUrl, toolsStatus, forgetTools,
  collectFromUrl as importFromUrl,
} from './baroduTools';
