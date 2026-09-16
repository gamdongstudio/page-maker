import { LITE_MENU_KINDS, MENU_CATALOG } from '@/types/defaults';
import { useEdition } from '@/store/EditionContext';
import type { MenuKind } from '@/types/project';

/**
 * 미리보기에서 `+ 여기에 넣기` 를 눌렀을 때 뜨는 고르기 창.
 *
 * 이미 있는 메뉴 목록(`MENU_CATALOG`)을 그대로 쓴다.
 * 오른쪽 `구성` 의 `+ 메뉴 추가` 와 **같은 것**이고, 넣는 자리만 다르다.
 */
export function AddMenuHere({ onPick, onClose }: {
  onPick: (kind: MenuKind) => void;
  onClose: () => void;
}) {
  const { isPro } = useEdition();
  const list = isPro
    ? MENU_CATALOG
    : MENU_CATALOG.filter((c) => LITE_MENU_KINDS.includes(c.kind));

  return (
    <div className="pickwrap" role="dialog" aria-label="메뉴 넣기">
      <div className="pickwrap__mask" onClick={onClose} />
      <div className="pickwrap__box">
        <header>
          <b>여기에 무엇을 넣을까요?</b>
          <button className="tiny" onClick={onClose}>닫기</button>
        </header>
        <div className="picker">
          {list.map((c) => (
            <button key={c.kind} className="picker__item" onClick={() => onPick(c.kind)}>
              {c.title}
            </button>
          ))}
        </div>
        <p className="field__hint">
          넣은 뒤에도 순서를 끌어서 바꾸거나 숨길 수 있습니다.
        </p>
      </div>
    </div>
  );
}
