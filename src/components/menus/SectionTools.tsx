import { useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { PHOTO_KIND_LABEL, type FontKey, type MenuItem, type PricePackage } from '@/types/project';
import { FONT_KEYS, FONTS } from '@/config/fonts';
import { uid } from '@/types/defaults';
import { templatesFor } from '@/components/preview/templates';
import { planStudioPage } from '@/services/ai/studioPlanner';
import { regenerateMenu, type RegenPart } from '@/services/ai/applyPlan';

/**
 * 섹션 하나를 고치는 도구.
 *
 *   [글 수정] [사진 변경] [디자인 변경] [AI로 다시 만들기]
 *
 * 중요
 *  - **이 섹션만** 바뀐다. 다른 섹션은 건드리지 않는다.
 *  - 모양(디자인)을 바꿔도 글·사진·가격은 그대로 남는다.
 *  - 사진은 고르기만 한다. 얼굴을 바꾸는 기능은 없다.
 */

type Tab = 'text' | 'photo' | 'design' | 'ai';

const TABS: { key: Tab; label: string }[] = [
  { key: 'text', label: '글 수정' },
  { key: 'photo', label: '사진 변경' },
  { key: 'design', label: '디자인 변경' },
  { key: 'ai', label: '다시 만들기' },
];

/** 이 섹션이 가격표(여러 상품)를 쓰는지 */
function usesPackages(menu: MenuItem): boolean {
  return menu.kind === 'compare' || (menu.kind === 'price' && (menu.template ?? 'A') === 'E');
}

export function SectionTools({ menu }: { menu: MenuItem }) {
  const { project, update } = useProject();
  const [tab, setTab] = useState<Tab>('text');
  const [msg, setMsg] = useState('');
  const templates = templatesFor(menu.kind);

  const patch = (part: Partial<MenuItem>, label: string) =>
    update((d) => {
      const m = d.menus.find((x) => x.id === menu.id);
      if (m) Object.assign(m, part);
    }, { label });

  /**
   * 이 섹션만 다시 만든다.
   *
   * ⚠ 되는지 안 되는지는 **미리** 따져본다.
   *   상태를 바꾸는 함수 안에서 바깥 값을 읽으면 아직 실행되기 전이라 늘 틀린 값이 나온다.
   *   (예전에 실행취소가 안 되던 것과 같은 원인이라 이 방식을 지킨다)
   */
  const regen = (part: RegenPart, what: string) => {
    const plan = planStudioPage(project);
    const canDo = part === 'template' || plan.menus.some((p) => p.kind === menu.kind);

    if (!canDo) {
      setMsg('이 섹션은 아직 자동으로 만들 수 없어요. 직접 고쳐주세요.');
      window.setTimeout(() => setMsg(''), 4000);
      return;
    }

    update((d) => { regenerateMenu(d, menu.id, plan, part); }, { label: 'menu.regen', merge: false });
    setMsg(`${what} 다시 만들었습니다. 다른 섹션은 그대로입니다. (실행취소로 되돌리기)`);
    window.setTimeout(() => setMsg(''), 4000);
  };

  return (
    <div className="sect">
      <div className="sect__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'sect__tab' + (tab === t.key ? ' is-on' : '')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="note note--ok">{msg}</p>}

      {tab === 'text' && (
        <div className="stack">
          <input
            className="mini mini--text"
            value={menu.title}
            placeholder="섹션 제목"
            onChange={(e) => patch({ title: e.target.value }, 'menu.title.' + menu.id)}
          />
          <textarea
            className="mini mini--text"
            rows={3}
            value={menu.body}
            placeholder="이 섹션에 들어갈 내용을 적어주세요"
            onChange={(e) => patch({ body: e.target.value }, 'menu.body.' + menu.id)}
          />
          <label className="field">
            <span className="field__label">목록 (한 줄에 하나씩)</span>
            <textarea
              className="mini mini--text"
              rows={4}
              value={menu.lines.join('\n')}
              placeholder={'예)\n촬영 예약\n촬영\n사진 고르기'}
              onChange={(e) => patch(
                { lines: e.target.value.split('\n') },
                'menu.lines.' + menu.id,
              )}
            />
            <span className="field__hint">
              혜택은 <b>제목 | 설명</b> 처럼 적으면 두 줄로 나뉘어 보입니다.
            </span>
          </label>

          {/* 자유 영역은 버튼 문구도 직접 적을 수 있다 */}
          {menu.kind === 'free' && (
            <label className="field">
              <span className="field__label">버튼 문구 (비워두면 버튼이 안 나옵니다)</span>
              <input
                className="mini mini--text"
                value={menu.button ?? ''}
                placeholder="예) 지금 예약하기"
                onChange={(e) => patch({ button: e.target.value }, 'menu.button.' + menu.id)}
              />
            </label>
          )}

          {/* 가격표·상품 비교 — 촬영상품을 여러 개 만든다 */}
          {usesPackages(menu) && <PackageEditor />}
        </div>
      )}

      {tab === 'photo' && <MenuPhotos menuId={menu.id} />}

      {tab === 'design' && (
        <div className="stack">
          {templates.length === 0 ? (
            <p className="menu__hint">이 섹션은 아직 고를 수 있는 모양이 하나뿐입니다.</p>
          ) : (
            <>
              <span className="field__label">섹션 모양</span>
              <div className="sect__tpls">
                {templates.map((t) => (
                  <button
                    key={t.key}
                    className={'sect__tpl' + ((menu.template ?? 'A') === t.key ? ' is-on' : '')}
                    onClick={() => patch({ template: t.key }, 'menu.template.' + menu.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="field__hint">
                모양만 바뀝니다. 적어두신 <b>글·사진·가격은 그대로</b> 남습니다.
              </p>
            </>
          )}

          {/* 이 섹션 글자만 — 전체 기본 글꼴과 헷갈리지 않게 따로 둔다 */}
          <span className="field__label">이 섹션 글자만</span>
          <select
            className="mini"
            value={menu.font ?? ''}
            onChange={(e) => patch(
              { font: (e.target.value || undefined) as FontKey | undefined },
              'menu.font.' + menu.id,
            )}
          >
            <option value="">전체 기본 글꼴 그대로</option>
            {FONT_KEYS.map((k) => (
              <option key={k} value={k}>{FONTS[k].name}</option>
            ))}
          </select>
          <p className="field__hint">
            전체를 바꾸려면 <b>디자인</b>에서 글꼴을 골라주세요. 여기서 고르면 이 섹션만 바뀝니다.
          </p>
        </div>
      )}

      {tab === 'ai' && (
        <div className="stack">
          <p className="menu__hint">이 섹션만 다시 만듭니다. 다른 섹션은 그대로 둡니다.</p>
          <div className="sect__regen">
            <button className="btn btn--main" onClick={() => regen('all', '이 섹션을')}>전체 다시</button>
            <button className="btn btn--line" onClick={() => regen('title', '제목을')}>제목만</button>
            <button className="btn btn--line" onClick={() => regen('body', '문구를')}>문구만</button>
            <button className="btn btn--line" onClick={() => regen('photos', '사진 배치를')}>사진 배치만</button>
            <button className="btn btn--line" onClick={() => regen('template', '모양을')}>디자인만</button>
          </div>
          <p className="field__hint">
            사진은 올리신 것 중에서 고르고 놓기만 합니다. 인물을 새로 만들거나 얼굴을 바꾸지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** 메뉴에 넣을 사진 고르기 — 메뉴 데이터는 서로 독립적으로 유지된다 */
export function MenuPhotos({ menuId }: { menuId: string }) {
  const { project, update } = useProject();
  const menu = project.menus.find((m) => m.id === menuId);
  if (!menu) return null;

  if (project.photos.length === 0) {
    return <p className="menu__hint">② 사진·영상에서 사진을 올리면 여기서 고를 수 있어요.</p>;
  }

  const toggle = (photoId: string) =>
    update((d) => {
      const m = d.menus.find((x) => x.id === menuId);
      if (!m) return;
      m.photoIds = m.photoIds.includes(photoId)
        ? m.photoIds.filter((id) => id !== photoId)
        : [...m.photoIds, photoId];
    }, { label: 'menu.photos', merge: false });

  return (
    <div className="menuphotos">
      <span className="menu__hint">
        이 섹션에서 보여줄 사진 {menu.photoIds.length > 0 ? `(${menu.photoIds.length}장 선택)` : '(고르지 않으면 알아서 배치됩니다)'}
      </span>
      <div className="menuphotos__grid">
        {project.photos.map((p) => (
          <button
            key={p.id}
            className={'menuphotos__item' + (menu.photoIds.includes(p.id) ? ' is-on' : '')}
            onClick={() => toggle(p.id)}
            title={PHOTO_KIND_LABEL[p.kind]}
          >
            <img src={p.dataUrl} alt={p.name} />
          </button>
        ))}
      </div>
      <p className="field__hint">
        고른 사진을 그대로 씁니다. 얼굴·표정·옷을 바꾸지 않습니다.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * 가격표 · 상품 비교에 들어갈 촬영상품 목록.
 *
 * 한 장짜리 그림이 아니라 **고칠 수 있는 내용**이다.
 * 여기서 고쳐도 되고, 미리보기에서 글자를 눌러 고쳐도 된다. 같은 곳에 저장된다.
 */
function PackageEditor() {
  const { project, update } = useProject();
  const list = project.packages ?? [];
  const dragId = useRef<string | null>(null);

  const edit = (fn: (arr: PricePackage[]) => void, label: string) =>
    update((d) => {
      if (!d.packages) d.packages = [];
      fn(d.packages);
    }, { label, merge: false });

  const patchItem = (id: string, part: Partial<PricePackage>, label: string) =>
    update((d) => {
      const it = d.packages?.find((x) => x.id === id);
      if (it) Object.assign(it, part);
    }, { label });

  const add = () => edit((arr) => {
    if (arr.length >= 6) return;
    arr.push({ id: uid('pkg'), name: '', price: '', note: '', includes: '', photoId: '' });
  }, 'pkg.add');

  return (
    <div className="pkgs">
      <span className="field__label">촬영상품 (가격표에 나옵니다 · 최대 6개)</span>

      {list.length === 0 && (
        <p className="field__hint">아래 <b>+ 상품 추가</b>를 누르면 가격표가 만들어집니다.</p>
      )}

      {list.map((it, i) => (
        <div
          key={it.id}
          className="pkg"
          draggable
          onDragStart={() => { dragId.current = it.id; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            const from = dragId.current;
            dragId.current = null;
            if (!from || from === it.id) return;
            edit((arr) => {
              const a = arr.findIndex((x) => x.id === from);
              const b = arr.findIndex((x) => x.id === it.id);
              if (a < 0 || b < 0) return;
              const [moved] = arr.splice(a, 1);
              arr.splice(b, 0, moved);
            }, 'pkg.order');
          }}
        >
          <div className="pkg__head">
            <span className="pkg__grip" title="끌어서 순서를 바꿀 수 있어요">⠿</span>
            <span className="pkg__no">{i + 1}</span>
            <button className="tiny" onClick={() => edit((arr) => {
              if (arr.length >= 6) return;
              const k = arr.findIndex((x) => x.id === it.id);
              if (k >= 0) arr.splice(k + 1, 0, { ...arr[k], id: uid('pkg') });
            }, 'pkg.dup')}>복제</button>
            <button className="tiny tiny--danger" onClick={() => edit((arr) => {
              const k = arr.findIndex((x) => x.id === it.id);
              if (k >= 0) arr.splice(k, 1);
            }, 'pkg.del')}>삭제</button>
          </div>

          <div className="row2">
            <input
              className="mini" value={it.name} placeholder="상품명 (예: 소가족 세트)"
              onChange={(e) => patchItem(it.id, { name: e.target.value }, 'pkg.name.' + it.id)}
            />
            <input
              className="mini" value={it.price} placeholder="가격 (예: 150000)"
              onChange={(e) => patchItem(it.id, { price: e.target.value }, 'pkg.price.' + it.id)}
            />
          </div>

          <input
            className="mini mini--text" value={it.note} placeholder="짧은 설명 (선택)"
            onChange={(e) => patchItem(it.id, { note: e.target.value }, 'pkg.note.' + it.id)}
          />

          <textarea
            className="mini mini--text" rows={2} value={it.includes}
            placeholder={'포함 구성 — 한 줄에 하나씩\n예) 보정본 2장\n11x14 액자'}
            onChange={(e) => patchItem(it.id, { includes: e.target.value }, 'pkg.inc.' + it.id)}
          />

          {project.photos.length > 0 && (
            <select
              className="mini"
              value={it.photoId}
              onChange={(e) => patchItem(it.id, { photoId: e.target.value }, 'pkg.photo.' + it.id)}
            >
              <option value="">대표사진 없음</option>
              {project.photos.map((p, k) => (
                <option key={p.id} value={p.id}>사진 {k + 1} · {p.name}</option>
              ))}
            </select>
          )}
        </div>
      ))}

      <button className="btn btn--line wide" onClick={add} disabled={list.length >= 6}>
        + 상품 추가
      </button>
    </div>
  );
}
