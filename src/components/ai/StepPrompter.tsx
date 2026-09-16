import { useMemo, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import {
  buildPrompt, DEFAULT_INCLUDE, DEFAULT_TARGET, TARGET_DESC, TARGET_LABEL,
  type IncludeOpts, type PromptTarget,
} from '@/services/prompter/buildPrompt';

/**
 * ⑥ SAY PROMPTER
 *
 * 상세페이지를 직접 고치는 기능이 아니다.
 * 하고 싶은 말을 **다른 생성형 AI 에 그대로 넣을 수 있는 요청문**으로 정리해 준다.
 *
 * ⚠ AI 유형을 바꿔도 사용자가 적은 수정 요청은 절대 지우지 않는다.
 *   유형은 '어떻게 정리할지'만 정하고, 적은 글은 그대로 둔다.
 */
export function StepPrompter() {
  const { project } = useProject();
  const [wish, setWish] = useState('');
  const [target, setTarget] = useState<PromptTarget>(DEFAULT_TARGET);
  const [copied, setCopied] = useState(false);
  const [include, setInclude] = useState<IncludeOpts>(DEFAULT_INCLUDE);

  /* 유형이나 담을 내용이 바뀌면 요청문만 다시 만든다 (적은 글은 그대로) */
  const text = useMemo(
    () => buildPrompt(project, wish, target, include),
    [project, wish, target, include],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드를 못 쓰는 경우 직접 고르도록 둔다 */
      const el = document.getElementById('prompter-out') as HTMLTextAreaElement | null;
      el?.select();
    }
  };

  return (
    <div className="stack">
      <p className="note">
        원하는 수정 내용을 <b>다른 생성형 AI에서 사용할 수 있는 작업 요청문</b>으로 정리해드립니다.
        이 화면에서 상세페이지가 직접 바뀌지는 않습니다.
      </p>

      <label className="field">
        <span className="field__label">원하는 수정사항을 편하게 적어주세요.</span>
        <textarea
          className="field__input"
          rows={3}
          value={wish}
          placeholder="예) 사진을 크게 하고 전체적으로 더 고급스럽게 해줘."
          onChange={(e) => setWish(e.target.value)}
        />
      </label>

      <div className="field">
        <span className="field__label">사용할 AI 선택</span>
        <div className="seg seg--wide">
          {(Object.keys(TARGET_LABEL) as PromptTarget[]).map((t) => (
            <button
              key={t}
              className={'seg__btn' + (target === t ? ' is-on' : '')}
              onClick={() => setTarget(t)}
            >
              {target === t ? '✓ ' : ''}{TARGET_LABEL[t]}
            </button>
          ))}
        </div>
        <span className="field__hint">{TARGET_DESC[target]}</span>
        {target === 'basic' && (
          <span className="field__hint">어떤 AI를 사용하는지 모르겠다면 기본형을 선택하세요.</span>
        )}
      </div>

      <div className="field">
        <span className="field__label">요청문에 함께 담을 내용</span>
        <div className="incl">
          {([
            ['product', '상품정보'], ['design', '디자인'],
            ['menus', '상세페이지 구성'], ['photos', '사진 배치'],
          ] as [keyof IncludeOpts, string][]).map(([k, label]) => (
            <label key={k} className={'incl__item' + (include[k] ? ' is-on' : '')}>
              <input
                type="checkbox" checked={include[k]}
                onChange={(e) => setInclude({ ...include, [k]: e.target.checked })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <span className="field__hint">
          담아두면 "메인 사진 크게 해줘" 처럼 짧게 적어도 AI 가 지금 상태를 알고 답합니다.
        </span>
      </div>

      <label className="field">
        <span className="field__label">만들어진 요청문</span>
        <textarea id="prompter-out" className="field__input prompter" rows={12} readOnly value={text} />
      </label>

      <button className="btn btn--main wide" onClick={copy}>
        {copied ? '복사했어요 ✓' : '요청문 복사하기'}
      </button>
      {copied && <p className="note note--ok">복사했습니다. 쓰시는 AI에 붙여넣으세요.</p>}
    </div>
  );
}
