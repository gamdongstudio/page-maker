import { useEffect, useRef, useState } from 'react';
import { ContentFields } from '@/components/prepare/ContentFields';
import { PhotoLibrary } from '@/components/media/PhotoLibrary';
import { StepMenus } from '@/components/menus/StepMenus';
import { StepDesign } from '@/components/design/StepDesign';
import { ChatGptPolish } from '@/components/recommend/ChatGptPolish';
import { type EditTab } from '@/components/flow/steps';
import { revealTop } from '@/utils/scrollBox';
import { PageCheck } from './PageCheck';

/**
 * ③ 보면서 고치기
 *
 * 왼쪽 = 실시간 미리보기 (그대로)
 * 오른쪽 = 섹션 목록. 고치고 싶은 섹션 제목을 누르면 그 자리에서 글·사진·모양을 한 번에 고친다.
 *
 * 예전의 [내용] [사진] [구성] [디자인] 탭은 없앴다.
 * 전체에 걸친 것(전체 디자인 · 사진 보관함 · 전체 내용)은 목록 아래 작은 펼치기로 둔다.
 */
type Extra = 'design' | 'photos' | 'content';

const EXTRAS: { key: Extra; label: string }[] = [
  { key: 'design', label: '전체 디자인 (스타일·글씨체)' },
  { key: 'photos', label: '사진 보관함' },
  { key: 'content', label: '전체 내용 한 번에 보기' },
];

export function StepEdit({ onTab, focusMenuId, onFocused, onSelect }: {
  tab: EditTab;
  onTab: (t: EditTab) => void;
  focusMenuId?: string | null;
  onFocused?: () => void;
  onSelect?: (id: string | null) => void;
}) {
  const [extra, setExtra] = useState<Extra | null>(null);
  const extraRef = useRef<HTMLDivElement>(null);

  /* 미리보기에서 영역을 누르면 섹션 목록이 그 섹션을 연다 (예전 탭 전환 신호는 섹션 목록으로 모은다) */
  useEffect(() => { if (focusMenuId) onTab('menus'); }, [focusMenuId, onTab]);

  /* 상세페이지 점검의 [고치러 가기] — 섹션 목록이면 그대로, 나머지는 해당 펼치기를 연다 */
  const go = (t: EditTab) => {
    if (t === 'menus') return;
    setExtra(t as Extra);
    window.setTimeout(() => revealTop(extraRef.current), 30);
  };

  return (
    <div className="stack edit">
      <PageCheck onGo={go} />

      <p className="field__hint">고치고 싶은 섹션 제목을 누르세요.</p>
      <StepMenus focusMenuId={focusMenuId} onFocused={onFocused} onSelect={onSelect} />

      <div className="stack" ref={extraRef}>
        {EXTRAS.map((x) => (
          <div key={x.key}>
            <button className="linkbtn" onClick={() => setExtra((v) => (v === x.key ? null : x.key))} aria-expanded={extra === x.key}>
              {extra === x.key ? '▴ ' : '▾ '}{x.label}
            </button>
            {extra === x.key && (
              <div className="box" style={{ marginTop: 6 }}>
                {x.key === 'design' && <StepDesign />}
                {x.key === 'photos' && <PhotoLibrary />}
                {x.key === 'content' && (
                  <>
                    <ContentFields mode="edit" />
                    <ChatGptPolish />
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
