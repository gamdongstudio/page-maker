import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MOBILE_PREVIEW_WIDTH, SMARTSTORE_DETAIL_WIDTH } from '@/config/smartstore';
import { useProject } from '@/store/ProjectStore';
import { DetailPage } from './DetailPage';
import { shownMenus } from './sectionContent';
import type { PreviewEdit } from './editApi';

export type PreviewMode = 'pc' | 'mobile';

/**
 * 아직 보여줄 글·사진이 하나도 없을 때의 미리보기.
 * 빈 흰 화면이 "고장 난 화면" 처럼 보이지 않게, 연한 뼈대와 짧은 안내만 둔다.
 * (가짜 문구를 채워 넣지 않는다. 저장 이미지와는 상관없다)
 */
function StartGuide({ onExamples }: { onExamples?: () => void }) {
  return (
    <div className="startguide">
      <div className="startguide__msg">
        <p className="startguide__title">상세페이지 미리보기</p>
        <p className="startguide__text">오른쪽에서 자료를 입력하거나 가져오면<br />이곳에 상세페이지가 바로 만들어집니다.</p>
        <p className="startguide__steps">① 자료 준비 → ② 자동 추천 → ③ 보면서 고치기 → ④ 저장</p>
        {onExamples && <button type="button" className="btn btn--line" onClick={onExamples}>완성 예시 보기</button>}
      </div>
      <div className="startguide__sk" aria-hidden="true">
        <div className="sk sk--hero" />
        <div className="sk sk--line sk--w60" />
        <div className="sk sk--line sk--w40" />
        <div className="sk sk--block" />
        <div className="sk sk--line sk--w70" />
        <div className="sk sk--btn" />
      </div>
    </div>
  );
}

interface Props {
  /** 미리보기에서 바로 고칠 때 쓰는 고리 */
  edit?: PreviewEdit;
  /** 지금 고르고 있는 영역 — 테두리로 알려준다 */
  selectedId?: string | null;
  /** 완성 예시 보기 (시작 안내에서) */
  onExamples?: () => void;
}

/**
 * 미리보기 틀.
 * 상세페이지 본체는 실제 폭(860px 또는 390px)으로 그리고,
 * 화면에 맞게 배율만 줄여서 보여준다. (구조는 결과물과 동일)
 */
export function Preview({ edit, selectedId, onExamples }: Props) {
  const { project } = useProject();
  /* 보여줄 영역이 하나도 없으면 빈 흰 화면 대신 시작 안내 (글·사진을 넣으면 바로 사라진다) */
  const blank = shownMenus(project).length === 0;
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
          {blank
            ? <StartGuide onExamples={onExamples} />
            : <DetailPage project={project} narrow={mode === 'mobile'} edit={edit} selectedId={selectedId} />}
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
