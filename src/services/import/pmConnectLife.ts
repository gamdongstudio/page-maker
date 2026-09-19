import { forgetTools, toolsStatus, wasSeenBefore } from './baroduTools';

/**
 * PM Connect 를 사용자가 따로 켜고 끄지 않게 한다.
 *
 *   PageMaker 열림 → 꺼져 있으면 pmconnect:// 로 **탭마다 딱 한 번만** 켠다
 *   PageMaker 열려 있는 동안 → 10초마다 찾아간다 (PM Connect 는 이걸로 PageMaker 가 열려 있음을 안다)
 *   PageMaker 닫힘 → 찾아오지 않으니 PM Connect 가 30초 뒤 스스로 끝난다
 *
 * ⚠ 예전에는 박자마다(1분 간격)·클릭마다 pmconnect:// 를 다시 불러
 *   Chrome 의 'PM Connect 를 여시겠습니까?' 창이 계속 다시 떴다.
 *   이제는 한 탭에서 한 번 요청하고, 한 번이라도 연결되면 다시는 요청하지 않는다.
 *
 * ⚠ PM Connect 를 이 컴퓨터에서 한 번이라도 쓴 적이 있을 때만 움직인다.
 *   처음 온 사람에게 브라우저의 '로컬 네트워크 접근' 질문이나 프로그램 열기 질문을 띄우지 않기 위해서다.
 */

const BEAT_MS = 10 * 1000;

let started = false;
/** 이 탭에서 이미 켜기를 요청했는지 — 탭마다 한 번만 */
let launched = false;
/** 이 탭에서 PM Connect 가 한 번이라도 응답했는지 — 그 뒤로는 켜기 요청을 하지 않는다 */
let connected = false;
/** 사용자 동작이 없어 요청을 미뤄둔 상태 */
let waitingGesture = false;

function hasGesture(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : true;
}

function launch(): void {
  if (launched || connected) return;
  /* 사용자 동작 전에는 Chrome 이 막을 수 있다 — 첫 클릭·키 입력 때 한 번만 요청한다 */
  if (!hasGesture()) { waitingGesture = true; return; }
  launched = true;
  waitingGesture = false;
  forgetTools();
  try {
    /* 설치돼 있으면 Windows 가 PM Connect 를 켠다. 없으면 아무 일도 없다 */
    window.location.href = 'pmconnect://start';
  } catch {
    /* 막혀도 PageMaker 는 그대로 쓴다 */
  }
}

async function beat(): Promise<void> {
  if (!wasSeenBefore()) return; /* 처음 온 사람에게는 아무 요청도 보내지 않는다 */
  const s = await toolsStatus();
  if (s.state !== 'stopped' && s.state !== 'not-installed') { connected = true; return; }
  if (s.state === 'stopped') launch();
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

  /* 사용자 동작이 없어 미뤄둔 요청만 첫 클릭·키 입력 때 한 번 보낸다 */
  const onGesture = () => {
    if (!waitingGesture) return;
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    launch();
  };
  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('keydown', onGesture, true);

  /* 다른 탭에 있다가 돌아오면 바로 한 번 확인한다 (켜기 요청은 위 규칙대로 한 번뿐) */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void beat();
  });
}
