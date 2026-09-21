import { useEffect, useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import type { Photo, ProjectData, SourceLink } from '@/types/project';
import { makeMenu, uid } from '@/types/defaults';
import {
  checkUrl, collectFromUrl, forgetTools, guessSource, normalizePlaceUrl, photoSrc, SOURCE_LABEL, SOURCE_READINESS, toolsStatus,
  type ToolsStatus,
} from '@/services/import/baroduTools';
import { downloadImages, photoSourceOf } from '@/services/import/downloadImages';
import { parseStudioText } from '@/services/read/parseInfo';
import {
  cardFromFields, cardFromProject, cardLabel, hasBusiness, samePlace, type PlaceCard,
} from '@/services/read/placeIdentity';
import { keepCurrentWork } from '@/services/storage/works';
import { applyField, FIELD_NAMES, selectedField, shootField } from '@/services/ai/studioPlanner';
import { isEmptyProject } from '@/components/flow/steps';
import { EMPTY_STUDIO } from '@/types/studio';
import { applyChange, reviewFields, type FieldChange } from '@/services/read/mergeFields';
import { saveSnapshot, listSnapshots, openSnapshot } from '@/services/storage/snapshots';
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

/** 업체 확인 뒤 고른 것 — add: 지금 작업에 추가 · new: 새 작업 · fresh: 빈 작업의 옛 사진관 정보만 비우고 넣기 · cancel: 아무것도 넣지 않음 */
type PlaceChoice = 'add' | 'new' | 'fresh' | 'cancel';
interface PlaceAsk {
  kind: 'same' | 'different' | 'unknown';
  current: PlaceCard;
  incoming: PlaceCard;
  resolve: (c: PlaceChoice) => void;
}

/**
 * 고른 촬영분야에 맞게 대표 상품·가격·구성을 맞춘다.
 * 가져오기와 기존 값 비교가 끝난 뒤에 부른다 — 칩을 직접 누를 때와 같은 함수를 쓴다.
 */
function syncField(d: ProjectData): void {
  let field = selectedField(d);
  /*
   * 아직 고른 촬영분야가 없으면, 가져온 대표 상품 이름으로 **분명히 알 수 있을 때만** 처음 한 번 골라 둔다.
   * (예: '(평일)가족사진: 액자,헤메,의상포함' → 가족사진)
   * shootField 는 아는 낱말이 없으면 상품 이름을 그대로 돌려주므로, 아는 분야 목록에 있을 때만 쓴다.
   * 사용자가 칩을 누르면 shoot.field 가 채워지고, 그 뒤로는 selectedField 가 먼저 잡혀 여기서 덮어쓰지 않는다.
   */
  if (!field) {
    const guess = shootField(d.shoot?.productName ?? '');
    if (FIELD_NAMES.includes(guess)) field = guess;
  }
  if (field) applyField(d, field);
}

/** 실제로 작업한 내용이 있는지 (예전에 적어둔 사진관 정보만 자동으로 들어온 빈 작업은 아니다) */
function hasWorkContent(p: ProjectData): boolean {
  return !!(p.product.name.trim() || p.photos.length || p.shoot?.productName || p.flow?.recommendedAt
    || (p.sources ?? []).some((x) => x.state === 'ok'));
}

interface ImportReport {
  from: string;
  filled: FieldChange[];
  photos: number;
  flagged: number;
  failedPhotos: number;
  snapshotAt?: number;
}

export function StepPrepare() {
  const { project, update, replace, newProject } = useProject();
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
  /** 새 주소의 업체를 확인하는 중 — 답을 받기 전에는 지금 작업에 아무것도 넣지 않는다 */
  const [placeAsk, setPlaceAsk] = useState<PlaceAsk | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);

  const answerPlace = (c: PlaceChoice) => {
    placeAsk?.resolve(c);
    setPlaceAsk(null);
  };

  /**
   * 새로 가져온 자료의 업체가 지금 작업과 같은지.
   * 같은 업체 → [자료 추가] · 다른 업체 → [새 작업 시작] · 모르면 합치지 않는다.
   */
  const checkPlace = (incoming: PlaceCard): Promise<PlaceChoice> => {
    const now = latest.current;
    const current = cardFromProject(now);
    const ask = (kind: PlaceAsk['kind']) =>
      new Promise<PlaceChoice>((resolve) => setPlaceAsk({ kind, current, incoming, resolve }));

    if (!incoming.placeId && !incoming.name) return ask('unknown');
    if (!hasBusiness(current)) return Promise.resolve('add');
    const same = samePlace(current, incoming);
    /* 작업 내용이 없는 빈 작업 — 묻지 않는다. 다른 업체면 옛 사진관 정보만 비우고 넣는다 */
    if (!hasWorkContent(now)) return Promise.resolve(same === 'same' ? 'add' : 'fresh');
    return ask(same);
  };

  /* 이미 연결돼 있으면 작게 알려주기만 한다. 연결 안 돼 있어도 아무것도 띄우지 않는다. */
  useEffect(() => { void toolsStatus().then(setTools); }, []);

  /* 새 작업은 완전히 빈 상태로 시작한다.
     (예전에는 마지막에 적어둔 사진관 정보를 새 작업에 넣어줬는데, 여러 업체를 만들면
      이전 업체의 이름·전화·주소가 새 작업에 남아 섞였다 — 그래서 넣지 않는다) */

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
      /* 가져온 뒤에도 고른 촬영분야와 대표 상품이 어긋나지 않게 맞춘다 (칩을 누른 것과 같은 상태) */
      syncField(d);
      if (photos.length) {
        const hadMain = d.photos.some((p) => p.kind === 'main');
        d.photos.push(...photos);
        if (!hadMain) {
          /* 최신 소식 이미지는 대표사진이 되지 않는다 — 업체 사진 중에서만 고른다 */
          const first = photos.find((p) => !p.exclude && !p.news) ?? photos.find((p) => !p.news);
          if (first) setMainPhoto(d, first.id);
        }
        /* 최신 소식 첫 이미지 → 상세페이지 맨 위 '최신 소식' 영역 (갤러리·대표사진과 따로) */
        const news = photos.find((p) => p.news);
        if (news) {
          const at = d.menus.findIndex((m) => m.kind === 'news');
          const menu = at >= 0 ? d.menus.splice(at, 1)[0] : makeMenu('news', '이벤트');
          d.menus.unshift({ ...menu, photoIds: [news.id], hidden: false });
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
      /* 업체 번호가 보이는 네이버 주소는 검색어·지도 위치 같은 군더더기를 빼고 보낸다 (naver.me 는 PM Connect 가 푼다) */
      const target = normalizePlaceUrl(checked.url);
      const res = await collectFromUrl(target);
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
      /* 스마트플레이스 최신 소식 게시물의 첫 번째 사진 1장 (PM Connect 가 줄 때만) */
      if (res.newsImage) {
        try {
          const r = await fetch(photoSrc(res.newsImage), { cache: 'reload' });
          const blob = r.ok ? await r.blob() : null;
          if (blob && /^image\//.test(blob.type)) {
            const [news] = await readPhotoFiles([new File([blob], 'latest-news.jpg', { type: blob.type })], 'place');
            if (news) photos.push({ ...news, news: true });
          }
        } catch { /* 못 받으면 맨 위 영역 없이 대표사진부터 시작한다 */ }
      }

      const text = [
        res.title,
        res.description,
        res.text,
        res.sourceType === 'naver-place' ? `네이버 플레이스: ${target}` : '',
      ].filter(Boolean).join('\n');

      /* 스마트플레이스는 먼저 업체를 확인한다 — 확인이 끝나기 전에는 지금 작업에 한 값도 넣지 않는다 */
      if (res.sourceType === 'naver-place') {
        setRow(row.id, { phase: '업체 확인 중…' });
        const incoming = cardFromFields(parseStudioText(text), target);
        const choice = await checkPlace(incoming);
        if (choice === 'cancel') {
          setRow(row.id, { phase: '', error: '가져오지 않았습니다. 지금 작업은 그대로입니다.' });
          continue;
        }
        if (choice === 'new') {
          const now = latest.current;
          if (!(await keepCurrentWork(now, isEmptyProject(now)))) {
            setRow(row.id, { phase: '', error: '지금 작업을 보관하지 못해 새 작업을 시작하지 않았습니다.' });
            continue;
          }
          newProject(false);
          setConflicts([]);
          setReports([]);
          /* 화면이 새 작업을 볼 때까지 기다린다 (다음 단계가 새 작업을 기준으로 비교하도록) */
          await new Promise((r) => window.setTimeout(r, 80));
        }
        if (choice === 'fresh') {
          update((d) => { d.studio = { ...EMPTY_STUDIO }; }, { label: 'studio.clear', merge: false });
          await new Promise((r) => window.setTimeout(r, 30));
        }
        setRow(row.id, { phase: '✓ 네이버 업체 주소를 확인했습니다 · ' + cardLabel(incoming) });
      }

      await merge(SOURCE_LABEL[res.sourceType], text, photos, failed, { ...row, url: target });
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
      update((d) => { applyChange(d, ch, how); syncField(d); }, { label: 'import.resolve', merge: false });
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
      {/* ---------------- 처음 안내 (따로 시작 화면을 두지 않고 여기서 짧게) ---------------- */}
      <div className="prepintro">
        <p className="prepintro__lead">가지고 있는 글과 사진으로 상세페이지를 만들어보세요.</p>
        <p className="prepintro__sub">자료를 불러오거나 직접 입력하면 Page Maker가 기본 구성을 먼저 만들어드립니다.</p>
      </div>

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
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="field__hint">
          네이버지도에서 업체를 연 뒤 공유 → 링크 복사 후 붙여넣으면 가장 정확합니다.{' '}
          <button className="linkbtn" onClick={() => setHowToOpen((v) => !v)}>주소 복사하는 방법</button>
        </p>
        {howToOpen && (
          <ol className="field__hint" style={{ margin: '4px 0 8px 18px', padding: 0 }}>
            <li>네이버지도에서 업체를 엽니다.</li>
            <li>공유를 누릅니다.</li>
            <li>링크 복사 후 PageMaker에 붙여넣습니다.</li>
          </ol>
        )}

        {placeAsk && (
          <section className="box box--ask" role="dialog" aria-label="업체 확인">
            {placeAsk.kind === 'same' && (
              <>
                <h3 className="box__title">같은 업체의 추가 자료로 확인됐습니다.</h3>
                <p>{cardLabel(placeAsk.incoming)}</p>
                <p>현재 작업에 추가할까요?</p>
                <div className="askchoice">
                  <button className="btn btn--main" onClick={() => answerPlace('add')}>자료 추가</button>
                  <button className="btn btn--line" onClick={() => answerPlace('cancel')}>취소</button>
                </div>
              </>
            )}
            {placeAsk.kind === 'different' && (
              <>
                <h3 className="box__title">새로운 업체 주소입니다.</h3>
                <p>현재 작업: <b>{cardLabel(placeAsk.current)}</b></p>
                <p>새 주소: <b>{cardLabel(placeAsk.incoming)}</b></p>
                <p>새 업체로 작업을 시작하시겠어요?</p>
                <div className="askchoice">
                  <button className="btn btn--main" onClick={() => answerPlace('new')}>새 작업 시작</button>
                  <button className="btn btn--line" onClick={() => answerPlace('cancel')}>취소</button>
                </div>
                <p className="field__hint">지금 작업은 [내 작업]에 보관되어 나중에 다시 열 수 있습니다.</p>
              </>
            )}
            {placeAsk.kind === 'unknown' && (
              <>
                <h3 className="box__title">업체 정보를 정확하게 확인하지 못했습니다.</h3>
                <p>네이버지도에서 공유 → 링크 복사 후 다시 붙여넣어 주세요.</p>
                <div className="askchoice">
                  <button className="btn btn--main" onClick={() => { setHowToOpen(true); answerPlace('cancel'); }}>주소 복사하는 방법</button>
                  <button className="btn btn--line" onClick={() => answerPlace('cancel')}>취소</button>
                </div>
              </>
            )}
          </section>
        )}

        <div className="srcacts">
          <button className="btn btn--main" onClick={() => void fetchAll()} disabled={busy}>
            {busy ? '가져오는 중…' : '글과 사진 가져오기'}
          </button>
          <button className="btn btn--line srcacts__add" onClick={() => setDraft((prev) => [...prev, { id: uid('src'), url: '' }])} disabled={busy}>
            + 다른 주소 추가
          </button>
          {tools?.state === 'connected' && <span className="srcready">✓ 네이버 가져오기 준비됨</span>}
        </div>

        {needConnect && tools && (
          <ConnectHelp status={tools} checking={checking} onRecheck={() => void recheck()} onPaste={openPaste} />
        )}

        <p className="srcpaste">
          주소가 없나요?{' '}
          <button className="linkbtn" onClick={() => (pasteOpen ? setPasteOpen(false) : openPaste())}>
            {pasteOpen ? '붙여넣기 닫기' : '내용 붙여넣기'}
          </button>
        </p>

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

      {/* ---------------- 어디부터 하면 되는지 — 셋 중 하나만 하면 된다 ---------------- */}
      <section className="box prepguide">
        <h3 className="box__title">가장 쉬운 방법부터 해보세요.</h3>
        <ol className="prepguide__list">
          <li>
            <span className="prepguide__no" aria-hidden>1</span>
            <span>주소가 있으면 <b>주소만 넣고 [글과 사진 가져오기]</b></span>
          </li>
          <li>
            <span className="prepguide__no" aria-hidden>2</span>
            <span>주소에서 가져오기 어렵다면 <b>[내용 붙여넣기]</b></span>
          </li>
          <li>
            <span className="prepguide__no" aria-hidden>3</span>
            <span>자료가 없다면 <b>아래에서 알고 있는 내용만 직접 입력</b></span>
          </li>
        </ol>
        <p className="prepguide__note">모든 칸을 다 작성하지 않아도 됩니다.</p>
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
