import { useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { PHOTO_KIND_LABEL, type FontKey, type MenuItem, type PricePackage } from '@/types/project';
import type { Review } from '@/types/studio';
import { FONT_KEYS, FONTS } from '@/config/fonts';
import { uid } from '@/types/defaults';
import { templatesFor } from '@/components/preview/templates';
import { fieldProducts, planStudioPage, promoteProduct, type PlannedMenu, type StudioPlan } from '@/services/ai/studioPlanner';
import { regenerateMenu } from '@/services/ai/applyPlan';
import { EMPTY_BRIEF } from '@/types/project';
import { EMPTY_EVENT, EMPTY_PRICING } from '@/types/studio';
import { setPrice } from '@/utils/photoOps';
import { readPhotoFiles } from '@/utils/image';
import { GptPromptBox } from '@/components/prepare/ContentFields';

/**
 * '목록 (한 줄에 하나씩)' 입력칸을 보여줄 영역.
 * 목록으로 보여주는 영역에서만 쓴다 — 일반 제목+설명형에는 필요 없다.
 */
const USES_LINES: MenuItem['kind'][] = [
  'benefit', 'feature', 'recommend', 'perks', 'process', 'prepare',
  'faq', 'caution', 'howto', 'shipping', 'shootConcept', 'concept', 'scene',
];

/**
 * 섹션 하나를 고치는 편집창.
 *
 *   섹션 제목을 누르면 한 화면에 세로로: 글 → (가격·이벤트 값) → 사진 → 모양 → GPT 도구 → 자동 추천 다시 받기
 *   예전의 [글 수정] [사진 변경] [디자인 변경] [다시 만들기] 탭은 없앴다 (같은 기능을 한 곳에 모음).
 *
 * 중요
 *  - **이 섹션만** 바뀐다. 다른 섹션은 건드리지 않는다.
 *  - 모양(디자인)을 바꿔도 글·사진·가격은 그대로 남는다.
 *  - 사진은 고르기만 한다. 얼굴을 바꾸는 기능은 없다.
 */

/** 이 섹션이 가격표(여러 상품)를 쓰는지 */
function usesPackages(menu: MenuItem): boolean {
  return menu.kind === 'compare' || (menu.kind === 'price' && (menu.template ?? 'A') === 'E');
}

export function SectionTools({ menu }: { menu: MenuItem }) {
  const { project, update } = useProject();
  const [msg, setMsg] = useState('');
  const [shapeOpen, setShapeOpen] = useState(false);
  /** 자동 추천 다시 받기 — 바로 덮어쓰지 않고 후보를 먼저 보여준다 */
  const [redo, setRedo] = useState<{ plan: StudioPlan; planned: PlannedMenu } | null>(null);
  const templates = templatesFor(menu.kind);
  const shape = templates.find((t) => t.key === (menu.template ?? 'A'));

  const patch = (part: Partial<MenuItem>, label: string) =>
    update((d) => {
      const m = d.menus.find((x) => x.id === menu.id);
      if (m) Object.assign(m, part);
    }, { label });

  const say = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(''), 4000); };

  /**
   * ⚠ 되는지 안 되는지는 **미리** 따져본다.
   *   상태를 바꾸는 함수 안에서 바깥 값을 읽으면 아직 실행되기 전이라 늘 틀린 값이 나온다.
   */
  const askRedo = () => {
    const plan = planStudioPage(project);
    const planned = plan.menus.find((p) => p.kind === menu.kind);
    if (!planned) { say('이 섹션은 아직 자동으로 만들 수 없어요. 직접 고쳐주세요.'); return; }
    setRedo({ plan, planned });
  };
  const applyRedo = () => {
    if (!redo) return;
    const plan = redo.plan;
    update((d) => { regenerateMenu(d, menu.id, plan, 'all'); }, { label: 'menu.regen', merge: false });
    setRedo(null);
    say('추천 내용으로 바꿨습니다. 다른 섹션은 그대로입니다. (실행취소로 되돌리기)');
  };

  return (
    <div className="sect">
      <p className="field__label" style={{ fontSize: 14 }}><b>{menu.title || '섹션'} 편집</b></p>
      {msg && <p className="note note--ok">{msg}</p>}

      {/* 1. 글 */}
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
        {/* 목록을 실제로 쓰는 영역에서만 보여준다 — 일반 제목+설명형에서는 헷갈리기만 한다.
            (값은 지우지 않으므로 예전 작업 데이터는 그대로 남는다) */}
        {USES_LINES.includes(menu.kind) && (
          <label className="field">
            <span className="field__label">목록 (한 줄에 하나씩)</span>
            <textarea
              className="mini mini--text"
              rows={3}
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
        )}

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
        {menu.kind === 'price' && <PriceFields />}
        {/* GPT로 가격표 만들기 — 상품 구성 바로 아래, 사진(가격표 이미지)보다 위 */}
        {menu.kind === 'price' && <GptPromptBox kind="price" />}
        {menu.kind === 'event' && <EventFields />}
        {menu.kind === 'review' && <ReviewEditor />}
      </div>

      {/* 2. 사진 — 이 섹션에 보여줄 사진을 고르거나 새로 올린다 */}
      {menu.kind !== 'cta' && (
        <div className="stack">
          <span className="field__label">
            사진{menu.photoIds.length > 0 ? ` — ${menu.photoIds.length}장 선택됨` : ''}
          </span>
          <MenuPhotos menuId={menu.id} />
          <PhotoUpload menuId={menu.id} />
        </div>
      )}

      {/* 3. 모양 — 현재 모양만 보이고, 누를 때 후보를 펼친다 */}
      <div className="stack">
        <span className="field__label">
          모양 — 현재: {shape?.label ?? '기본'}{' '}
          <button className="tiny" onClick={() => setShapeOpen((v) => !v)}>{shapeOpen ? '접기' : '모양 바꾸기'}</button>
        </span>
        {shapeOpen && (
          <>
            {templates.length === 0 ? (
              <p className="menu__hint">이 섹션은 아직 고를 수 있는 모양이 하나뿐입니다.</p>
            ) : (
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
            )}
            <p className="field__hint">모양만 바뀝니다. 적어두신 <b>글·사진·가격은 그대로</b> 남습니다.</p>
            {/* 이 섹션 글자만 — 전체 기본 글꼴과 헷갈리지 않게 따로 둔다 */}
            <select
              className="mini"
              value={menu.font ?? ''}
              aria-label="이 섹션 글자만"
              onChange={(e) => patch(
                { font: (e.target.value || undefined) as FontKey | undefined },
                'menu.font.' + menu.id,
              )}
            >
              <option value="">이 섹션 글꼴: 전체 기본 글꼴 그대로</option>
              {FONT_KEYS.map((k) => (
                <option key={k} value={k}>{FONTS[k].name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* 4. GPT 도구 */}
      {menu.kind === 'event' && <GptPromptBox kind="event" />}

      {/* 5. 자동 추천 다시 받기 — 작은 보조 단추. 후보를 보고 고를 때만 바꾼다 */}
      <div>
        <button className="linkbtn" style={{ fontSize: 12, opacity: 0.75 }} onClick={askRedo}>자동 제작 다시 받기</button>
        {redo && (
          <div className="box box--ask" style={{ marginTop: 6 }}>
            <p className="field__hint">이 섹션만 아래 추천으로 바꿉니다. 다른 섹션은 그대로입니다.</p>
            <p><b>{redo.planned.title}</b></p>
            {redo.planned.body && <p style={{ whiteSpace: 'pre-line' }}>{redo.planned.body}</p>}
            {redo.planned.lines.length > 0 && (
              <ul style={{ margin: '0 0 0 18px', padding: 0 }}>{redo.planned.lines.map((l) => <li key={l}>{l}</li>)}</ul>
            )}
            <div className="askchoice">
              <button className="btn btn--main" onClick={applyRedo}>이 내용으로 바꾸기</button>
              <button className="btn btn--line" onClick={() => setRedo(null)}>그대로 두기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 가격 안내 — 실제 상품명 · 가격 · 구성 (메인 제목과 따로) */
function PriceFields() {
  const { project, update } = useProject();
  const p = project.product;
  const fp = fieldProducts(project);
  return (
    <div className="stack">
      {fp.field && <p className="field__hint">촬영분야: <b>{fp.field}</b> — 이 분야 상품만 가격 안내에 보입니다. (다른 상품은 지우지 않고 보관)</p>}
      {fp.field && !fp.matched && (
        <p className="note note--warn">{fp.field} 관련 상품을 자동으로 찾지 못했습니다. 아래에서 직접 골라주세요.</p>
      )}
      {fp.all.length > 1 && (
        <label className="field">
          <span className="field__label">대표 상품</span>
          <select
            className="mini" value={fp.rep?.name ?? ''}
            onChange={(e) => { const v = e.target.value; if (!v) return; update((d) => { promoteProduct(d, v); }, { label: 'shoot.repProduct', merge: false }); }}
          >
            <option value="">{fp.rep ? fp.rep.name : '대표 상품을 골라주세요'}</option>
            {fp.all.map((x) => <option key={x.name} value={x.name}>{x.name} {x.price}</option>)}
          </select>
        </label>
      )}
      <label className="field">
        <span className="field__label">상품 (실제 상품명)</span>
        <input
          className="mini mini--text" value={project.shoot?.productName ?? ''}
          onChange={(e) => { const v = e.target.value; update((d) => { d.shoot = { ...(d.shoot ?? EMPTY_BRIEF), productName: v }; }, { label: 'shoot.productName' }); }}
        />
      </label>
      <div className="row2">
        <label className="field">
          <span className="field__label">정상가</span>
          <input className="mini mini--text" value={p.listPrice} onChange={(e) => { const v = e.target.value; update((d) => setPrice(d, 'list', v), { label: 'price.list' }); }} />
        </label>
        <label className="field">
          <span className="field__label">판매가</span>
          <input className="mini mini--text" value={p.salePrice} onChange={(e) => { const v = e.target.value; update((d) => setPrice(d, 'sale', v), { label: 'price.sale' }); }} />
        </label>
      </div>
      <label className="field">
        <span className="field__label">구성 (한 줄에 하나씩)</span>
        <textarea
          className="mini mini--text" rows={3} value={project.pricing?.includes ?? ''}
          onChange={(e) => { const v = e.target.value; update((d) => { d.pricing = { ...EMPTY_PRICING, ...(d.pricing ?? {}), includes: v }; }, { label: 'pricing.includes' }); }}
        />
      </label>
    </div>
  );
}

/** 이벤트·혜택 — 제목 · 기간 · 내용 원문 (상세페이지에는 요약해서 보인다) */
function EventFields() {
  const { project, update } = useProject();
  const ev = project.event;
  const set = (k: 'title' | 'period' | 'body') => (v: string) =>
    update((d) => { d.event = { ...EMPTY_EVENT, ...(d.event ?? {}), [k]: v }; }, { label: 'event.' + k });
  return (
    <div className="stack">
      <label className="field">
        <span className="field__label">이벤트 제목</span>
        <input className="mini mini--text" value={ev?.title ?? ''} onChange={(e) => set('title')(e.target.value)} />
      </label>
      <label className="field">
        <span className="field__label">기간</span>
        <input className="mini mini--text" value={ev?.period ?? ''} placeholder="예) 2026.09.12~2026.09.30" onChange={(e) => set('period')(e.target.value)} />
      </label>
      <label className="field">
        <span className="field__label">이벤트 내용 (원문 · 상세페이지에는 핵심만 짧게 보입니다)</span>
        <textarea className="mini mini--text" rows={5} value={ev?.body ?? ''} onChange={(e) => set('body')(e.target.value)} />
      </label>
    </div>
  );
}

/** 이 섹션에 사진 올리기 — 올린 사진은 사진 보관함에도 들어가고 이 섹션에 바로 선택된다 */
function PhotoUpload({ menuId }: { menuId: string }) {
  const { update } = useProject();
  const ref = useRef<HTMLInputElement>(null);
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const photos = await readPhotoFiles([...files], 'upload');
    update((d) => {
      d.photos.push(...photos);
      const m = d.menus.find((x) => x.id === menuId);
      if (m) m.photoIds = [...m.photoIds, ...photos.map((p) => p.id)];
    }, { label: 'menu.photo.upload', merge: false });
  };
  return (
    <>
      <button className="tiny" onClick={() => ref.current?.click()}>사진 추가 (내 컴퓨터에서)</button>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} />
    </>
  );
}

/* ------------------------------------------------------------------ */

/** 메뉴에 넣을 사진 고르기 — 메뉴 데이터는 서로 독립적으로 유지된다 */
export function MenuPhotos({ menuId }: { menuId: string }) {
  const { project, update } = useProject();
  const menu = project.menus.find((m) => m.id === menuId);
  if (!menu) return null;

  if (project.photos.length === 0) {
    return <p className="menu__hint">아직 사진이 없습니다. 아래 [사진 추가]로 넣어주세요.</p>;
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
        가져온 사진에서 고르기 {menu.photoIds.length > 0 ? `· ${menu.photoIds.length}장 선택됨` : '· 고르지 않으면 알아서 배치됩니다'}
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
      <p className="field__hint">다시 누르면 선택이 풀립니다. 고른 사진을 그대로 씁니다.</p>
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

/* ------------------------------------------------------------------ */
/* 후기                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 후기 고르기 · 고치기.
 *
 * 가져온 자료에 후기가 들어 있으면 그것을 후보로 보여주고, 쓸 것만 고른다.
 * (지금 PM Connect 수집에는 후기가 들어오지 않으므로 대개 [+ 후기 직접 추가]로 넣는다)
 *
 * 글과 사진은 따로 둔다 — 한 장 이미지로 합치지 않는다.
 * 별점은 **실제로 받은 값이 있을 때만** 넣는다. 비워 두면 별을 그리지 않는다.
 */
function ReviewEditor() {
  const { project, update } = useProject();
  const list = project.reviews ?? [];
  const dragId = useRef<string | null>(null);

  const edit = (fn: (arr: Review[]) => void, label: string) =>
    update((d) => {
      if (!d.reviews) d.reviews = [];
      fn(d.reviews);
    }, { label, merge: false });

  const patch = (id: string, part: Partial<Review>, label: string) =>
    update((d) => {
      const r = (d.reviews ?? []).find((x) => x.id === id);
      if (r) Object.assign(r, part);
    }, { label });

  const add = () => edit((arr) => {
    arr.push({ id: uid('rev'), body: '', author: '', source: '', date: '', photoId: '', use: true });
  }, 'review.add');

  const move = (fromId: string, toId: string) => edit((arr) => {
    const from = arr.findIndex((x) => x.id === fromId);
    const to = arr.findIndex((x) => x.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
  }, 'review.move');

  const used = list.filter((r) => r.use).length;

  return (
    <div className="stack">
      <span className="field__label">
        가져온 후기 중 사용할 후기를 선택하세요.{list.length ? ` — ${used}/${list.length}개 사용` : ''}
      </span>
      {list.length === 0 && (
        <p className="menu__hint">
          아직 후기가 없습니다. [+ 후기 직접 추가]로 넣어주세요.
          (지금은 주소 가져오기에서 후기를 자동으로 가져오지 않습니다)
        </p>
      )}

      {list.map((r) => (
        <div
          key={r.id}
          className={'revcard' + (r.use ? ' is-on' : '')}
          draggable
          onDragStart={() => { dragId.current = r.id; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragId.current) move(dragId.current, r.id); dragId.current = null; }}
        >
          <div className="revcard__head">
            <label className="revcard__use">
              <input
                type="checkbox"
                checked={r.use}
                onChange={(e) => patch(r.id, { use: e.target.checked }, 'review.use.' + r.id)}
              />
              <span>{r.use ? '사용함' : '사용 안 함'}</span>
            </label>
            <span className="shoot__grip" aria-hidden title="끌어서 순서를 바꿀 수 있어요">⋮⋮</span>
            <button className="tiny tiny--danger" onClick={() => edit((arr) => {
              const i = arr.findIndex((x) => x.id === r.id);
              if (i >= 0) arr.splice(i, 1);
            }, 'review.del')}>삭제</button>
          </div>

          <ReviewPhoto review={r} onPick={(photoId) => patch(r.id, { photoId }, 'review.photo.' + r.id)} />

          <textarea
            className="mini mini--text"
            rows={3}
            value={r.body}
            placeholder="후기 글을 적어주세요"
            onChange={(e) => patch(r.id, { body: e.target.value }, 'review.body.' + r.id)}
          />
          <div className="revcard__who">
            <input
              className="mini mini--text"
              value={r.author}
              placeholder="작성자 (예: 김**)"
              onChange={(e) => patch(r.id, { author: e.target.value }, 'review.author.' + r.id)}
            />
            <input
              className="mini mini--text"
              value={r.source}
              placeholder="출처 (예: 네이버)"
              onChange={(e) => patch(r.id, { source: e.target.value }, 'review.source.' + r.id)}
            />
          </div>
          <div className="revcard__who">
            <input
              className="mini mini--text"
              value={r.date}
              placeholder="날짜 (선택)"
              onChange={(e) => patch(r.id, { date: e.target.value }, 'review.date.' + r.id)}
            />
            <select
              className="mini"
              aria-label="별점"
              value={r.stars ?? ''}
              onChange={(e) => patch(
                r.id,
                { stars: e.target.value ? Number(e.target.value) : undefined },
                'review.stars.' + r.id,
              )}
            >
              <option value="">별점 없음</option>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
            </select>
          </div>
        </div>
      ))}

      <button className="btn btn--line wide" onClick={add}>+ 후기 직접 추가</button>
      <p className="field__hint">실제로 받은 별점만 넣어주세요. 비워두면 별표를 그리지 않습니다.</p>
    </div>
  );
}

/**
 * 후기 사진 — **기본은 사진 없음.**
 *
 * 사진을 자동으로 붙이지 않는다. [사진 넣기]를 눌렀을 때만 고르는 자리를 연다.
 * 가져온 사진에서 고르거나 컴퓨터에서 바로 올릴 수 있고, 넣은 뒤에는 교체·삭제할 수 있다.
 */
function ReviewPhoto({ review, onPick }: { review: Review; onPick: (id: string) => void }) {
  const { project, update } = useProject();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photos = project.photos.filter((p) => p.kind !== 'unused');
  const picked = photos.find((p) => p.id === review.photoId);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    const read = await readPhotoFiles(files, 'upload');
    if (!read.length) return;
    update((d) => { d.photos.push(...read); }, { label: 'review.photo.add', merge: false });
    onPick(read[0].id);
    setOpen(false);
  };

  /* 사진이 없으면 단추 하나만 — 빈 사진 자리를 만들지 않는다 */
  if (!review.photoId && !open) {
    return <div><button className="tiny" onClick={() => setOpen(true)}>사진 넣기</button></div>;
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      {picked && (
        <div className="revcard__now">
          <img src={picked.dataUrl} alt={picked.name} />
          <button className="tiny" onClick={() => setOpen((v) => !v)}>{open ? '고르기 닫기' : '사진 교체'}</button>
          <button className="tiny tiny--danger" onClick={() => { onPick(''); setOpen(false); }}>사진 삭제</button>
        </div>
      )}
      {open && (
        <>
          {photos.length > 0 && (
            <div className="revcard__pics">
              {photos.map((p) => (
                <button
                  key={p.id}
                  className={'revcard__pic' + (review.photoId === p.id ? ' is-on' : '')}
                  onClick={() => { onPick(p.id); setOpen(false); }}
                  title={p.name}
                >
                  <img src={p.dataUrl} alt={p.name} />
                </button>
              ))}
            </div>
          )}
          <div className="revcard__picacts">
            <button className="tiny" onClick={() => fileRef.current?.click()}>컴퓨터에서 올리기</button>
            {!review.photoId && <button className="tiny" onClick={() => setOpen(false)}>닫기</button>}
            <input
              ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => { void upload([...(e.target.files ?? [])]); e.target.value = ''; }}
            />
          </div>
          {photos.length === 0 && <p className="menu__hint">가져온 사진이 없으면 컴퓨터에서 바로 올릴 수 있어요.</p>}
        </>
      )}
    </div>
  );
}
