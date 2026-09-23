import { useEffect, useState } from 'react';
import { fieldProducts } from '@/services/ai/studioPlanner';
import { formatWon } from '@/utils/format';
import { useProject } from '@/store/ProjectStore';
import { useEdition } from '@/store/EditionContext';
import { checkProject, summarize, type CheckItem } from '@/services/export/checkStore';
import { downloadProjectFile } from '@/services/storage/local';
import {
  download, exportSlices, exportWhole, safeName, waitForImages, zipBlobs,
} from '@/services/export/exportImage';
import { SmartStore } from '@/components/export/SmartStore';
import { SmartPlace } from '@/components/export/SmartPlace';
import { buildPayload } from '@/services/smartstore/payload';
import { copyBlocks } from '@/services/smartstore/text';
import { copyText } from '@/utils/copyText';
import { MainImage } from './MainImage';
import { StoreTitle } from './StoreTitle';
import { PageViewer } from './PageViewer';

/*
 * 지금 화면에서는 감춰 둔 것들.
 *
 * 코드와 데이터는 그대로 두고 화면에만 보이지 않게 한다 (나중에 다시 켤 수 있게).
 *  - 등록 글/TXT: 사장님이 직접 옮겨 적을 일이 거의 없어 ④ 저장을 복잡하게만 만들었다
 *  - 등록 도우미: 판매가·사진 개수 같은 관리자형 상태표라 PageMaker 사용자에게는 보여주지 않는다
 */
