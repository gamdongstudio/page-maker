import { useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { useEdition } from '@/store/EditionContext';
import {
  HERO_SHAPE_LABEL, PHOTO_FIT_LABEL, PHOTO_KIND_LABEL, PHOTO_SOURCE_LABEL,
  type HeroShape, type Photo, type PhotoFit, type PhotoKind,
} from '@/types/project';
import { uid } from '@/types/defaults';
import { FIT_HINT, photoWarning, readPhotoFiles, recommendHeroShape, shapeOf } from '@/utils/image';
import { reviewPhotos, rotateDataUrl } from '@/utils/photoCheck';
import { excludePhoto, movePhoto, removePhoto, replacePhoto, setMainPhoto } from '@/utils/photoOps';

/**
 * 상세페이지에 사용할 사진 — **하나의 보관함.**
 *
 * 주소에서 가져온 사진과 컴퓨터에서 올린 사진을 나누지 않는다.
 * 어디서 왔는지는 카드 구석에 작게만 적는다.
 *
 * 사진마다: 크게 보기 · 대표사진 · 교체 · 회전 · 삭제 · 끌어서 순서 바꾸기
 * '제외 추천' 은 표시만 한다. 지우는 것은 사용자가 고른다.
 *
 * ⚠ 사진 속 인물은 원본 그대로. 크기·위치·방향만 다룬다.
 */
export function PhotoLibrary({ compact = false }: { compact?: boolean }) {
  const { project, update } = useProject();
  const { isPro } = useEdition();
  const photos = project.photos;
  const addRef = useRef<HTMLInputElement>(null);
  const swapRef = useRef<HTMLInputElement>(null);
  const swapId = useRef<string | null>(null);
  const dragId = useRef<string | null>(null);
  const [over, setOver] = useState(false);
  const [bigId, setBigId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 3500); };

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    const read = await readPhotoFiles(files, 'upload');
    const added = await reviewPhotos(read, project.photos);
    setBusy(false);
    if (!added.length) { say('사진을 읽지 못했습니다. JPG·PNG 사진인지 확인해주세요.'); return; }
    update((d) => {
      const hadMain = d.photos.some((p) => p.kind === 'main');
      d.photos.push(...added);
      if (!hadMain) {
        const first = added.find((p) => !p.exclude) ?? added[0];
        setMainPhoto(d, first.id);
      }
    }, { label: 'photos.add', merge: false });
    const flagged = added.filter((p) => p.exclude).length;
    say(`사진 ${added.length}장을 넣었습니다.` + (flagged ? ` 그중 ${flagged}장은 '제외 추천'으로 표시했어요.` : ''));
  };

  const swap = async (files: File[]) => {
    const id = swapId.current;
    swapId.current = null;
    if (!id || !files.length) return;
    const [next] = await readPhotoFiles(files.slice(0, 1), 'upload');
    if (!next) { say('사진을 읽지 못했습니다.'); return; }
    update((d) => { replacePhoto(d, id, next); }, { label: 'photos.replace', merge: false });
    say('사진을 바꿨습니다. 쓰던 자리는 그대로입니다.');
  };

  const rotate = async (p: Photo) => {
    const r = await rotateDataUrl(p.dataUrl);
    if (!r) { say('사진을 돌리지 못했습니다.'); return; }
    update((d) => {
      const x = d.photos.find((y) => y.id === p.id);
      if (!x) return;
      x.dataUrl = r.dataUrl;
      x.width = r.width;
      x.height = r.height;
    }, { label: 'photos.rotate', merge: false });
  };

  const patch = (id: string, part: Partial<Photo>, label: string) =>
    update((d) => {
      const p = d.photos.find((x) => x.id === id);
      if (p) Object.assign(p, part);
    }, { label });

  const big = photos.find((p) => p.id === bigId) ?? null;
  const usable = photos.filter((p) => p.kind !== 'unused').length;
  const flagged = photos.filter((p) => p.exclude).length;

  return (
    <div className="lib">
      <div
        className={'drop drop--lib' + (over ? ' is-over' : '')}
        onClick={() => addRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void addFiles(Array.from(e.dataTransfer.files)); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addRef.current?.click(); } }}
      >
        <b>{busy ? '사진 넣는 중…' : '사진 추가'}</b>
        <span>눌러서 고르거나 사진을 끌어다 놓으세요 · 여러 장 한 번에</span>
      </div>
      <input
        ref={addRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void addFiles(f); }}
      />
      <input
        ref={swapRef} type="file" accept="image/*" hidden
        onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void swap(f); }}
      />

      {msg && <p className="note note--ok">{msg}</p>}

      {photos.length > 0 && (
        <p className="lib__sum">
          사진 {photos.length}장 · 상세페이지에 쓰는 사진 {usable}장
          {flagged > 0 && <> · <b className="lib__flag">제외 추천 {flagged}장</b></>}
        </p>
      )}

      {photos.length > 0 && !compact && <HeroShapePick />}

      <div className="libgrid">
        {photos.map((p, i) => {
          const unused = p.kind === 'unused';
          const open = openId === p.id;
          const warn = !p.exclude ? photoWarning(p) : null;
          return (
            <div
              key={p.id}
              className={'libcard' + (p.kind === 'main' ? ' is-main' : '') + (unused ? ' is-unused' : '') + (p.exclude ? ' is-flag' : '')}
              draggable
              onDragStart={() => { dragId.current = p.id; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = dragId.current;
                dragId.current = null;
                if (from) update((d) => { movePhoto(d, from, p.id); }, { label: 'photos.order', merge: false });
              }}
            >
              <button className="libcard__thumb" onClick={() => setBigId(p.id)} title="크게 보기">
                <img src={p.dataUrl} alt={p.name} decoding="async" loading="lazy" />
                <span className="libcard__no">{i + 1}</span>
                {p.kind === 'main' && <span className="libcard__main">대표</span>}
                <span className="libcard__src">{PHOTO_SOURCE_LABEL[p.source ?? 'upload']}</span>
              </button>

              {p.exclude && (
                <div className="libcard__flag">
                  <b>제외 추천</b>
                  <span>{p.exclude}</span>
                  <div className="libcard__flagacts">
                    <button className="tiny" onClick={() => update((d) => { excludePhoto(d, p.id); }, { label: 'photos.exclude', merge: false })}>빼기</button>
                    <button className="tiny" onClick={() => patch(p.id, { exclude: undefined }, 'photos.keep')}>그대로 쓰기</button>
                  </div>
                </div>
              )}
              {unused && !p.exclude && (
                <div className="libcard__flag libcard__flag--off">
                  <span>상세페이지에 쓰지 않는 사진</span>
                  <button className="tiny" onClick={() => patch(p.id, { kind: 'product' }, 'photos.use')}>다시 쓰기</button>
                </div>
              )}

              <div className="libcard__acts">
                {p.kind !== 'main' && !unused && (
                  <button className="tiny" onClick={() => update((d) => { setMainPhoto(d, p.id); }, { label: 'photos.main', merge: false })}>대표</button>
                )}
                <button className="tiny" onClick={() => { swapId.current = p.id; swapRef.current?.click(); }}>교체</button>
                <button className="tiny" onClick={() => void rotate(p)}>회전</button>
                <button className="tiny" onClick={() => setOpenId(open ? null : p.id)}>{open ? '닫기' : '더보기'}</button>
                <button
                  className="tiny tiny--danger"
                  onClick={() => update((d) => { removePhoto(d, p.id); }, { label: 'photos.remove', merge: false })}
                >삭제</button>
              </div>

              {warn && <p className="photo__warn">{warn}</p>}

              {open && (
                <div className="focus">
                  <label className="field">
                    <span className="field__label">어디에 쓸 사진인가요</span>
                    <select
                      className="mini"
                      value={p.kind}
                      onChange={(e) => {
                        const kind = e.target.value as PhotoKind;
                        if (kind === 'main') update((d) => { setMainPhoto(d, p.id); }, { label: 'photos.main', merge: false });
                        else patch(p.id, { kind }, 'photos.kind');
                      }}
                    >
                      {(Object.keys(PHOTO_KIND_LABEL) as PhotoKind[]).map((k) => (
                        <option key={k} value={k}>{PHOTO_KIND_LABEL[k]}</option>
                      ))}
                    </select>
                  </label>
                  <span className="photo__shape">
                    {shapeOf(p) === 'portrait' ? '세로 사진' : shapeOf(p) === 'landscape' ? '가로 사진' : '정사각형 사진'}
                    {p.resized && ' · 알맞게 줄임'}
                  </span>
                  <select
                    className="mini"
                    value={p.fit}
                    onChange={(e) => patch(p.id, { fit: e.target.value as PhotoFit }, 'photos.fit')}
                    title={FIT_HINT[p.fit]}
                  >
                    {(Object.keys(PHOTO_FIT_LABEL) as PhotoFit[]).map((f) => (
                      <option key={f} value={f}>{PHOTO_FIT_LABEL[f]}</option>
                    ))}
                  </select>
                  <p className="focus__hint">{FIT_HINT[p.fit]}</p>
                  <label className="focus__row">
                    <span>좌우</span>
                    <input type="range" min={0} max={100} value={p.focusX}
                      onChange={(e) => patch(p.id, { focusX: Number(e.target.value) }, 'photos.focusX')} />
                  </label>
                  <label className="focus__row">
                    <span>위아래</span>
                    <input type="range" min={0} max={100} value={p.focusY}
                      onChange={(e) => patch(p.id, { focusY: Number(e.target.value) }, 'photos.focusY')} />
                  </label>
                  <input
                    className="mini mini--text" placeholder="사진 설명 (선택)" value={p.caption}
                    onChange={(e) => patch(p.id, { caption: e.target.value }, 'photos.caption')}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {photos.length > 1 && <p className="field__hint">사진을 끌어서 순서를 바꿀 수 있어요. 사진 속 인물은 원본 그대로 씁니다.</p>}

      {big && (
        <div className="bigphoto" onClick={() => setBigId(null)}>
          <img src={big.dataUrl} alt={big.name} />
          <span>아무 곳이나 누르면 닫힙니다</span>
        </div>
      )}

      {isPro && !compact && <VideoList />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** 대문(대표) 사진을 어떤 모양으로 보여줄지 */
function HeroShapePick() {
  const { project, update } = useProject();
  const main = project.photos.find((p) => p.kind === 'main') ?? project.photos[0];
  const now = project.design.heroShape;
  const advice = main ? recommendHeroShape(main) : null;

  return (
    <div className="heroshape">
      <span className="field__label">대표 사진 모양</span>
      <div className="seg seg--wide">
        {(Object.keys(HERO_SHAPE_LABEL) as HeroShape[]).map((s) => (
          <button
            key={s}
            className={'seg__btn' + (now === s ? ' is-on' : '')}
            onClick={() => update((d) => { d.design.heroShape = s; }, { label: 'design.heroShape', merge: false })}
          >
            {HERO_SHAPE_LABEL[s]}
          </button>
        ))}
      </div>
      {now === 'auto' && advice && (
        <p className="field__hint">지금 대표사진은 {advice}이 잘 어울려요.</p>
      )}
    </div>
  );
}

function VideoList() {
  const { project, update } = useProject();
  const [url, setUrl] = useState('');

  const add = () => {
    const v = url.trim();
    if (!v) return;
    update((d) => { d.videos.push({ id: uid('vid'), url: v, caption: '' }); }, { label: 'video.add', merge: false });
    setUrl('');
  };

  return (
    <div className="videos">
      <span className="field__label">동영상 주소 (선택)</span>
      <div className="videos__row">
        <input
          className="field__input" value={url} placeholder="https://"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button className="btn btn--line" onClick={add}>추가</button>
      </div>
      {project.videos.map((v) => (
        <div key={v.id} className="videos__item">
          <span>{v.url}</span>
          <button
            className="tiny tiny--danger"
            onClick={() => update((d) => { d.videos = d.videos.filter((x) => x.id !== v.id); }, { label: 'video.del', merge: false })}
          >삭제</button>
        </div>
      ))}
    </div>
  );
}
