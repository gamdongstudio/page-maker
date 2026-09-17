import { ContentFields } from '@/components/prepare/ContentFields';
import { PhotoLibrary } from '@/components/media/PhotoLibrary';
import { StepMenus } from '@/components/menus/StepMenus';
import { StepDesign } from '@/components/design/StepDesign';
import { EDIT_TABS, type EditTab } from '@/components/flow/steps';
import { PageCheck } from './PageCheck';

/**
 * ③ 보면서 고치기
 *
 * 왼쪽 = 실시간 미리보기 (그대로)
 * 오른쪽 = [내용] [사진] [구성] [디자인]
 *
 * 오른쪽에서 고치면 왼쪽이 바로 바뀐다. 둘 다 같은 작업 내용을 본다.
 */
export function StepEdit({ tab, onTab, focusMenuId, onFocused }: {
  tab: EditTab;
  onTab: (t: EditTab) => void;
  focusMenuId?: string | null;
  onFocused?: () => void;
}) {
  return (
    <div className="stack edit">
      <PageCheck onGo={onTab} />

      <div className="edittabs" role="tablist" aria-label="고칠 곳">
        {EDIT_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={'edittab' + (tab === t.key ? ' is-on' : '')}
            onClick={() => onTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="edittab__body" role="tabpanel">
        {tab === 'content' && (
          <>
            <p className="field__hint">
              영역마다 다른 글은 <b>[구성]</b>에서 그 영역을 열어 고치거나, 왼쪽 글자를 눌러 바로 고칠 수 있어요.
            </p>
            <ContentFields mode="edit" />
          </>
        )}
        {tab === 'photos' && <PhotoLibrary />}
        {tab === 'menus' && <StepMenus focusMenuId={focusMenuId} onFocused={onFocused} />}
        {tab === 'design' && <StepDesign />}
      </div>
    </div>
  );
}
