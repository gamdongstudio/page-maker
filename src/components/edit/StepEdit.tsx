import { useEffect, useRef, useState, useTransition } from 'react';
import { ContentFields } from '@/components/prepare/ContentFields';
import { PhotoLibrary } from '@/components/media/PhotoLibrary';
import { StepMenus } from '@/components/menus/StepMenus';
import { StepDesign } from '@/components/design/StepDesign';
import { ChatGptPolish } from '@/components/recommend/ChatGptPolish';
import { EDIT_TABS, type EditTab } from '@/components/flow/steps';
import { revealTop } from '@/utils/scrollBox';
import { PageCheck } from './PageCheck';

/**
 * ③ 보면서 고치기
 *
 * 왼쪽 = 실시간 미리보기 (그대로)
 * 오른쪽 = [내용] [사진] [구성] [디자인]
 *
 * 오른쪽에서 고치면 왼쪽이 바로 바뀐다. 둘 다 같은 작업 내용을 본다.
 *
 * 탭을 누르면 **누른 탭이 곧바로 켜진다.**
 * 사진이 많아 내용을 그리는 데 시간이 걸리면 빈 칸 대신 '불러오는 중…' 을 보여준다.
 */
export function StepEdit({ tab, onTab, focusMenuId, onFocused, onSelect }: {
  tab: EditTab;
  onTab: (t: EditTab) => void;
  focusMenuId?: string | null;
  onFocused?: () => void;
  onSelect?: (id: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  /** 누른 탭 — 내용보다 먼저 켜 보인다 */
  const [picked, setPicked] = useState<EditTab>(tab);
  const tabsRef = useRef<HTMLDivElement>(null);

  /* 미리보기에서 영역을 눌러 탭이 바뀐 경우도 맞춘다 */
  useEffect(() => { setPicked(tab); }, [tab]);

  const go = (t: EditTab) => {
    setPicked(t);
    /* 아래로 내려가 있었다면 탭이 보이는 자리로 — 새 내용의 시작이 보이게 */
    revealTop(tabsRef.current);
    startTransition(() => onTab(t));
  };

  const loading = pending || picked !== tab;

  return (
    <div className="stack edit">
      <PageCheck onGo={go} />

      <div className="edittabs" role="tablist" aria-label="고칠 곳" ref={tabsRef}>
        {EDIT_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={picked === t.key}
            className={'edittab' + (picked === t.key ? ' is-on' : '')}
            onClick={() => go(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="edittab__body" role="tabpanel" aria-busy={loading}>
        {loading && <p className="edittab__loading" aria-live="polite">불러오는 중…</p>}
        <div className={loading ? 'edittab__stale' : undefined}>
          {tab === 'content' && (
            <>
              <p className="field__hint">
                영역마다 다른 글은 <b>[구성]</b>에서 그 영역을 열어 고치거나, 왼쪽 글자를 눌러 바로 고칠 수 있어요.
              </p>
              <ContentFields mode="edit" />
              <ChatGptPolish />
            </>
          )}
          {tab === 'photos' && <PhotoLibrary />}
          {tab === 'menus' && <StepMenus focusMenuId={focusMenuId} onFocused={onFocused} onSelect={onSelect} />}
          {tab === 'design' && <StepDesign />}
        </div>
      </div>
    </div>
  );
}
