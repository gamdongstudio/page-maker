import { useEffect, useRef } from 'react';

/**
 * 미리보기에서 **글자를 눌러 바로 고치는** 칸.
 *
 * 왜 이렇게 만들었나
 *   사진관 상세페이지는 사진·가격·문구가 많아서 오른쪽 입력칸만으로는
 *   "지금 고치는 게 화면 어디인지" 알기 어렵다. 보이는 곳을 직접 누르는 편이 빠르다.
 *
 * 지키는 것
 *  - 저장 이미지에는 들어가지 않는다 (`on` 이 꺼져 있으면 그냥 글자만 그린다)
 *  - Enter 또는 바깥을 누르면 저장한다. Esc 는 되돌린다.
 *  - 저장하면 곧바로 미리보기에 보이고, 자동저장·실행취소도 그대로 된다
 *    (값을 바꾸는 방법이 오른쪽 입력칸과 **똑같기** 때문이다)
 */

interface Props {
  /** 지금 글자 (저장되는 값) */
  value: string;
  /** 화면에 보여줄 글자 — 없으면 value 그대로 (가격을 150,000원 처럼 보여줄 때 쓴다) */
  display?: string;
  /** 비었을 때 흐리게 보여줄 안내 */
  placeholder?: string;
  /** 고쳤을 때 */
  onSave: (v: string) => void;
  /** 편집할 수 있는 상태인지 (저장 이미지에서는 false) */
  on?: boolean;
  /** 여러 줄인지 */
  multiline?: boolean;
  /** 숫자만 받을지 (가격) */
  numeric?: boolean;
  style?: React.CSSProperties;
  className?: string;
  /** 어떤 태그로 그릴지 */
  as?: 'span' | 'p' | 'h1' | 'h2' | 'b' | 'div';
  /** 마우스를 올렸을 때 보여줄 말 */
  title?: string;
}

export function Editable({
  value, display, placeholder, onSave, on = false, multiline = false, numeric = false,
  style, className, as: Tag = 'span', title,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const editing = useRef(false);

  /* 고치는 중에는 글자를 덮어쓰지 않는다 (커서가 맨 앞으로 튀는 것을 막는다) */
  useEffect(() => {
    const el = ref.current;
    if (!el || editing.current) return;
    const shown = display ?? value;
    if (el.innerText !== shown) el.innerText = shown;
  }, [value, display]);

  if (!on) {
    return (
      <Tag className={className} style={style}>
        {display ?? value}
      </Tag>
    );
  }

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    editing.current = false;
    let next = (el.innerText ?? '').replace(/[\u00a0]/g, ' ');
    if (!multiline) next = next.replace(/\s*\n+\s*/g, ' ');
    if (numeric) next = next.replace(/[^\d]/g, '');
    next = next.trim();
    if (next !== value) onSave(next);
    else el.innerText = display ?? value;   /* 달라진 게 없으면 원래 글자로 되돌린다 */
  };

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={'ed' + ((display ?? value) ? '' : ' ed--empty') + (className ? ' ' + className : '')}
      style={style}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      spellCheck={false}
      data-ph={placeholder ?? ''}
      title={title ?? '눌러서 고칠 수 있어요'}
      /* 섹션 전체를 누른 것으로 오해하지 않게 여기서 멈춘다 */
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      onFocus={() => { editing.current = true; }}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        if (e.key === 'Escape') {
          editing.current = false;
          if (ref.current) ref.current.innerText = display ?? value;
          (e.target as HTMLElement).blur();
        }
      }}
    >
      {display ?? value}
    </Tag>
  );
}
