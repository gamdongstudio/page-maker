import { useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import type { Photo } from '@/types/project';
import { readPhotoFiles } from '@/utils/image';
import { download, safeName } from '@/services/export/exportImage';

/**
 * 상품 이미지 만들기 — 스마트스토어에 올릴 대표이미지 / 추가이미지를 고르고 규격을 맞춘다.
 *
 * ① 자료 준비에서 가져온 사진을 그대로 쓴다. 사진 보관함을 새로 만들지 않는다.
 * 어떤 사진이 대표이고 어떤 사진이 추가인지는 **사진 위 배지**로만 알려준다.
 * (아래에 큰 미리보기를 또 두지 않는다 — 목록만 봐도 역할을 알 수 있어야 한다)
 *
 * 저장은 내려받기만 한다. 상세페이지의 대표사진이나 저장된 작업 내용은 바꾸지 않는다.
 * 고른 역할·순서는 나중에 PM Connect 자동입력이 그대로 쓸 수 있는 모양으로 들고 있는다.
 */

/** 스마트스토어에서 쓰는 규격 — 늘려서 찌그러뜨리지 않는다 */
const SIZES = [
  { key: '1000', w: 1000, h: 1000, label: '1000 × 1000' },
  { key: '750', w: 750, h: 1000, label: '750 × 1000' },
] as const;
type SizeKey = (typeof SIZES)[number]['key'];

const PREVIEW = 240;   // 크기 조정 화면에서 보여줄 크기
const MIN_Z = 1;
const MAX_Z = 3;

type Mode = 'fill' | 'fit';
interface Adjust { mode: Mode; zoom: number; x: number; y: number }
const DEFAULT_ADJ: Adjust = { mode: 'fill', zoom: 1, x: 0, y: 0 };

/** 이 사진을 규격 안 어디에 얼마나 크게 그릴지 — 미리보기와 저장이 같은 계산을 쓴다 */
function layout(p: Photo, box: { w: number; h: number }, a: Adjust) {
  const base = a.mode === 'fill'
    ? Math.max(box.w / p.width, box.h / p.height)
    : Math.min(box.w / p.width, box.h / p.height);
  const scale = base * a.zoom;          // 가로·세로를 같은 비율로 — 원본 비율 유지
  const w = p.width * scale;
  const h = p.height * scale;
  return { w, h, x: (box.w - w) / 2 + a.x, y: (box.h - h) / 2 + a.y };
}

/** 채우기일 때 사진이 밖으로 빠져 흰 여백이 생기지 않게 */
function clamp(p: Photo, box: { w: number; h: number }, a: Adjust): Adjust {
  if (a.mode === 'fit') return a;
  const { w, h } = layout(p, box, { ...a, x: 0, y: 0 });
  const mx = Math.max(0, (w - box.w) / 2);
  const my = Math.max(0, (h - box.h) / 2);
  return { ...a, x: Math.max(-mx, Math.min(mx, a.x)), y: Math.max(-my, Math.min(my, a.y)) };
}

/** 규격에 맞춰 실제 그림을 만든다 */
async function renderJpg(p: Photo, box: { w: number; h: number }, a: Adjust): Promise<Blob> {
  const img = new Image();
  await new Promise<void>((ok, no) => {
    img.onload = () => ok();
    img.onerror = () => no(new Error('사진을 열지 못했습니다.'));
    img.src = p.dataUrl;
  });
  const c = document.createElement('canvas');
  c.width = box.w;
  c.height = box.h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('이미지를 만들지 못했습니다.');
  /* 전체 보이기에서 남는 자리는 흰색 */
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, box.w, box.h);
  const L = layout(p, box, a);
  ctx.drawImage(img, L.x, L.y, L.w, L.h);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) throw new Error('이미지를 만들지 못했습니다.');
  return blob;
}

/**
 * 고른 역할은 화면을 잠깐 옮겨도(저장 완료 화면 등) 그대로 두고 싶다.
 * 저장 파일 구조를 건드리지 않으려고 **이번에 켜 둔 동안만** 여기에 들고 있는다.
 * (나중에 PM Connect 자동입력을 붙일 때 이 모양 그대로 넘기면 된다)
 */
const keep: { mainId: string; extraIds: string[]; adj: Record<string, Adjust> } = {
  mainId: '', extraIds: [], adj: {},
};

