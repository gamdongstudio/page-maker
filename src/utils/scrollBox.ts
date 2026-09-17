/**
 * 이 요소를 실제로 스크롤하는 상자를 찾는다.
 *
 * 오른쪽 편집도구는 바깥 칸(.split__right)이 스크롤된다.
 * 안쪽 상자를 맨 위로 올려봐야 아무 일도 일어나지 않는다.
 * (예전에 그래서 단계를 옮겨도 아래쪽이 보여 빈 화면처럼 보였다)
 */
export function scrollBoxOf(el: HTMLElement | null): HTMLElement | Window {
  let cur = el?.parentElement ?? null;
  while (cur) {
    const oy = getComputedStyle(cur).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight + 1) return cur;
    cur = cur.parentElement;
  }
  return window;
}

/** 맨 위로 */
export function scrollToTop(el: HTMLElement | null): void {
  const box = scrollBoxOf(el);
  if (box === window) window.scrollTo({ top: 0 });
  else (box as HTMLElement).scrollTop = 0;
}

/** 이 요소가 화면 위쪽으로 지나가 있으면 보이는 자리로 */
export function revealTop(el: HTMLElement | null, offset = 70): void {
  if (!el) return;
  const box = scrollBoxOf(el);
  if (box === window) {
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y) });
    return;
  }
  const b = box as HTMLElement;
  const y = el.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - offset;
  if (b.scrollTop > y) b.scrollTop = Math.max(0, y);
}
