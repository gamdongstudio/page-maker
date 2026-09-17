import { useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import {
  PHOTO_FIT_LABEL, PHOTO_KIND_LABEL,
  type Photo, type PhotoFit, type PhotoKind,
} from '@/types/project';
import { uid } from '@/types/defaults';
import { FIT_HINT, photoWarning, readPhotoFiles, recommendHeroShape, shapeOf, suggestLayout } from '@/utils/image';
import { HERO_SHAPE_LABEL, type HeroShape } from '@/types/project';
import { useEdition } from '@/store/EditionContext';
import { Icon } from '@/components/ui/Icon';
import { removePhoto, setMainPhoto } from '@/utils/photoOps';

/** ② 사진·미디어 */
export function StepMedia() {
  const { project, update } = useProject();
  const { isPro } = useEdition();
  const photos = project.photos;
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  /** 크게 보고 있는 사진 */
  const [bigId, setBigId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const big = photos.find((p) => p.id === bigId) ?? null;

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    const added = await readPhotoFiles(files);
    if (!added.length) return;
    update((d) => {
      /* 첫 사진은 자동으로 대표사진 */
      if (d.photos.length === 0 && added.length > 0) added[0].kind = 'main';
      d.photos.push(...added);
    }, { label: 'photos.add', merge: false });
  };

  const patch = (id: string, part: Partial<Photo>, label: string) =>
    update((d) => {
      const p = d.photos.find((x) => x.id === id);
      if (p) Object.assign(p, part);
    }, { label });

  const remove = (id: string) =>
    update((d) => { removePhoto(d, id); }, { label: 'photos.remove', merge: false });

  const setMain = (id: string) =>
    update((d) => { setMainPhoto(d, id); }, { label: 'photos.main', merge: false });

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    update((d) => {
      const from = d.photos.findIndex((p) => p.id === fromId);
      const to = d.photos.findIndex((p) => p.id === toId);
      if (from < 0 || to < 0) return;
      const [moved] = d.photos.splice(from, 1);
      d.photos.splice(to, 0, moved);
    }, { label: 'photos.order', merge: false });
  };

  return (
    <div className="stack">
      {/* 업로드 */}
      <div
        className={'drop' + (dragOver ? ' is-over' : '')}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <b>사진 올리기</b>
        <span>여기를 누르거나 사진을 끌어다 놓으세요. 여러 장을 한 번에 올릴 수 있어요.</span>
      </div>
      <input
        ref={fileRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => {
          /* value 를 먼저 비우면 FileList 가 사라지므로 반드시 먼저 복사한다 */
          const picked = Array.from(e.target.files ?? []);
          e.target.value = '';
          void addFiles(picked);
        }}
      />

      {photos.length > 0 && (
        <p className="note">
          사진 {photos.length}장 · 추천 배치: <b>{suggestLayout(photos)}</b>
          <br />사진을 끌어서 순서를 바꿀 수 있어요.
          {photos.some((p) => p.resized) && (
            <>
              <br />
              큰 사진은 상세페이지에 알맞은 크기로 자동으로 줄였어요.
              비율 그대로이고 잘라내지 않았습니다.
            </>
          )}
        </p>
      )}

      {photos.length > 0 && <HeroShapePick />}

      {/* 사진 목록 — 한눈에 보이도록 카드로 늘어놓는다 (넓으면 4장씩) */}
      <div className="photos">
        {photos.map((p, i) => {
          const warn = photoWarning(p);
          const open = openId === p.id;
          return (
            <div
              key={p.id}
              className={'photo' + (p.kind === 'main' ? ' is-main' : '') + (open ? ' is-open' : '')}
              draggable
              onDragStart={() => { dragId.current = p.id; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId.current) reorder(dragId.current, p.id); dragId.current = null; }}
              title="끌어서 순서를 바꿀 수 있어요"
            >
              <div className="photo__thumbwrap">
                <img className="photo__thumb" src={p.dataUrl} alt={p.name} />
                <span className="photo__no">{i + 1}</span>
                {p.kind === 'main' && <span className="photo__badge">대표</span>}
                <button
                  className="photo__zoom"
                  onClick={() => setBigId(p.id)}
                  title="크게 보기"
                  aria-label="크게 보기"
                >＋</button>
                <button
                  className="photo__x"
                  onClick={() => remove(p.id)}
                  title="이 사진 지우기"
                  aria-label="이 사진 지우기"
                >×</button>
              </div>

              {/* 어디에 쓸 사진인지 — 카드에서 바로 고른다 */}
              <select
                className="mini"
                value={p.kind}
                title={'사용 위치 · ' + PHOTO_KIND_LABEL[p.kind]}
                onChange={(e) => {
                  const kind = e.target.value as PhotoKind;
                  if (kind === 'main') setMain(p.id);
                  else patch(p.id, { kind }, 'photos.kind');
                }}
              >
                {(Object.keys(PHOTO_KIND_LABEL) as PhotoKind[]).map((k) => (
                  <option key={k} value={k}>{PHOTO_KIND_LABEL[k]}</option>
                ))}
              </select>

              <div className="photo__acts">
                {p.kind !== 'main' && (
                  <button className="tiny" onClick={() => setMain(p.id)} title="대표사진으로">
                    <Icon name="checkCircle" size={13} />대표
                  </button>
                )}
                <button className="tiny" onClick={() => setOpenId(open ? null : p.id)}>
                  <Icon name={open ? 'close' : 'grid'} size={13} />{open ? '닫기' : '더보기'}
                </button>
              </div>

              {warn && <p className="photo__warn">{warn}</p>}

              {open && (
                <div className="focus">
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
                    <input
                      type="range" min={0} max={100} value={p.focusX}
                      onChange={(e) => patch(p.id, { focusX: Number(e.target.value) }, 'photos.focusX')}
                    />
                  </label>
                  <label className="focus__row">
                    <span>위아래</span>
                    <input
                      type="range" min={0} max={100} value={p.focusY}
                      onChange={(e) => patch(p.id, { focusY: Number(e.target.value) }, 'photos.focusY')}
                    />
                  </label>
                  <input
                    className="mini mini--text"
                    placeholder="사진 설명 (선택)"
                    value={p.caption}
                    onChange={(e) => patch(p.id, { caption: e.target.value }, 'photos.caption')}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 크게 보기 */}
      {big && (
        <div className="bigphoto" onClick={() => setBigId(null)}>
          <img src={big.dataUrl} alt={big.name} />
          <span>아무 곳이나 누르면 닫힙니다</span>
        </div>
      )}

      {/* 동영상 (PRO) */}
      {isPro && <VideoList />}
    </div>
  );
}

/** 대문(대표) 사진을 어떤 모양으로 보여줄지 고른다 */
function HeroShapePick() {
  const { project, update } = useProject();
  const main = project.photos.find((p) => p.kind === 'main') ?? project.photos[0];
  const now = project.design.heroShape;
  const advice = main ? recommendHeroShape(main) : null;

  return (
    <div className="heroshape">
      <span className="field__label">대문 사진 모양</span>
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
      <p className="field__hint">
        {now === 'auto' && advice
          ? '지금 대표사진은 ' + advice + '이 잘 어울려요. 자동 추천이 알아서 맞춰 줍니다.'
          : '맨 위 대표사진이 이 모양으로 보입니다. 잘리는 위치는 사진마다 조정할 수 있어요.'}
      </p>
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
