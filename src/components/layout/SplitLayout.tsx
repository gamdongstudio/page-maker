import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * PC: 왼쪽 미리보기 / 오른쪽 제작도구 + 가운데 드래그 경계선
 * 모바일: 세로로 자연스럽게 배치 (2단 구조를 억지로 유지하지 않는다)
 */

const MIN_LEFT = 320;
const MIN_RIGHT = 340;
const KEY = 'saypagemaker.splitRatio';

interface Props {
  left: React.ReactNode;
  right: React.ReactNode;
  rightHidden: boolean;
  isMobile: boolean;
}

export function SplitLayout({ left, right, rightHidden, isMobile }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<number>(() => {
    const saved = Number(localStorage.getItem(KEY));
    return saved >= 0.2 && saved <= 0.85 ? saved : 0.56;
  });
  const dragging = useRef(false);

  const apply = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let leftPx = clientX - rect.left;
    leftPx = Math.max(MIN_LEFT, Math.min(rect.width - MIN_RIGHT, leftPx));
    const next = leftPx / rect.width;
    setRatio(next);
    localStorage.setItem(KEY, String(next));
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) apply(e.clientX); };
    const touch = (e: TouchEvent) => { if (dragging.current && e.touches[0]) apply(e.touches[0].clientX); };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', touch);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', touch);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [apply]);

  const start = () => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  if (isMobile) {
    return (
      <div className="split split--mobile">
        <div className="split__left">{left}</div>
        {!rightHidden && <div className="split__right">{right}</div>}
      </div>
    );
  }

  const leftStyle = rightHidden ? { width: '100%' } : { width: `${ratio * 100}%` };

  return (
    <div className="split" ref={wrapRef}>
      <div className="split__left" style={leftStyle}>{left}</div>
      {!rightHidden && (
        <>
          <div
            className="split__handle"
            onMouseDown={start}
            onTouchStart={start}
            role="separator"
            aria-orientation="vertical"
            aria-label="미리보기와 편집도구 크기 조절"
            title="드래그해서 크기를 조절하세요"
          >
            <span />
          </div>
          <div className="split__right">{right}</div>
        </>
      )}
    </div>
  );
}
