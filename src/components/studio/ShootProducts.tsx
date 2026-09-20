import { useRef, useState } from 'react';
import type { ShootProduct } from '@/types/studio';
import { makeShootProduct, restoreDefaults } from '@/services/storage/studio';
import { Icon } from '@/components/ui/Icon';

/**
 * 촬영상품 고르기 + 관리.
 *
 * 이 목록은 **고정 카테고리가 아니다.**
 * 사장님마다 파는 것이 다르므로 자유롭게 넣고 빼고 순서를 바꿀 수 있다.
 */
interface Props {
  list: ShootProduct[];
  onChange: (next: ShootProduct[]) => void;
  picked: string;
  onPick: (name: string) => void;
}

export function ShootProducts({ list, onChange, picked, onPick }: Props) {
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState('');
  const dragId = useRef<string | null>(null);

  const visible = list.filter((p) => !p.hidden);

  const add = () => {
    const name = adding.trim();
    if (!name) return;
    onChange([...list, makeShootProduct(name)]);
    onPick(name);
    setAdding('');
  };

  const patch = (id: string, part: Partial<ShootProduct>) =>
    onChange(list.map((p) => (p.id === id ? { ...p, ...part } : p)));

  const remove = (id: string) => onChange(list.filter((p) => p.id !== id));

  const duplicate = (id: string) => {
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) return;
    const copy = makeShootProduct(list[i].name + ' 복사');
    onChange([...list.slice(0, i + 1), copy, ...list.slice(i + 1)]);
  };

  const move = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = list.findIndex((p) => p.id === fromId);
    const to = list.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="shoot">
      <div className="shoot__chips">
        {visible.map((p) => {
          const on = picked === p.name;
          return (
            <button
              key={p.id}
              className={'chip' + (on ? ' is-on' : '')}
              onClick={() => onPick(p.name)}
              aria-pressed={on}
            >
              {/* 색만으로 고른 것을 알리지 않는다 — 체크 표시를 같이 보여준다 */}
              {on && <Icon name="check" size={13} />}
              {p.name}
            </button>
          );
        })}
      </div>

      {/* 위 목록에서 실제로 고른 것이 있을 때만 알린다 (고른 칩이 없는데 이름만 뜨면 헷갈린다) */}
      {visible.some((p) => p.name === picked) && (
        <p className="shoot__now">지금 편집 중 · <b>{picked}</b></p>
      )}

      <div className="shoot__addrow">
        <input
          className="field__input"
          value={adding}
          placeholder="+ 촬영상품 추가 (예: 웨딩사진, 돌사진, 여권사진)"
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button className="btn btn--line" onClick={add}>추가</button>
      </div>

      <button className="more__btn" onClick={() => setManaging((v) => !v)}>
        {managing ? '촬영상품 정리 닫기' : '촬영상품 정리하기 (이름·순서·숨기기)'}
      </button>

      {managing && (
        <div className="shoot__manage">
          {list.map((p) => (
            <div
              key={p.id}
              className={'shoot__row' + (p.hidden ? ' is-hidden' : '')}
              draggable
              onDragStart={() => { dragId.current = p.id; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId.current) move(dragId.current, p.id); dragId.current = null; }}
            >
              <span className="shoot__grip" aria-hidden>⋮⋮</span>
              <input
                className="mini mini--text"
                value={p.name}
                onChange={(e) => patch(p.id, { name: e.target.value })}
              />
              <button className="tiny" onClick={() => duplicate(p.id)}>복제</button>
              <button className="tiny" onClick={() => patch(p.id, { hidden: !p.hidden })}>
                {p.hidden ? '보이기' : '숨기기'}
              </button>
              <button className="tiny tiny--danger" onClick={() => remove(p.id)}>삭제</button>
            </div>
          ))}
          <button className="btn btn--line wide" onClick={() => onChange(restoreDefaults(list))}>
            기본 촬영상품 되살리기
          </button>
          <p className="field__hint">
            끌어서 순서를 바꿀 수 있어요. 지운 기본 상품은 되살리기로 다시 가져옵니다.
          </p>
        </div>
      )}
    </div>
  );
}