export function MainImage() {
  const { project, update } = useProject();
  const [mainId, setMainId] = useState(keep.mainId);
  const [extraIds, setExtraIds] = useState<string[]>(keep.extraIds);
  const [openId, setOpenId] = useState('');        // 역할을 고르는 중인 사진
  const [editId, setEditId] = useState('');        // 크기 조정 중인 사진
  const [sizeKey, setSizeKey] = useState<SizeKey>('1000');
  const [adj, setAdj] = useState<Record<string, Adjust>>(keep.adj);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; ax: number; ay: number } | null>(null);

  const photos = project.photos.filter((p) => p.kind !== 'unused');
  const size = SIZES.find((s) => s.key === sizeKey) ?? SIZES[0];
  const box = { w: size.w, h: size.h };
  const base = safeName(project.product.storeTitle || project.product.name || project.title);
  const editing = photos.find((p) => p.id === editId) ?? null;
  const aOf = (id: string): Adjust => adj[id] ?? DEFAULT_ADJ;
  /* 화면을 옮겨도 고른 것이 남도록 함께 적어 둔다 */
  keep.mainId = mainId; keep.extraIds = extraIds; keep.adj = adj;
  const setA = (id: string, next: Adjust) => setAdj((m) => ({ ...m, [id]: next }));

  /* ---- 역할 지정 ---- */
  const setMain = (id: string) => {
    setMainId(id);                                  // 대표는 언제나 1장
    setExtraIds((list) => list.filter((x) => x !== id));
    setOpenId('');
    setMsg('');
  };
  const addExtra = (id: string) => {
    if (mainId === id) setMainId('');
    setExtraIds((list) => (list.includes(id) ? list : [...list, id]));  // 고른 순서가 곧 추가 번호
    setOpenId('');
    setMsg('');
  };
  const clearRole = (id: string) => {
    if (mainId === id) setMainId('');
    setExtraIds((list) => list.filter((x) => x !== id));
    setOpenId('');
    setMsg('');
  };

  /* ---- + 사진 추가 (① 자료 준비와 같은 보관함에 넣는다) ---- */
  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    const read = await readPhotoFiles(files, 'upload');
    setBusy(false);
    if (!read.length) { setMsg('사진을 읽지 못했습니다. JPG·PNG 사진인지 확인해주세요.'); return; }
    update((d) => { d.photos.push(...read); }, { label: 'mainimage.add', merge: false });
  };

  /* ---- 크기 조정 ---- */
  const nudge = (d: number) => {
    if (!editing) return;
    const a = aOf(editId);
    const zoom = Math.round(Math.max(MIN_Z, Math.min(MAX_Z, a.zoom + d)) * 10) / 10;
    setA(editId, clamp(editing, box, { ...a, zoom }));
  };
  const setMode = (mode: Mode) => {
    if (!editing) return;
    setA(editId, { ...DEFAULT_ADJ, mode });       // 맞추는 방식을 바꾸면 위치는 가운데로
  };
  const onDown = (e: React.PointerEvent) => {
    if (!editing) return;
    const a = aOf(editId);
    drag.current = { x: e.clientX, y: e.clientY, ax: a.x, ay: a.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !editing) return;
    const k = box.h / PREVIEW;
    const a = aOf(editId);
    setA(editId, clamp(editing, box, { ...a, x: d.ax + (e.clientX - d.x) * k, y: d.ay + (e.clientY - d.y) * k }));
  };
  const onUp = () => { drag.current = null; };

  /* ---- 저장 ---- */
  const saveOne = async (p: Photo, name: string) => {
    setBusy(true);
    setMsg('');
    try {
      download(await renderJpg(p, box, aOf(p.id)), name);
      setMsg(`${name} (${size.w}×${size.h}) 저장했습니다.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '이미지를 만들지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const saveMain = () => {
    const p = photos.find((x) => x.id === mainId);
    if (!p) { setMsg('먼저 사진을 눌러 대표이미지를 지정해 주세요.'); return; }
    void saveOne(p, `${base}_대표이미지.jpg`);
  };

  const saveExtras = async () => {
    const list = extraIds.map((id) => photos.find((p) => p.id === id)).filter(Boolean) as Photo[];
    if (!list.length) { setMsg('먼저 사진을 눌러 추가이미지를 지정해 주세요.'); return; }
    setBusy(true);
    setMsg('');
    try {
      for (let i = 0; i < list.length; i++) {
        const name = `${base}_추가이미지_${String(i + 1).padStart(2, '0')}.jpg`;
        download(await renderJpg(list[i], box, aOf(list[i].id)), name);
        await new Promise((r) => window.setTimeout(r, 120));   // 브라우저가 연속 저장을 막지 않게
      }
      setMsg(`추가이미지 ${list.length}장을 저장했습니다. (${size.w}×${size.h})`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '이미지를 만들지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const roleOf = (id: string) => {
    if (mainId === id) return { kind: 'main' as const, label: '대표' };
    const i = extraIds.indexOf(id);
    return i >= 0 ? { kind: 'extra' as const, label: `추가 ${i + 1}` } : null;
  };

  const L = editing ? layout(editing, box, aOf(editId)) : null;
  const k = PREVIEW / box.h;

  return (
    <section className="box mainimg">
      <h3 className="box__title">상품 이미지 만들기</h3>
      <p className="box__hint">
        스마트스토어에 올릴 대표이미지·추가이미지를 만듭니다. 상세페이지와 저장된 내용은 바뀌지 않습니다.
      </p>
      <p className="field__hint">① 자료 준비에서 가져온 사진 중 선택하세요. 사진을 누르면 역할을 정할 수 있어요.</p>

      <div className="mainimg__grid">
        {photos.map((p) => {
          const role = roleOf(p.id);
          return (
            <button
              key={p.id}
              className={'mainimg__pick' + (role ? ` is-${role.kind}` : '')}
              onClick={() => setOpenId(openId === p.id ? '' : p.id)}
              aria-pressed={!!role}
              title={p.name}
            >
              <img src={p.dataUrl} alt={p.name} />
              {role && <span className={'mainimg__badge mainimg__badge--' + role.kind}>{role.label}</span>}
            </button>
          );
        })}
        <button className="mainimg__add" onClick={() => fileRef.current?.click()} disabled={busy}>+ 사진 추가</button>
        <input
          ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ''; }}
        />
      </div>

      {/* 사진을 누르면 나오는 아주 간단한 선택 — 큰 미리보기를 따로 두지 않는다 */}
      {openId && (
        <div className="mainimg__ask">
          <b>이 사진을 어디에 사용할까요?</b>
          <div className="mainimg__askacts">
            <button className="btn btn--main" onClick={() => setMain(openId)}>대표이미지로 지정</button>
            <button className="btn btn--line" onClick={() => addExtra(openId)}>추가이미지로 지정</button>
            <button className="btn btn--quiet" onClick={() => clearRole(openId)}>선택 해제</button>
            <button className="btn btn--line" onClick={() => { setEditId(openId); setOpenId(''); }}>크기 조정</button>
          </div>
        </div>
      )}

      {/* 크기 조정 — 필요할 때만 연다 */}
      {editing && L && (
        <div className="mainimg__edit">
          <div className="mainimg__edithead">
            <b>크기 조정</b>
            <button className="linkbtn" onClick={() => setEditId('')}>닫기</button>
          </div>
          <div
            className="mainimg__stage"
            style={{ width: box.w * k, height: PREVIEW }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            title="끌어서 위치를 옮길 수 있어요"
          >
            <img
              src={editing.dataUrl} alt="" draggable={false}
              style={{ position: 'absolute', left: L.x * k, top: L.y * k, width: L.w * k, height: L.h * k, maxWidth: 'none' }}
            />
          </div>
          <div className="mainimg__tools">
            <button className={'btn btn--line' + (aOf(editId).mode === 'fill' ? ' is-on' : '')} onClick={() => setMode('fill')}>화면 채우기</button>
            <button className={'btn btn--line' + (aOf(editId).mode === 'fit' ? ' is-on' : '')} onClick={() => setMode('fit')}>사진 전체 보이기</button>
            <button className="btn btn--line" onClick={() => nudge(-0.2)} disabled={aOf(editId).zoom <= MIN_Z}>축소 −</button>
            <button className="btn btn--line" onClick={() => nudge(0.2)} disabled={aOf(editId).zoom >= MAX_Z}>확대 +</button>
          </div>
          <p className="field__hint">{size.w}×{size.h} · 네모 안에 보이는 그대로 저장됩니다. 원본 비율은 그대로 유지됩니다.</p>
          <button
            className="btn btn--line wide"
            disabled={busy}
            onClick={() => {
              const r = roleOf(editId);
              const i = extraIds.indexOf(editId);
              void saveOne(editing, r?.kind === 'main'
                ? `${base}_대표이미지.jpg`
                : i >= 0 ? `${base}_추가이미지_${String(i + 1).padStart(2, '0')}.jpg`
                  : `${base}_상품이미지.jpg`);
            }}
          >이 이미지 저장</button>
        </div>
      )}

      <div className="mainimg__size">
        <span className="field__label">이미지 크기</span>
        {SIZES.map((s) => (
          <button
            key={s.key}
            className={'btn btn--line' + (sizeKey === s.key ? ' is-on' : '')}
            onClick={() => setSizeKey(s.key)}
            aria-pressed={sizeKey === s.key}
          >{s.label}</button>
        ))}
      </div>

      <div className="storetext">
        <button className="btn btn--main" onClick={saveMain} disabled={busy}>대표이미지 저장</button>
        <button className="btn btn--line" onClick={() => void saveExtras()} disabled={busy}>
          추가이미지 전체 저장{extraIds.length ? ` (${extraIds.length}장)` : ''}
        </button>
      </div>

      {msg && <p className="note note--ok" aria-live="polite">{msg}</p>}
    </section>
  );
}
