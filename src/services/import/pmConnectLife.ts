import { forgetTools, toolsStatus, wasSeenBefore } from './baroduTools';

/**
 * PM Connect 를 사용자가 따로 켜고 끄지 않게 한다.
 *
 *   PageMaker 열림 → 꺼져 있으면 pmconnect:// 로 켠다
 *   PageMaker 열려 있는 동안 → 10초마다 찾아간다 (PM Connect 는 이걸로 PageMaker 가 열려 있음을 안다)
 *   PageMaker 닫힘 → 찾아오지 않으니 PM Connect 가 30초 뒤 스스로 끝난다
 *
 * ⚠ PM Connect 를 이 컴퓨터에서 한 번이라도 쓴 적이 있을 때만 움직인다.
 *   처음 온 사람에게 브라우저의 '로컬 네트워크 접근' 질문이나 프로그램 열기 질문을 띄우지 않기 위해서다.
 *   (처음 쓰는 사람은 지금처럼 [글과 사진 가져오기] 를 누를 때 연결 안내를 본다)
 */

const BEAT_MS = 10 * 1000;
const LAUNCH_GAP_MS = 60 * 1000;

let started = false;
let stopped = false;
let lastLaunch = 0;

function launch(): void {
  if (Date.now() - lastLaunch < LAUNCH_GAP_MS) return;
  lastLaunch = Date.now();
  forgetTools();
  try {
    /* 설치돼 있으면 Windows 가 PM Connect 를 켠다. 없으면 아무 일도 없다 */
    window.location.href = 'pmconnect://start';
  } catch {
    /* 막혀도 PageMaker 는 그대로 쓴다 */
  }
}

async function beat(): Promise<void> {
  if (!wasSeenBefore()) return; /* 처음 온 사람에게는 아무 요청도 보내지 않는다 — 한 번 연결되면 다음 박자부터 시작 */
  const s = await toolsStatus();
  stopped = s.state === 'stopped';
  if (stopped) launch();
}

export function startPmConnectLife(): void {
  if (started) return;
  started = true;

  void beat();
  /*
   * 박자는 작업자(Worker) 안의 타이머로 센다 — 뒤쪽 탭의 일반 타이머는 브라우저가 1분에 한 번까지 늦춰
   * PM Connect(30초 기다림)가 PageMaker 가 닫힌 줄 알고 끝날 수 있기 때문이다. 못 만들면 일반 타이머로.
   */
  try {
    const src = `setInterval(() => postMessage(0), ${BEAT_MS});`;
    const ticker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    ticker.onmessage = () => void beat();
  } catch {
    window.setInterval(() => void beat(), BEAT_MS);
  }

  /* 브라우저가 사용자 동작 없이 프로그램 열기를 막은 경우 — 첫 클릭·키 입력 때 다시 시도한다 */
  let lastRetry = 0;
  const retry = () => {
    if (!stopped || Date.now() - lastRetry < LAUNCH_GAP_MS) return; /* 거절해도 매번 묻지 않게 1분에 한 번만 */
    lastRetry = Date.now();
    lastLaunch = 0;
    launch();
  };
  window.addEventListener('pointerdown', retry, true);
  window.addEventListener('keydown', retry, true);

  /* 다른 탭에 있다가 돌아오면 바로 한 번 확인한다 */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void beat();
  });
}
