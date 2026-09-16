import { useEffect, useState } from 'react';
import type { StudioPlan } from '@/services/ai/studioPlanner';
import type { ReadField } from '@/services/read/parseInfo';

/**
 * "이렇게 읽었습니다" 확인 화면.
 *
 * 가격 · 지역 · 상호 · 전화번호 · 혜택 · 추가비용처럼 **틀리면 안 되는 값**은
 * 프로그램이 마음대로 확정하지 않는다.
 *  - 찾은 것은 어디서 찾았는지 함께 보여준다
 *  - 못 찾은 것은 지어내지 않고 "확인 필요" 로 비워둔다
 *  - 사용자가 직접 고칠 수 있고, [확인하고 적용] 을 눌러야 실제로 반영된다
 */
interface Props {
  plan: StudioPlan;
  fields: ReadField[];
  onCancel: () => void;
  onApply: (fields: ReadField[], titleIndex: number, heroIndex: number) => void;
}

export function ReadCheck({ plan, fields, onCancel, onApply }: Props) {
  const [edited, setEdited] = useState<ReadField[]>(fields);
  const [titleIdx, setTitleIdx] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => { setEdited(fields); }, [fields]);

  const set = (key: string, value: string) =>
    setEdited((list) => list.map((f) => (f.key === key ? { ...f, value } : f)));

  const missing = edited.filter((f) => !f.value.trim());
  const multiline = new Set(['includes', 'extras', 'perks', 'concepts']);

  return (
    <div className="startmask">
      <div className="readbox">
        <h2 className="readbox__title">이렇게 읽었습니다</h2>
        <p className="plan__source">{plan.sourceLabel}</p>

        <h3 className="readbox__sub">확인하고 고쳐주세요</h3>
        <p className="plan__hint">
          비어 있는 칸은 <b>찾지 못한 것</b>입니다. 지어내지 않았습니다. 직접 넣어주세요.
        </p>

        <div className="readfields">
          {edited.map((f) => (
            <label key={f.key} className={'readfield' + (f.value.trim() ? '' : ' is-missing')}>
              <span className="readfield__label">
                {f.label}
                {!f.value.trim() && <em>확인 필요</em>}
              </span>
              {multiline.has(f.key) ? (
                <textarea
                  className="field__input" rows={2} value={f.value}
                  placeholder="한 줄에 하나씩"
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  className="field__input" value={f.value}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
              <span className="readfield__from">{f.from}</span>
            </label>
          ))}
        </div>

        {plan.needsCheck.length > 0 && (
          <ul className="readbox__notes">
            {plan.needsCheck.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}

        {/* 제목과 카피 */}
        <h3 className="readbox__sub">검색용 상품 제목</h3>
        <p className="plan__hint">상품 목록·검색에서 보이는 제목입니다.</p>
        {plan.searchTitles.map((t, i) => (
          <label key={i} className="opt">
            <input type="radio" name="sttitle" checked={titleIdx === i} onChange={() => setTitleIdx(i)} />
            <span>{t}</span>
          </label>
        ))}

        <h3 className="readbox__sub">상세페이지 대문 카피</h3>
        <p className="plan__hint">맨 위에 크게 보이는 문구입니다. 검색용 제목과 역할이 다릅니다.</p>
        {plan.heroCopy.map((t, i) => (
          <label key={i} className="opt">
            <input type="radio" name="sthero" checked={heroIdx === i} onChange={() => setHeroIdx(i)} />
            <span>{t}</span>
          </label>
        ))}

        {/* 구성 */}
        <h3 className="readbox__sub">상세페이지 구성</h3>
        <ol className="readbox__menus">
          {plan.menus.filter((m) => !m.hidden).map((m, i) => (
            <li key={i}>
              {m.title}
              {m.photoIds.length > 0 && <em> 사진 {m.photoIds.length}장</em>}
            </li>
          ))}
        </ol>

        {plan.hiddenTitles.length > 0 && (
          <p className="field__hint">
            내용을 찾지 못해 <b>{plan.hiddenTitles.join(' · ')}</b> 은(는) 숨겨뒀습니다.
            내용을 넣으면 바로 보입니다. (없는 내용을 지어내지 않았습니다)
          </p>
        )}
        {plan.draftTitles.length > 0 && (
          <p className="field__hint">
            <b>{plan.draftTitles.join(' · ')}</b> 은(는) 일반적인 내용으로 채워뒀습니다.
            사진관에 맞게 고쳐주세요.
          </p>
        )}

        <div className="readbox__acts">
          <button className="btn btn--main" onClick={() => onApply(edited, titleIdx, heroIdx)}>
            확인하고 적용
          </button>
          <button className="btn btn--line" onClick={onCancel}>다시 고르기</button>
        </div>
        {missing.length > 0 && (
          <p className="field__hint center">
            비워두고 적용해도 됩니다. 그 부분은 나중에 채우실 수 있어요.
          </p>
        )}
      </div>
    </div>
  );
}
