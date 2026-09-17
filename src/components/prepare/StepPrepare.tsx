import { useEffect, useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import type { Photo, ProjectData, SourceLink } from '@/types/project';
import { uid } from '@/types/defaults';
import {
  checkUrl, collectFromUrl, forgetTools, guessSource, SOURCE_LABEL, SOURCE_READINESS, toolsStatus,
  type ToolsStatus,
} from '@/services/import/baroduTools';
import { downloadImages, photoSourceOf } from '@/services/import/downloadImages';
import { parseStudioText } from '@/services/read/parseInfo';
import { applyChange, reviewFields, type FieldChange } from '@/services/read/mergeFields';
import { saveSnapshot, listSnapshots, openSnapshot } from '@/services/storage/snapshots';
import { loadStudio } from '@/services/storage/studio';
import { readPhotoFiles } from '@/utils/image';
import { reviewPhotos } from '@/utils/photoCheck';
import { setMainPhoto } from '@/utils/photoOps';
import { PhotoLibrary } from '@/components/media/PhotoLibrary';
import { ConnectHelp } from './ConnectHelp';
import { ContentFields } from './ContentFields';

/**
 * ① 자료 준비
 *
 *   위: 가지고 있는 페이지 주소 → [글과 사진 가져오기] (여러 개 가능)
 *   가운데: 늘 보이는 입력칸 — 가져오면 채워지고, 없으면 직접 쓴다
 *   아래: 상세페이지에 사용할 사진 (가져온 사진 + 올린 사진 한 곳)
 *
 * 사용자에게 "자동으로 할지 직접 할지" 고르게 하지 않는다.
 * 안에서는 주소 가져오기 → 내용 붙여넣기 → 직접 입력 세 길이 있지만 한 화면에서 자연스럽게 이어진다.
 */

type RowState = { phase: string; error?: string; offline?: boolean };

interface ImportReport {
  from: string;
  filled: FieldChange[];
  photos: number;
  flagged: number;
  failedPhotos: number;
  snapshotAt?: number;
}

export function StepPrepare() {
  const { project, update, replace } = useProject();
  const latest = useRef(project);
  latest.current = project;

  const rows: SourceLink[] = project.sources?.length ? project.sources : [];
  const [draft, setDraft] = useState<SourceLink[]>(() => (rows.length ? rows : [{ id: uid('src'), url: '' }]));
  const [state, setState] = useState<Record<string, RowState>>({});
  const [busy, setBusy] = useState(false);
  const [tools, setTools] = useState<ToolsStatus | null>(null);
  const [needConnect, setNeedConnect] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [conflicts, setConflicts] = useState<FieldChange[]>([]);
  const [reports, setReports] = useState<ImportReport[]>([]);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  /* 이미 연결돼 있으면 작게 알려주기만 한다. 연결 안 돼 있어도 아무것도 띄우지 않는다. */
  useEffect(() => { void toolsStatus().then(setTools); }, []);

  /* 사진관 정보를 예전에 적어두셨다면 새 작업에도 가져온다 (비어 있을 때만) */
  useEffect(() => {
    if (latest.current.studio?.name) return;
    void loadStudio().then((s) => {
      if (!s.name && !s.phone) return;
      if (latest.current.studio?.name) return;
      update((d) => {
        d.studio = { ...s };
        if (!d.product.brand) d.product.brand = s.name;
      }, { label: 'studio.restore', merge: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRow = (id: string, s: RowState | null) =>
    setState((prev) => {
      const next = { ...prev };
      if (s) next[id] = s; else delete next[id];
      return next;
    });

  const openPaste = () => {
    setPasteOpen(true);
    window.setTimeout(() => pasteRef.current?.focus(), 50);
  };

  /** 가져온 글·사진을 작업에 합친다 — 빈칸만 바로 채우고 다른 값은 물어본다 */
  const merge = async (from: string, text: string, photos: Photo[], failedPhotos: number, link?: SourceLink) => {
    const fields = parseStudioText(text).filter((f) => f.value);
    const now = latest.current;
    const { fill, conflicts: ask } = reviewFields(fields, now);

    await saveSnapshot(now, `${from} 가져오기 전`);
    const snaps = await listSnapshots();

    update((d) => {
      fill.forEach((ch) => applyChange(d, ch, 'fill'));
      if (photos.length) {
        const hadMain = d.photos.some((p) => p.kind === 'main');
        d.photos.push(...photos);
        if (!hadMain) {
          const first = photos.find((p) => !p.exclude) ?? photos[0];
          setMainPhoto(d, first.id);
        }
      }
      if (link) {
        const list = [...(d.sources ?? [])];
        const i = list.findIndex((x) => x.id === link.id);
        const item: SourceLink = { ...link, state: 'ok', at: Date.now() };
        if (i >= 0) list[i] = item; else list.push(item);
        d.sources = list;
      }
    }, { label: 'import.merge', merge: false });

    /* 같은 칸을 두 번 묻지 않는다 — 새로 물어볼 것으로 바꿔 끼운다 */
    setConflicts((prev) => [...prev.filter((c) => !ask.some((a) => a.key === c.key)), ...ask]);
    setReports((prev) => [{
      from,
      filled: fill,
      photos: photos.length,
      flagged: photos.filter((p) => p.exclude).length,
      failedPhotos,
      snapshotAt: snaps[0]?.at,
    }, ...prev].slice(0, 4));

    /* 다음 주소를 합칠 때 방금 넣은 값을 보도록 화면이 한 번 그려지길 기다린다 */
    await new Promise((r) => window.setTimeout(r, 30));
  };

  /** 주소들에서 글과 사진 가져오기 */
  const fetchAll = async () => {
    const targets = draft.filter((r) => r.url.trim());
    if (!targets.length) {
      setRow(draft[0].id, { phase: '', error: '주소를 넣어주세요. 주소가 없으면 아래 칸에 직접 입력하셔도 됩니다.' });
      return;
    }

    /* 연결부터 확인 — 안 돼 있으면 이때 처음으로 안내한다 */
    setBusy(true);
    const st = await toolsStatus();
    setTools(st);
    if (st.state !== 'connected') {
      setNeedConnect(true);
      setBusy(false);
      return;
    }
    setNeedConnect(false);

    for (const row of targets) {
      const checked = checkUrl(row.url);
      if (!checked.ok) { setRow(row.id, { phase: '', error: checked.reason }); continue; }

      setRow(row.id, { phase: '글 가져오는 중…' });
      const res = await collectFromUrl(checked.url);
      if (!res.ok) {
        setRow(row.id, {
          phase: '',
          offline: res.offline,
          error: res.offline
            ? '연결이 끊어졌습니다. 연결 확인 후 다시 시도하거나, 내용 붙여넣기로 계속할 수 있습니다.'
            : '이 페이지의 자료를 자동으로 가져오지 못했습니다. 내용 붙여넣기로 계속할 수 있습니다.',
        });
        if (res.offline) setNeedConnect(true);
        update((d) => {
          const list = [...(d.sources ?? [])];
          const i = list.findIndex((x) => x.id === row.id);
          const item: SourceLink = { ...row, url: checked.url, state: 'fail', at: Date.now() };
          if (i >= 0) list[i] = item; else list.push(item);
          d.sources = list;
        }, { label: 'sources', merge: false });
        continue;
      }

      setRow(row.id, { phase: '사진 정리 중…' });
      const { files, failed } = await downloadImages(res, 20);
      const read = await readPhotoFiles(files, photoSourceOf(res.sourceType));
      const photos = await reviewPhotos(read, latest.current.photos);

      setRow(row.id, { phase: '정리하는 중…' });
      await merge(
        SOURCE_LABEL[res.sourceType],
        [res.title, res.description, res.text].filter(Boolean).join('\n'),
        photos,
        failed,
        { ...row, url: checked.url },
      );
      setRow(row.id, { phase: '완료' });
    }
    setBusy(false);
  };

  const recheck = async () => {
    setChecking(true);
    forgetTools();
    const st = await toolsStatus();
    setTools(st);
    setChecking(false);
    if (st.state === 'connected') {
      setNeedConnect(false);
      void fetchAll();
    }
  };

  const doPaste = async () => {
    const text = pasteText.trim();
    if (!text) return;
    setBusy(true);
    await merge('붙여넣은 내용', text, [], 0);
    setBusy(false);
    setPasteText('');
    setPasteOpen(false);
  };

  const resolve = (ch: FieldChange, how: 'replace' | 'append' | 'skip') => {
    if (how !== 'skip') {
      update((d) => { applyChange(d, ch, how); }, { label: 'import.resolve', merge: false });
    }
    setConflicts((prev) => prev.filter((c) => c.key !== ch.key));
  };

  const undoImport = async (at?: number) => {
    if (!at) return;
    const data = await openSnapshot(at);
    if (!data) return;
    if (!confirm('가져오기 전 모습으로 되돌릴까요? 그 뒤에 고친 내용도 함께 돌아갑니다.')) return;
    replace(data as ProjectData);
    setReports([]);
    setConflicts([]);
  };

  return (
    <div className="stack prepare">
      {/* ---------------- 주소 ---------------- */}
      <section className="box">
        <h3 className="box__title">가지고 있는 페이지가 있다면 주소를 넣어주세요.</h3>
        <p className="box__hint">글과 사진을 찾아 정리해드립니다.</p>

        <div className="srclist">
          {draft.map((row, i) => {
            const st = state[row.id];
            const src = row.url.trim() ? guessSource(checkUrl(row.url).ok ? (checkUrl(row.url) as { url: string }).url : row.url) : null;
            return (
              <div key={row.id} className="srcrow">
                <div className="srcrow__line">
                  <input
                    className="field__input"
                    value={row.url}
                    placeholder={i === 0 ? '예) 네이버 블로그·스마트플레이스·홈페이지 주소' : '다른 주소'}
                    aria-label={`주소 ${i + 1}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft((prev) => prev.map((x) => (x.id === row.id ? { ...x, url: v } : x)));
                      setRow(row.id, null);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !busy) { e.preventDefault(); void fetchAll(); } }}
                  />
                  {draft.length > 1 && (
                    <button
                      className="tiny"
                      onClick={() => setDraft((prev) => prev.filter((x) => x.id !== row.id))}
                      aria-label="이 주소 빼기"
                    >빼기</button>
                  )}
                </div>
                {src && !st && (
                  <span className={'field__hint' + (SOURCE_READINESS[src].level === 'partial' ? ' is-warn' : '')}>
                    {SOURCE_LABEL[src]} · {SOURCE_READINESS[src].note}
                  </span>
                )}
                {st?.phase && <span className={'srcrow__state' + (st.phase === '완료' ? ' is-ok' : '')}>{st.phase}</span>}
                {st?.error && (
                  <div className="note note--warn">
                    {st.error}
                    {!st.offline && (
                      <div className="importerr__btns">
                        <button className="btn btn--line" onClick={openPaste}>내용 붙여넣기</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="srcacts">
          <button className="btn btn--main" onClick={() => void fetchAll()} disabled={busy}>
            {busy ? '가져오는 중…' : '글과 사진 가져오기'}
          </button>
          <button className="btn btn--line" onClick={() => setDraft((prev) => [...prev, { id: uid('src'), url: '' }])} disabled={busy}>
            + 다른 주소 추가
          </button>
          {tools?.state === 'connected' && <span className="srcready">✓ 네이버 가져오기 준비됨</span>}
        </div>

        {needConnect && tools && (
          <ConnectHelp status={tools} checking={checking} onRecheck={() => void recheck()} onPaste={openPaste} />
        )}

        <button className="linkbtn srcpaste" onClick={() => (pasteOpen ? setPasteOpen(false) : openPaste())}>
          {pasteOpen ? '내용 붙여넣기 닫기' : '주소 대신 글을 붙여넣을래요 (내용 붙여넣기)'}
        </button>

        {pasteOpen && (
          <div className="stack pastebox">
            <textarea
              ref={pasteRef}
              className="field__input"
              rows={6}
              value={pasteText}
              aria-label="내용 붙여넣기"
              placeholder={'페이지의 글을 복사해서 그대로 붙여넣으세요.\n예)\n오늘사진관 / 경기도 광명시 오리로 000\n전화 02-000-0000\n가족사진 4인 기준 정상가 250,000원 → 이벤트가 189,000원'}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button className="btn btn--main" onClick={() => void doPaste()} disabled={busy || !pasteText.trim()}>
              {busy ? '정리하는 중…' : '정리해서 넣기'}
            </button>
            <p className="field__hint">찾은 내용은 아래 칸에 들어갑니다. 이미 적어두신 내용은 바꾸기 전에 여쭤봅니다.</p>
          </div>
        )}
      </section>

      {/* ---------------- 가져온 결과 ---------------- */}
      {reports.map((r, i) => (
        <div key={i} className="note note--ok importdone">
          <b>{r.from}에서 가져왔습니다.</b>
          <span>
            {r.filled.length ? `채운 칸 ${r.filled.length}개 (${r.filled.map((f) => f.label).join(' · ')})` : '새로 채운 칸은 없습니다'}
            {r.photos ? ` · 사진 ${r.photos}장` : ''}
            {r.flagged ? ` (제외 추천 ${r.flagged}장)` : ''}
          </span>
          {r.failedPhotos > 0 && (
            <span className="field__hint">사진 {r.failedPhotos}장은 그 사이트가 받아가지 못하게 막아두었습니다. 필요하면 직접 저장해서 올려주세요.</span>
          )}
          {i === 0 && r.snapshotAt && (
            <button className="linkbtn" onClick={() => void undoImport(r.snapshotAt)}>가져오기 전으로 되돌리기</button>
          )}
        </div>
      ))}

      {conflicts.length > 0 && (
        <section className="box box--ask">
          <h3 className="box__title">이미 적어두신 내용과 다른 정보가 있습니다</h3>
          <p className="box__hint">어떻게 할지 골라주세요. 고르기 전에는 적어두신 내용이 그대로입니다.</p>
          {conflicts.map((c) => (
            <div key={c.key} className="ask">
              <b className="ask__label">{c.label}</b>
              <div className="ask__vals">
                <span><em>기존</em>{c.current}</span>
                <span><em>새 자료</em>{c.incoming}</span>
              </div>
              <div className="ask__acts">
                {c.text && <button className="btn btn--line" onClick={() => resolve(c, 'append')}>추가</button>}
                <button className="btn btn--line" onClick={() => resolve(c, 'replace')}>기존 내용 바꾸기</button>
                <button className="btn btn--quiet" onClick={() => resolve(c, 'skip')}>무시</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ---------------- 입력칸 ---------------- */}
      <section className="box">
        <h3 className="box__title">상세페이지에 들어갈 내용</h3>
        <p className="box__hint">가져온 내용은 여기에 채워집니다. 없으면 알고 있는 것만 적으셔도 됩니다.</p>
        <ContentFields mode="prepare" />
      </section>

      {/* ---------------- 사진 ---------------- */}
      <section className="box">
        <h3 className="box__title">상세페이지에 사용할 사진</h3>
        <p className="box__hint">가져온 사진과 직접 올린 사진을 한 곳에서 관리합니다.</p>
        <PhotoLibrary compact />
      </section>
    </div>
  );
}
