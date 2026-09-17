import { useEffect, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { useEdition } from '@/store/EditionContext';
import { checkProject, summarize, type CheckItem } from '@/services/export/checkStore';
import { downloadProjectFile } from '@/services/storage/local';
import {
  download, exportSlices, exportWhole, safeName, waitForImages, zipBlobs,
} from '@/services/export/exportImage';
import { SmartStore } from '@/components/export/SmartStore';
import { SmartPlace } from '@/components/export/SmartPlace';
import { PageViewer } from './PageViewer';

/**
 * ④ 저장
 *
 * 들어오면 가장 먼저 "완성되었습니다" 를 보여준다. (준비 상태 % 는 보여주지 않는다)
 * 가장 중요한 단추는 둘 — 긴 이미지로 저장 / 여러 장으로 나누어 저장.
 *
 * 저장이 끝나면 확실한 완료 화면을 보여준다.
 * 스마트스토어 등록은 **저장한 뒤에 고르는 선택 기능**이다. (처음부터 설치 이야기를 꺼내지 않는다)
 */

interface Saved {
  names: string[];
  blobs: Blob[];
}

type View = 'choose' | 'done' | 'helper';

export function StepSave({ getStage, onNew }: {
  getStage: () => HTMLElement | null;
  onNew: () => void;
}) {
  const { project } = useProject();
  const { isPro } = useEdition();
  const [view, setView] = useState<View>('choose');
  const [small, setSmall] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState<Saved | null>(null);
  const [preview, setPreview] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [more, setMore] = useState(false);
  const [items, setItems] = useState<CheckItem[] | null>(null);

  const base = safeName(project.product.name || project.title);
  const opts = { scale: small ? 1 : 2 };

  const run = async (label: string, fn: (stage: HTMLElement) => Promise<Saved>) => {
    const stage = getStage();
    if (!stage) { setErr('상세페이지를 찾지 못했습니다. 화면을 새로고침한 뒤 다시 해주세요.'); return; }
    setBusy(label);
    setErr('');
    try {
      await waitForImages(stage);
      const out = await fn(stage);
      setSaved(out);
      setView('done');
    } catch (e) {
      /* 우리말로 된 안내만 그대로 보여주고, 기술적인 오류 글은 보여주지 않는다 */
      const why = e instanceof Error && /[가-힣]/.test(e.message) ? e.message : '이미지를 만들지 못했습니다.';
      setErr(why + ' 작업 내용은 그대로 있습니다. 사진 수를 줄이거나 잠시 후 다시 해주세요.');
    } finally {
      setBusy('');
    }
  };

  const saveLong = () => run('긴 이미지 만드는 중…', async (stage) => {
    const blob = await exportWhole(stage, opts);
    const name = `${base}_전체.jpg`;
    download(blob, name);
    return { names: [name], blobs: [blob] };
  });

  const saveSplit = () => run('여러 장으로 나누는 중…', async (stage) => {
    const { blobs } = await exportSlices(stage, [], opts);
    const names = blobs.map((_, i) => `${base}_${String(i + 1).padStart(2, '0')}.jpg`);
    blobs.forEach((b, i) => download(b, names[i]));
    return { names, blobs };
  });

  const saveZip = () => run('ZIP 으로 묶는 중…', async (stage) => {
    const { blobs } = await exportSlices(stage, [], opts);
    const zip = await zipBlobs(blobs, base);
    const name = `${base}.zip`;
    download(zip, name);
    return { names: [name], blobs };
  });

  if (view === 'helper') {
    return (
      <div className="stack savestep">
        <section className="box">
          <h3 className="box__title">등록 도우미</h3>
          <p className="box__hint">
            상세페이지 제작과 이미지 저장은 설치 없이 사용할 수 있습니다.
            스마트스토어·스마트플레이스에 등록할 때 필요한 글과 사진을 정리해드립니다.
          </p>
          <button className="linkbtn" onClick={() => setView('done')}>저장 완료 화면으로 돌아가기</button>
        </section>
        <p className="usehead">네이버 스마트스토어</p>
        <SmartStore getStage={getStage} />
        <p className="usehead">네이버 스마트플레이스</p>
        <SmartPlace />
      </div>
    );
  }

  if (view === 'done' && saved) {
    return (
      <div className="stack savestep">
        <section className="savedone">
          <b className="savedone__title">저장되었습니다!</b>
          <p>상세페이지가 완성되었습니다.</p>
          <ul className="savedone__files">
            {saved.names.map((n) => <li key={n}>{n}</li>)}
          </ul>
          <p className="field__hint">다운로드 폴더에서 찾으실 수 있어요.</p>
          <div className="savedone__acts">
            <button className="btn btn--main" onClick={() => setGallery(true)}>저장한 이미지 보기</button>
            <button className="btn btn--line" onClick={() => setView('helper')}>스마트스토어에 등록하기</button>
            <button className="btn btn--line" onClick={onNew}>새 상세페이지 만들기</button>
          </div>
          <button className="linkbtn" onClick={() => setView('choose')}>다른 방법으로 또 저장하기</button>
        </section>
        {gallery && <SavedGallery blobs={saved.blobs} onClose={() => setGallery(false)} />}
      </div>
    );
  }

  return (
    <div className="stack savestep">
      <section className="box savehead">
        <b className="savehead__title">상세페이지가 완성되었습니다.</b>
        <p>저장할 방법을 선택해주세요.</p>
        <button className="btn btn--line" onClick={() => setPreview(true)}>저장 전 최종 미리보기</button>
      </section>

      <div className="savebig">
        <button className="savebig__btn" onClick={() => void saveLong()} disabled={!!busy}>
          <b>긴 이미지로 저장</b>
          <em>한 장짜리 긴 그림 · JPG</em>
        </button>
        {isPro ? (
          <button className="savebig__btn savebig__btn--main" onClick={() => void saveSplit()} disabled={!!busy}>
            <b>여러 장으로 나누어 저장</b>
            <em>영역 사이에서 자연스럽게 나눕니다 · 스마트스토어에 올리기 편해요</em>
          </button>
        ) : (
          <p className="field__hint">여러 장으로 나누어 저장은 상세 편집에서 쓸 수 있어요. (⋯ 메뉴 → 상세 편집으로 바꾸기)</p>
        )}
      </div>

      <label className="optline">
        <input type="checkbox" checked={small} onChange={(e) => setSmall(e.target.checked)} />
        <span>
          <b>스마트스토어 권장 크기로 저장</b>
          <em>{small ? '가로 860px로 저장합니다' : '선택하지 않으면 가로 1720px로 더 선명하게 저장합니다'}</em>
        </span>
      </label>

      {busy && <p className="note" aria-live="polite">{busy}</p>}
      {err && <p className="note note--warn">{err}</p>}

      <button className="more__btn" onClick={() => setMore((v) => !v)} aria-expanded={more}>
        {more ? '다른 저장 방법 닫기' : '다른 저장 방법'}
      </button>

      {more && (
        <div className="stack">
          {isPro && (
            <button className="btn btn--line wide savepick" onClick={() => void saveZip()} disabled={!!busy}>
              <b>백업하거나 전달할 때</b>
              <em>ZIP · 나눈 이미지를 한 번에</em>
            </button>
          )}
          <button className="btn btn--line wide savepick" onClick={() => downloadProjectFile(project)}>
            <b>나중에 다시 편집할 때</b>
            <em>작업파일 (.saypage) · 열어서 계속 고칠 수 있습니다</em>
          </button>
          {isPro && (
            <>
              <button className="btn btn--line wide" onClick={() => setItems(checkProject(project))}>스마트스토어 올리기 전 확인</button>
              {items && (
                <div className={'checkbox' + (items.some((i) => i.level === 'warn') ? ' is-warn' : ' is-ok')}>
                  <b>{summarize(items)}</b>
                  {items.length > 0 && (
                    <ul>
                      {items.map((it, i) => (
                        <li key={i} className={it.level === 'warn' ? 'is-warn' : ''}><span>{it.where}</span> {it.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
          <button className="btn btn--line wide" onClick={() => setView(saved ? 'helper' : 'helper')}>스마트스토어·스마트플레이스 등록 도우미</button>
        </div>
      )}

      {preview && (
        <PageViewer
          project={project}
          title="저장 전 최종 미리보기"
          onClose={() => setPreview(false)}
          footer={<span className="field__hint">저장 이미지와 같은 모습입니다. 비어 있는 영역은 빠집니다.</span>}
        />
      )}
    </div>
  );
}

/** 방금 저장한 이미지 보기 */
function SavedGallery({ blobs, onClose }: { blobs: Blob[]; onClose: () => void }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const list = blobs.map((b) => URL.createObjectURL(b));
    setUrls(list);
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, [blobs]);

  return (
    <div className="viewer" role="dialog" aria-label="저장한 이미지">
      <div className="viewer__panel">
        <header className="viewer__head">
          <b>저장한 이미지 {blobs.length}장</b>
          <button className="btn btn--line" onClick={onClose}>닫기</button>
        </header>
        <div className="viewer__scroll savedimgs">
          {urls.map((u, i) => (
            <figure key={u}>
              <img src={u} alt={`저장한 이미지 ${i + 1}`} />
              <figcaption>{i + 1}번째</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
