import type { ReactNode } from 'react';

/**
 * 입력 부품.
 *
 * 예전 StepCard 안에 있던 것을 따로 뺐다.
 * (카드형 단계가 아이콘 메뉴로 바뀌면서 카드 자체는 더 이상 쓰지 않는다)
 */

export function Field({
  label, value, onChange, placeholder, multiline, rows = 3, hint, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {multiline ? (
        <textarea
          className="field__input"
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="field__input"
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

/** 접었다 폈다 하는 묶음 — 한 번에 필요한 것만 보이게 */
export function MoreBox({
  open, onToggle, children, label = '추가정보',
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="more">
      <button className="more__btn" onClick={onToggle}>
        {open ? `${label} 접기` : `${label} 더보기`}
      </button>
      {open && <div className="more__body">{children}</div>}
    </div>
  );
}
