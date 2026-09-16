/**
 * 선으로 그린 아이콘 한 벌.
 *
 * 왜 직접 두는가
 *   화면 곳곳에 컬러 이모지(✨ 📋 🖼 …)를 쓰고 있었다.
 *   친근해 보이지만 상용 제작도구처럼 보이지 않고, 컴퓨터마다 모양도 달라진다.
 *   그래서 **크기와 선 굵기가 같은** 선 아이콘으로 통일한다.
 *
 *   바깥 아이콘 꾸러미를 받아 쓰지 않는다.
 *   인터넷이 없어도 켜져야 하고, 설치 과정이 늘어나면 안 되기 때문이다.
 *
 * 색은 여기서 정하지 않는다. 글자색(currentColor)을 따라가므로
 * 쓰는 쪽에서 CSS 로만 정한다. (선택된 것만 파란색 — 아이콘마다 다른 색을 쓰지 않는다)
 */

export type IconName =
  | 'wand' | 'pen' | 'fileText' | 'image' | 'grid' | 'palette'
  | 'message' | 'folder' | 'checkCircle' | 'check'
  | 'undo' | 'redo' | 'download' | 'more' | 'link' | 'clipboard'
  | 'plus' | 'close' | 'chevronDown' | 'alert' | 'sparkle' | 'text';

interface Props {
  name: IconName;
  /** 한 변 크기 (기본 18) */
  size?: number;
  className?: string;
}

/** 아이콘마다 그리는 선 (24 × 24 기준) */
const PATHS: Record<IconName, JSX.Element> = {
  /* 자동입력 — 요술봉 */
  wand: (
    <>
      <path d="M15 4V2M15 10V8M12 6h2M18 6h2M17.5 8.5 19 10M17.5 3.5 19 2M12.5 3.5 11 2" />
      <path d="m3 21 9-9 2 2-9 9z" />
      <path d="m12 12 2 2" />
    </>
  ),
  /* 직접입력 — 펜 */
  pen: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  /* 상품정보 — 문서 */
  fileText: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  /* 사진 */
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m3 17 5-4 4 3 3-2 6 5" />
    </>
  ),
  /* 구성 — 칸 배치 */
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  /* 디자인 — 팔레트 */
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c.8 0 1.4-.6 1.4-1.4 0-.4-.1-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.6-1.4 1.4-1.4H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8z" />
      <circle cx="7.5" cy="11.5" r="1" />
      <circle cx="10.5" cy="7.5" r="1" />
      <circle cx="15.5" cy="8.5" r="1" />
    </>
  ),
  /* PROMPTER — 말풍선 */
  message: (
    <>
      <path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8z" />
      <path d="M8.5 10h9M8.5 14h6" />
    </>
  ),
  /* 내 작업 — 폴더 */
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  /* 완성 */
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  check: <path d="m5 13 4 4 10-11" />,
  undo: (
    <>
      <path d="M4 10h11a5 5 0 0 1 0 10h-5" />
      <path d="m8 6-4 4 4 4" />
    </>
  ),
  redo: (
    <>
      <path d="M20 10H9a5 5 0 0 0 0 10h5" />
      <path d="m16 6 4 4-4 4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7.5 11 4.5 4.5 4.5-4.5" />
      <path d="M4 20h16" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18.5" cy="12" r="1.3" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.4 1.4" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 0 0 5.7 5.7l1.4-1.4" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  alert: (
    <>
      <path d="M12 4.5 2.5 20h19z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  text: <path d="M4 6h16M4 12h10M4 18h13" />,
};

export function Icon({ name, size = 18, className }: Props) {
  return (
    <svg
      className={'ic' + (className ? ' ' + className : '')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