const SHOW_STORE_TEXT = false;
const SHOW_STORE_HELPER = false;

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
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState<Saved | null>(null);
  const [preview, setPreview] = useState(false);
  /** 여러 장 미리보기 — 실제 저장(exportSlices)과 같은 결과를 그대로 보여준다 */
  const [cuts, setCuts] = useState<Blob[] | null>(null);
  const [gallery, setGallery] = useState(false);
  const [more, setMore] = useState(false);
  const [howStore, setHowStore] = useState(false);
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

  /* 새로 나누지 않는다 — 저장에 쓰는 함수를 그대로 불러 경계가 같게 한다 */
  const previewSplit = async () => {
    const stage = getStage();
    if (!stage) { setErr('상세페이지를 찾지 못했습니다. 화면을 새로고침한 뒤 다시 해주세요.'); return; }
    setBusy('나뉜 모습 만드는 중…');
    setErr('');
    try {
      await waitForImages(stage);
      const { blobs } = await exportSlices(stage, [], opts);
      setCuts(blobs);
    } catch {
      setErr('나뉜 모습을 만들지 못했습니다. 잠시 후 다시 해주세요.');
    } finally {
      setBusy('');
    }
  };

  const saveSplit = () => run('여러 장으로 나누는 중…', async (stage) => {
    const { blobs } = await exportSlices(stage, [], opts);
    const names = blobs.map((_, i) => `${base}_${String(i + 1).padStart(2, '0')}.jpg`);
    blobs.forEach((b, i) => download(b, names[i]));
    return { names, blobs };
  });

  /*
   * 스마트스토어 등록용 글.
   *
   * 새로 글을 만들지 않는다 — 스마트스토어 등록자료(ZIP)가 쓰는 것과 **같은** 추출기를 그대로 쓴다.
   * (buildPayload → copyBlocks) 숨긴 영역은 그 안에서 이미 빠지고, 빈 항목도 나오지 않는다.
   */
  const storeText = () => copyBlocks(buildPayload(project))
    .map((b) => `[${b.label}]\n${b.text}`)
    .join('\n\n');

  const copyStore = async () => {
    setErr('');
    const ok = await copyText(storeText());
    setNotice(ok
      ? '스마트스토어 등록 글을 복사했습니다.'
      : '복사하지 못했습니다. [스마트스토어 등록용 TXT 저장]을 사용해 주세요.');
  };

  const saveStoreTxt = () => {
    setErr('');
    const head = [
      '========================================',
      '스마트스토어 등록용 문구입니다.',
      '',
      '아래 내용을 복사해서',
      '스마트스토어 상품 등록에 사용하세요.',
      '',
      '필요한 부분만 골라서 복사해도 됩니다.',
      '',
      'PageMaker에서 최종 수정한 내용이',
      '반영되어 있습니다.',
      '========================================',
      '',
      '',
    ].join('\n');
    const title = project.product.storeTitle || project.product.name || project.title;
    const name = `스마트스토어_등록용_${safeName(title)}.txt`;
    /* 메모장에서 한글이 깨지지 않도록 BOM 을 붙인다 */
    download(new Blob(['﻿' + head + storeText()], { type: 'text/plain;charset=utf-8' }), name);
    setNotice(`${name} 파일을 저장했습니다.`);
  };

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
            {SHOW_STORE_HELPER && (
              <button className="btn btn--line" onClick={() => setView('helper')}>스마트스토어에 등록하기</button>
            )}
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
        {/* 두 단추는 같은 줄에 나란히 — 자리가 좁아지면 그때만 줄이 바뀐다 */}
        <div className="savehead__acts">
          <button className="btn btn--line" onClick={() => setPreview(true)}>저장 전 최종 미리보기</button>
          <button className="btn btn--line" onClick={() => void previewSplit()} disabled={!!busy}>여러 장 미리보기</button>
          <button className="btn btn--line" onClick={() => setHowStore((v) => !v)} aria-expanded={howStore}>
            스마트스토어 등록 방법
          </button>
        </div>
      </section>

      {howStore && <StoreHowTo />}

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

      {/* 이미지 말고 '글'도 필요하다 — 상세페이지에 쓴 최종 문구를 스마트스토어 입력칸에 그대로 옮기기 위한 것 */}
      {SHOW_STORE_TEXT && (
        <>
          <section className="box">
            <h3 className="box__title">스마트스토어 등록 글</h3>
            <p className="box__hint">상세페이지에 쓴 최종 문구입니다. 숨긴 영역과 빈 항목은 빠집니다.</p>
            <div className="storetext">
              <button className="btn btn--line" onClick={() => void copyStore()}>스마트스토어 등록 글 복사</button>
              <button className="btn btn--line" onClick={saveStoreTxt}>스마트스토어 등록용 TXT 저장</button>
            </div>
          </section>
          {notice && <p className="note note--ok" aria-live="polite">{notice}</p>}
        </>
      )}

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
          {SHOW_STORE_HELPER && isPro && (
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
          {SHOW_STORE_HELPER && (
            <button className="btn btn--line wide" onClick={() => setView('helper')}>스마트스토어·스마트플레이스 등록 도우미</button>
          )}
        </div>
      )}

      {/* 저장이 먼저, 그다음이 스마트스토어 준비 — 상품명과 상품 이미지만 둔다 */}
      <StoreTitle />
      <MainImage />

      {cuts && (
        <SavedGallery
          blobs={cuts}
          title={`여러 장으로 나눈 모습 ${cuts.length}장 — 저장하면 이대로 나뉩니다`}
          onClose={() => setCuts(null)}
        />
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
function SavedGallery({ blobs, onClose, title }: { blobs: Blob[]; onClose: () => void; title?: string }) {
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
          <b>{title ?? `저장한 이미지 ${blobs.length}장`}</b>
          <button className="btn btn--line" onClick={onClose}>닫기</button>
        </header>
        <div className="viewer__scroll savedimgs">
          {urls.map((u, i) => (
            <figure key={u}>
              <img src={u} alt={`저장한 이미지 ${i + 1}`} />
              <figcaption>{i + 1} / {urls.length}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * 스마트스토어에 올리는 방법 — 저장한 뒤 어디에 어떻게 넣는지만 알려준다.
 * 자동 등록은 하지 않는다. 보여주는 값은 지금 고른 촬영분야의 대표 상품 기준이다.
 */
function StoreHowTo() {
  const { project } = useProject();
  const fp = fieldProducts(project);
  const title = (project.product.storeTitle || project.product.name || '').trim();
  const price = fp.rep && fp.rep.main
    ? formatWon(project.product.salePrice || project.pricing?.eventPrice || project.product.listPrice || project.pricing?.listPrice || '')
    : (fp.rep?.price ?? '');

  return (
    <section className="box">
      <h3 className="box__title">스마트스토어에 등록하기</h3>
      <ol style={{ margin: '0 0 12px 18px', padding: 0 }}>
        <li>네이버 스마트스토어센터에서 상품 등록 또는 상품 수정 화면을 엽니다.</li>
        <li>PageMaker에서 저장한 상세페이지 이미지를 상품 상세설명에 등록합니다.</li>
        <li>PageMaker에서 정리한 스마트스토어용 제목 · 상품명 · 가격을 확인해 입력합니다.</li>
        <li>스마트스토어 미리보기에서 이미지와 상품정보를 확인한 뒤 저장합니다.</li>
      </ol>
      <p className="field__label">스마트스토어용 제목</p>
      <p>{title || <span className="field__hint">③ 에서 제목을 골라주세요.</span>}</p>
      <p className="field__label">대표 상품</p>
      <p>{fp.rep?.name || <span className="field__hint">{fp.field ? `${fp.field} 관련 상품을 찾지 못했습니다. ③ 가격 안내에서 골라주세요.` : '상품을 넣어주세요.'}</span>}</p>
      <p className="field__label">가격</p>
      <p>{price || <span className="field__hint">가격을 넣어주세요.</span>}</p>
    </section>
  );
}
