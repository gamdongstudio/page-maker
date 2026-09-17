import { useEffect, useRef } from 'react';
import { StepWorks } from '@/components/works/StepWorks';
import { StepBar, StepLead, StepNav } from '@/components/flow/StepBar';
import type { EditTab, FlowStep } from '@/components/flow/steps';
import { StepPrepare } from '@/components/prepare/StepPrepare';
import { StepRecommend } from '@/components/recommend/StepRecommend';
import { StepEdit } from '@/components/edit/StepEdit';
import { StepSave } from '@/components/save/StepSave';
import { useEdition } from '@/store/EditionContext';

/**
 * 오른쪽 제작도구.
 *
 * 큰 흐름은 네 단계만 보인다.
 *   ① 자료 준비 → ② 자동 추천 → ③ 보면서 고치기 → ④ 저장
 *
 * '내 작업' 은 만드는 단계가 아니라 작업 관리라서 단계 줄에 넣지 않는다. (⋯ 메뉴에서 연다)
 * 단계를 오가도 작업 내용은 그대로다. (같은 저장소를 본다)
 */

export type PanelView = FlowStep | 'works';

interface Props {
  view: PanelView;
  onStep: (s: FlowStep) => void;
  /** 내 작업을 닫고 보던 단계로 */
  onCloseWorks: () => void;
  tab: EditTab;
  onTab: (t: EditTab) => void;
  focusMenuId?: string | null;
  onFocused?: () => void;
  getStage: () => HTMLElement | null;
  onNew: () => void;
}

export function EditorPanel({
  view, onStep, onCloseWorks, tab, onTab, focusMenuId, onFocused, getStage, onNew,
}: Props) {
  const { isPro } = useEdition();
  const boxRef = useRef<HTMLDivElement>(null);

  /* 단계를 옮기면 맨 위부터 보이게 */
  useEffect(() => {
    boxRef.current?.scrollTo({ top: 0 });
  }, [view]);

  if (view === 'works') {
    return (
      <div className="editor" ref={boxRef}>
        <header className="steplead">
          <h2 className="steplead__title">내 작업</h2>
          <p className="steplead__text">작업은 자동으로 저장되고 있습니다. 여기서는 이름을 붙여 따로 보관하고 다시 열 수 있어요.</p>
          <button className="linkbtn" onClick={onCloseWorks}>만들던 화면으로 돌아가기</button>
        </header>
        <StepWorks />
      </div>
    );
  }

  return (
    <div className="editor" ref={boxRef}>
      <StepBar now={view} onGo={onStep} />
      <StepLead step={view} />

      <div className="panelbody">
        {view === 'prepare' && (
          <>
            <StepPrepare />
            <StepNav step="prepare" onGo={onStep} />
          </>
        )}
        {view === 'recommend' && <StepRecommend onNext={() => onStep('edit')} />}
        {view === 'edit' && (
          <>
            <StepEdit tab={tab} onTab={onTab} focusMenuId={focusMenuId} onFocused={onFocused} />
            <StepNav step="edit" onGo={onStep} />
          </>
        )}
        {view === 'save' && (
          <>
            <StepSave getStage={getStage} onNew={onNew} />
            <StepNav step="save" onGo={onStep} />
          </>
        )}
      </div>

      {!isPro && (
        <p className="editor__note">
          간편 편집입니다. 여러 장 저장 등은 <b>⋯ 메뉴 → 상세 편집</b>에서 쓸 수 있어요.
        </p>
      )}
    </div>
  );
}
