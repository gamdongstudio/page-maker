import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SMARTSTORE_DETAIL_WIDTH } from '@/config/smartstore';
import type { ProjectData } from '@/types/project';
import { DetailPage } from '@/components/preview/DetailPage';

/**
 * 긴 상세페이지 **전체**를 보는 창.
 *
 * 작은 썸네일이 아니라 실제 결과와 같은 모양을 처음부터 끝까지 스크롤해서 본다.
 * 저장 전 최종 미리보기와 완성 예시가 같이 쓴다.
 * (편집용 표시는 그리지 않는다 — 저장 이미지와 같은 모습)
 */
export function PageViewer({ project, title, onClose, top, footer }: {
  project: ProjectData;
  title: string;
  onClose: () => void;
  /** 제목 아래 (예시 고르기 등) */
  top?: ReactNode;
  /** 아래 고정 단추 */
  footer?: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [h, setH] = useState(0);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 24) / SMARTSTORE_DETAIL_WIDTH));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const measure = () => setH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project]);

  /* 처음부터 보이게 */
  useEffect(() => { boxRef.current?.scrollTo({ top: 0 }); }, [project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="viewer" role="dialog" aria-label={title}>
      <div className="viewer__panel">
        <header className="viewer__head">
          <b>{title}</b>
          <button className="btn btn--line" onClick={onClose}>닫기</button>
        </header>
        {top && <div className="viewer__top">{top}</div>}
        <div className="viewer__scroll" ref={boxRef}>
          <div className="viewer__stage" style={{ height: h * scale }}>
            <div
              ref={pageRef}
              style={{ width: SMARTSTORE_DETAIL_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top center' }}
            >
              <DetailPage project={project} />
            </div>
          </div>
        </div>
        {footer && <footer className="viewer__foot">{footer}</footer>}
      </div>
    </div>
  );
}
