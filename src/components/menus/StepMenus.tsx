import { useEffect, useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { LITE_MENU_KINDS, MENU_CATALOG, makeMenu, uid } from '@/types/defaults';
import { useEdition } from '@/store/EditionContext';
import type { MenuKind } from '@/types/project';
import { isDropped } from '@/components/preview/sectionContent';
import { SectionTools } from './SectionTools';
import { templateLabel } from '@/components/preview/templates';
import { hasContent } from '@/components/preview/sectionContent';

/** ③ 메뉴 구성 — 화면에서 '블록' 이라는 말은 쓰지 않는다 */
export function StepMenus({ focusMenuId, onFocused, onSelect }: {
  focusMenuId?: string | null;
  onFocused?: () => void;
  /** 연 카드 — 비어 있는 영역도 미리보기에 보이게 알려준다 */
  onSelect?: (id: string | null) => void;
}) {
  const { project, update } = useProject();
  const { isPro } = useEdition();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  /* 카드를 열면 그 영역을 골라둔다 — 비어 있어도 미리보기에서 채울 수 있게 보인다 */
  /* 처음 열릴 때는 건드리지 않는다 — 미리보기에서 고른 영역이 풀리지 않게 */
  const opened = useRef(false);
  useEffect(() => {
    if (!opened.current) { opened.current = true; return; }
    onSelect?.(editId);
  }, [editId, onSelect]);

  /*
   * 미리보기에서 섹션을 누르면 그 카드를 연다.
   * 여는 것까지만 하고 표시는 바로 비운다 — 그래야 [닫기]가 늘 먹히고,
   * 같은 섹션을 다시 눌러도 또 열린다. (예전에는 닫기를 눌러도 안 닫혔다)
   */
  useEffect(() => {
    if (!focusMenuId) return;
    setEditId(focusMenuId);
    onFocused?.();
    window.setTimeout(() => {
      document.querySelector(`[data-card-id="${focusMenuId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 60);
  }, [focusMenuId, onFocused]);

  const add = (kind: MenuKind) => {
    update((d) => { d.menus.push(makeMenu(kind)); }, { label: 'menu.add', merge: false });
    setAdding(false);
  };

  const patch = (id: string, part: Partial<{ title: string; body: string; hidden: boolean }>, label: string) =>
    update((d) => {
      const m = d.menus.find((x) => x.id === id);
      if (m) Object.assign(m, part);
    }, { label });

  const duplicate = (id: string) =>
    update((d) => {
      const i = d.menus.findIndex((m) => m.id === id);
      if (i < 0) return;
      const copy = {
        ...d.menus[i], id: uid('menu'), title: d.menus[i].title + ' 복사',
        photoIds: [...d.menus[i].photoIds], lines: [...d.menus[i].lines],
      };
      d.menus.splice(i + 1, 0, copy);
    }, { label: 'menu.dup', merge: false });

  const remove = (id: string) =>
    update((d) => { d.menus = d.menus.filter((m) => m.id !== id); }, { label: 'menu.del', merge: false });

  const move = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    update((d) => {
      const from = d.menus.findIndex((m) => m.id === fromId);
      const to = d.menus.findIndex((m) => m.id === toId);
      if (from < 0 || to < 0) return;
      const [moved] = d.menus.splice(from, 1);
      d.menus.splice(to, 0, moved);
    }, { label: 'menu.order', merge: false });
  };

  const used = new Set(project.menus.map((m) => m.kind));

  return (
    <div className="stack">
      {/* 링크로 가져온 글에서 가격이 여러 개 나왔다면 알려준다 */}
      <PriceSuggest />

      <button className="btn btn--main addmenu" onClick={() => setAdding((v) => !v)}>
        + 메뉴 추가
      </button>

      {adding && (
        <div className="picker">
          {(isPro ? MENU_CATALOG : MENU_CATALOG.filter((c) => LITE_MENU_KINDS.includes(c.kind))).map((c) => (
            <button
              key={c.kind}
              className={'picker__item' + (used.has(c.kind) ? ' is-used' : '')}
              onClick={() => add(c.kind)}
              title={used.has(c.kind) ? '이미 넣은 메뉴예요. 또 넣을 수도 있어요.' : ''}
            >
              {c.title}
            </button>
          ))}
          {!isPro && (
            <p className="picker__note">메뉴 종류를 더 쓰려면 PRO로 보기를 눌러주세요.</p>
          )}
        </div>
      )}

      <div className="menus">
        {project.menus.filter((m) => !isDropped(m)).map((m, i) => {
          const open = editId === m.id;
          return (
            <div
              key={m.id}
              className={'menu' + (m.hidden ? ' is-hidden' : '') + (open ? ' is-open' : '')}
              data-card-id={m.id}
              draggable
              onDragStart={() => { dragId.current = m.id; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId.current) move(dragId.current, m.id); dragId.current = null; }}
            >
              {/* 제목 줄 전체를 누르면 열고, 다시 누르면 닫는다. 다른 메뉴를 열면 이전 메뉴는 닫힌다 (한 번에 하나) */}
              <div
                className="menu__head"
                role="button"
                tabIndex={0}
                aria-expanded={open}
                style={{ cursor: 'pointer' }}
                onClick={() => setEditId(open ? null : m.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                  e.preventDefault();
                  setEditId(open ? null : m.id);
                }}
              >
                <span className="menu__grip" title="끌어서 순서를 바꿀 수 있어요">⠿</span>
                <span className="menu__no">{i + 1}</span>
                <span className="menu__title">
                  {m.title}
                  {templateLabel(m.kind, m.template) && <em className="menu__tpl">{templateLabel(m.kind, m.template)}</em>}
                  {!hasContent(m, project) && <em className="menu__empty">비어 있음</em>}
                  {m.hidden && <em className="menu__empty">숨김</em>}
                </span>
                <span aria-hidden="true" style={{ opacity: .5, padding: '0 4px' }}>{open ? '▴' : '▾'}</span>
                <div className="menu__acts" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <button className="tiny" onClick={() => duplicate(m.id)}>복제</button>
                  <button className="tiny" onClick={() => patch(m.id, { hidden: !m.hidden }, 'menu.hide')}>
                    {m.hidden ? '보이기' : '숨기기'}
                  </button>
                  <button className="tiny tiny--danger" onClick={() => remove(m.id)}>삭제</button>
                </div>
              </div>

              {open && <SectionTools menu={m} />}

            </div>
          );
        })}
      </div>

      {project.menus.length === 0 && <p className="note">메뉴를 추가하면 상세페이지가 만들어집니다.</p>}

      {/* 말로 구성을 고치는 기능은 아직 없다. 눌리지 않는 단추 모양을 보여주지 않는다. */}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * 링크로 가져온 글에 **가격이 여러 개** 있었다면 가격표로 만들어 드릴지 여쭤본다.
 *
 * 새로 읽어오는 것이 아니라 이미 가져다 둔 값(`pricing.etcExtra`)만 본다.
 * 넘겨짚지 않고, 누르셨을 때만 만든다.
 */
function PriceSuggest() {
  const { project, update } = useProject();
  const [done, setDone] = useState(false);

  /* 금액이 들어 있는 줄만 센다 */
  const found = (project.pricing?.etcExtra ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /\d/.test(s) && /(원|만원)/.test(s));

  const already = project.menus.some((m) => m.kind === 'compare');
  if (done || already || found.length < 2) return null;

  const make = () => {
    update((d) => {
      d.packages = [
        ...(d.packages ?? []),
        ...found.slice(0, 6).map((line) => {
          /* '평일 한컨셉 60,000원' → 이름과 가격으로 나눈다 */
          const m = line.match(/([\d,]+)\s*(?:만)?\s*원/);
          const price = m ? m[1].replace(/,/g, '') + (line.includes('만원') ? '0000' : '') : '';
          const name = line.replace(/[\d,]+\s*(?:만)?\s*원.*$/, '').replace(/[:·\-|]\s*$/, '').trim();
          return { id: uid('pkg'), name: name || '촬영상품', price, note: '', includes: '', photoId: '' };
        }),
      ];
      d.menus.push(makeMenu('compare'));
    }, { label: 'pkg.fromRead', merge: false });
    setDone(true);
  };

  return (
    <div className="suggest">
      <b>가격이 {found.length}개 나왔습니다.</b>
      <span>가격표(상품 비교)로 만들어 드릴까요? 만든 뒤에도 얼마든지 고칠 수 있어요.</span>
      <div className="suggest__acts">
        <button className="btn btn--main" onClick={make}>가격표로 만들기</button>
        <button className="btn btn--line" onClick={() => setDone(true)}>괜찮아요</button>
      </div>
    </div>
  );
}
