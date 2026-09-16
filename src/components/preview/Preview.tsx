import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MOBILE_PREVIEW_WIDTH, SMARTSTORE_DETAIL_WIDTH } from '@/config/smartstore';
import { useProject } from '@/store/ProjectStore';
import { DetailPage } from './DetailPage';
import type { PreviewEdit } from './editApi';

export type PreviewMode = 'pc' | 'mobile';

interface Props {
  /** 미리보기에서 바로 고칠 때 쓰는 고리 */
  edit?: PreviewEdit;
}

/**
 * 미리보기 틀.
 * 상세페이지 본체는 실제 폭(860px 또는 390px)으로 그리고,
 * 화면에 맞게 배율만 줄여서 보여준다. (구조는 결과물과 동일)
 */
export function Preview({ edit }: Props) {
  const { project } = useProject();
  const [mode, setMode] = useState<PreviewMode>('pc');
  const [full, setFull] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);

  const pageWidth = mode === 'pc' ? SMARTSTORE_DETAIL_WIDTH : MOBILE_PREVIEW_WIDTH;

  /* 보이는 폭에 맞게 배율 계산 */
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => {
      const avail = el.clientWidth - 32;
      setScale(Math.min(1, avail / pageWidth));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageWidth]);

  /* 배율을 적용한 실제 높이를 알아야 스크롤이 정상 동작한다 */
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const measure = () => setInnerH(el.getBoundingClientRect().height / (scale || 1));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale, project]);

  /* 전체화면일 때 ESC 로 닫기 */
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const body = (
    <div className="preview__scroll" ref={boxRef}>
      <div className="preview__stage" style={{ height: innerH * scale }}>
        <div
          className="preview__page"
          ref={pageRef}
          style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: pageWidth }}
        >
          <DetailPage project={project} narrow={mode === 'mobile'} edit={edit} />
        </div>
      </div>
    </div>
  );

  return (
    <section className={'preview' + (full ? ' preview--full' : '')}>
      <header className="preview__bar">
        <div className="seg">
          <button className={'seg__btn' + (mode === 'pc' ? ' is-on' : '')} onClick={() => setMode('pc')}>PC</button>
          <button className={'seg__btn' + (mode === 'mobile' ? ' is-on' : '')} onClick={() => setMode('mobile')}>모바일</button>
        </div>
        <span className="preview__size">
          {mode === 'pc' ? `${SMARTSTORE_DETAIL_WIDTH}px 기준` : '모바일 화면'}
          {scale < 0.999 && ` · ${Math.round(scale * 100)}%로 보는 중`}
        </span>
        <button className="btn btn--quiet" onClick={() => setFull((v) => !v)}>
          {full ? '닫기' : '전체화면'}
        </button>
      </header>
      {body}
    </section>
  );
}
