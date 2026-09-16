import { useEffect, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import {
  toolsStatus, forgetTools, collectFromUrl, checkUrl, guessSource, photoSrc,
  SOURCE_LABEL,
  SOURCE_READINESS, type ImportResult, type ToolsStatus,
} from '@/services/import/baroduTools';
import { BARODU_TOOLS } from '@/config/baroduTools';
import { parseStudioText, type ReadField } from '@/services/read/parseInfo';
import { applyReadFields } from '@/services/read/applyFields';
import { readPhotoFiles } from '@/utils/image';

/**
 * 기존 정보 가져오기 — 링크 한 줄이면 다시 타이핑하지 않아도 된다.
 *
 * 페이지를 실제로 읽어오는 일은 **BARODU Tools** 가 한다. 여기서는 부탁만 한다.
 *   BARODU PAGE MAKER → BARODU Tools → (실제 페이지 읽기)
 *
 * 지키는 것
 *  - 읽어왔다고 **바로 덮어쓰지 않는다.** 확인 화면을 먼저 보여준다.
 *  - 이미 적어두신 값과 다르면 **적어두신 값을 먼저** 둔다.
 *  - 실패해도 지금 작업은 그대로 둔다. 되돌리기 한 번이면 적용 전으로 돌아간다.
 *  - 사진도 전부 넣지 않는다. 골라서 가져온다.
 *  - BARODU Tools 가 없어도 붙여넣기·직접입력은 그대로 쓸 수 있다.
 */

type Phase = '' | '페이지 확인 중…' | '정보 읽는 중…' | '결과 정리 중…' | '사진 가져오는 중…';

export function ImportUrl({ onPaste }: { onPaste: (text: string) => void }) {
  const { project, update, undo } = useProject();
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('');
  const [err, setErr] = useState('');
  const [got, setGot] = useState<ImportResult | null>(null);
  const [fields, setFields] = useState<ReadField[]>([]);
  const [use, setUse] = useState<Record<string, boolean>>({});
  const [products, setProducts] = useState<string[]>([]);
  const [pickedProduct, setPickedProduct] = useState('');
  const [pickedImgs, setPickedImgs] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<{ text: string; note: string; canUndo: boolean } | null>(null);

  /** BARODU Tools 상태 — 조용히 확인한다 */
  const [tools, setTools] = useState<ToolsStatus>({
    state: 'checking', version: '', port: 0, label: '확인 중…',
  });

  useEffect(() => { void toolsStatus().then(setTools); }, []);

  const recheck = async () => {
    forgetTools();
    setTools({ state: 'checking', version: '', port: 0, label: '확인 중…' });
    setTools(await toolsStatus());
  };

  const busy = phase !== '';

  /* ---------------------------------------------------------------- */

  const run = async () => {
    const checked = checkUrl(url);
    if (!checked.ok) { setErr(checked.reason); return; }

    setErr(''); setGot(null); setDone(null);
    setPhase('페이지 확인 중…');

    /* 실제로 읽는 동안에는 상태 글만 바꾼다 — 가짜 진행률은 쓰지 않는다 */
    const tick = window.setTimeout(() => setPhase('정보 읽는 중…'), 900);

    const res = await collectFromUrl(checked.url);
    window.clearTimeout(tick);

    if (!res.ok) {
      setErr(res.reason);
      setPhase('');
      /* 닿지 못한 경우라면 자리를 옮겼을 수 있으니 상태를 다시 본다 */
      if (res.offline) void recheck();
      return;
    }

    setPhase('결과 정리 중…');

    /* 읽어온 글에서 항목을 뽑는 일은 제작기가 한다 (BARODU Tools 는 글과 사진만 준다) */
    const read = parseStudioText([res.title, res.description, res.text].filter(Boolean).join('\n'));
    const found = read.filter((f) => f.value);

    setGot(res);
    setFields(found);

    /* 처음에는 전부 켜두되, 이미 적어두신 값과 다른 것은 꺼둔다 */
    const on: Record<string, boolean> = {};
    found.forEach((f) => { on[f.key] = !conflictOf(f, project); });
    setUse(on);

    /* 촬영상품이 여럿이면 임의로 고르지 않는다 */
    const list = productsIn(res);
    setProducts(list);
    setPickedProduct(list.length === 1 ? list[0] : '');

    setPickedImgs({});
    setPhase('');

    /* 구분하지 못한 문장을 잃지 않도록 읽어온 글 전체를 붙여넣기 칸에도 남긴다 */
    onPaste(res.text);
  };

  /* ---------------------------------------------------------------- */

  /** 고른 항목만 적용 — 되돌리기 한 번이면 적용 전으로 돌아가도록 **한 번에** 넣는다 */
  const apply = async () => {
    const chosen = fields
      .filter((f) => use[f.key])
      .map((f) => (f.key === 'productName' && pickedProduct ? { ...f, value: pickedProduct } : f));
    /* 받아올 때는 BARODU Tools 가 대신 받아주는 주소를 쓴다 (네이버가 직접 받기를 막는다) */
    const picked = (got?.images ?? []).filter((im) => pickedImgs[im.url]).map(photoSrc);

    if (chosen.length === 0 && picked.length === 0) {
      setErr('가져올 항목을 하나 이상 골라주세요.');
      return;
    }
    setErr('');

    /* 사진은 먼저 받아둔다 — 받은 뒤에 한 번만 바꿔야 되돌리기가 한 단계가 된다 */
    let photos: Awaited<ReturnType<typeof readPhotoFiles>> = [];
    if (picked.length) {
      setPhase('사진 가져오는 중…');
      photos = await readPhotoFiles(await downloadAsFiles(picked));
      setPhase('');
    }

    update((d) => {
      if (chosen.length) applyReadFields(d, chosen);
      if (photos.length) d.photos.push(...photos);
    }, { label: 'import.apply', merge: false });

    const failed = picked.length - photos.length;
    setDone({
      text: photos.length
        ? `정보 ${chosen.length}개와 사진 ${photos.length}장을 가져왔습니다.`
        : `정보 ${chosen.length}개를 가져왔습니다.`,
      /* 네이버처럼 사진을 밖에서 받아가지 못하게 막아둔 곳이 있다. 그대로 알린다. */
      note: failed > 0
        ? `사진 ${failed}장은 그 사이트가 받아가지 못하게 막아두었습니다. `
          + '그 사진은 저장해서 ② 사진에서 직접 올려주세요.'
        : '',
      canUndo: true,
    });
  };

  /** 적용 전으로 되돌리기 — 기존 실행취소를 그대로 쓴다 */
  const revert = () => {
    undo();
    setDone(null);
  };

  /* ---------------------------------------------------------------- */

  const needTools = tools.state === 'not-installed' || tools.state === 'stopped';

  /* 주소를 보고 어디인지 미리 알려준다 (안내용일 뿐 — 이것으로 막지는 않는다) */
  const checkedUrl = checkUrl(url);
  const source = url.trim() ? guessSource(checkedUrl.ok ? checkedUrl.url : url) : null;

  return (
    <div className="stack importbox">
      {/* 상태 — 아주 작게만 */}
      <p className="field__hint importstate">
        <i className={'importstate__dot is-' + tools.state} />
        {tools.label}
        {tools.state === 'connected' && tools.version ? ` · ${tools.version}` : ''}
        {needTools && (
          <button className="linkbtn" onClick={() => void recheck()}>다시 확인</button>
        )}
      </p>

      <div className="importrow">
        <input
          className="field__input"
          value={url}
          placeholder="기존 페이지 주소를 붙여넣어 주세요"
          onChange={(e) => { setUrl(e.target.value); if (err) setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) { e.preventDefault(); void run(); } }}
        />
        <button className="btn btn--line" onClick={() => void run()} disabled={busy || !url.trim()}>
          {busy ? '가져오는 중…' : '불러오기'}
        </button>
      </div>

      <p className="field__hint">
        블로그 · 스마트플레이스 · 스마트스토어 · 인스타그램 · 홈페이지 주소를 넣으시면
        <b> 어디 주소인지 알아서 판단</b>합니다.
      </p>

      {/* 주소를 보고 어디인지 알려주고, **지금 얼마나 잘 읽는지**도 솔직하게 알린다 */}
      {source && !busy && !got && (
        <p className={'field__hint' + (SOURCE_READINESS[source].level === 'partial' ? ' is-warn' : '')}>
          <b>{SOURCE_LABEL[source]}</b> 주소로 보입니다. {SOURCE_READINESS[source].note}
        </p>
      )}

      {phase && <p className="note">{phase}</p>}

      {/* BARODU Tools 가 없을 때 — 화면을 막지 않고 이 자리에서만 알린다 */}
      {needTools && !busy && (
        <div className="note note--warn">
          {tools.state === 'stopped' ? (
            <>
              <b>BARODU Tools가 꺼져 있습니다.</b>
              <br />시작 메뉴에서 <b>BARODU Tools</b>를 실행한 뒤 <b>다시 확인</b>을 눌러주세요.
              <br /><span className="field__hint">
                제작기가 다른 프로그램을 대신 켤 수는 없습니다.
              </span>
            </>
          ) : (
            <>
              <b>BARODU Tools가 필요합니다.</b>
              <br />네이버 블로그, 스마트플레이스, 기존 홈페이지에서 정보를 가져오려면
              링크에서 기존 정보를 자동으로 가져오려면 BARODU Tools가 필요합니다.
              한 번 설치하면 블로그 자동화 등 다른 BARODU 기능에서도 함께 사용할 수 있습니다.
              <br /><span className="field__hint">
                한 번 설치하면 이후 BARODU 프로그램에서 함께 사용할 수 있습니다.
              </span>
              <br />
              {BARODU_TOOLS.installerUrl ? (
                <a className="btn btn--line" href={BARODU_TOOLS.installerUrl} target="_blank" rel="noreferrer">
                  BARODU Tools 설치
                </a>
              ) : (
                <span className="field__hint">
                  설치파일: <code>{BARODU_TOOLS.installerFileName}</code>
                  <br />설치가 끝나면 <b>다시 확인</b>을 눌러주세요.
                </span>
              )}
            </>
          )}
          <br /><br />
          아래 <b>내용 붙여넣기</b>와 <b>사진 직접 추가</b>는 지금도 그대로 쓸 수 있습니다.
        </div>
      )}

      {tools.state === 'old-version' && (
        <p className="note note--warn">
          <b>BARODU Tools 업데이트가 필요합니다.</b> (지금 {tools.version} · 필요 {BARODU_TOOLS.minVersion})
          <br />BARODU Tools 아이콘 → 업데이트 확인을 눌러주세요.
        </p>
      )}

      {tools.state === 'not-ready' && (
        <p className="note note--warn">
          BARODU Tools는 켜져 있지만 <b>읽기 도구가 준비되지 않았습니다.</b>
          <br />BARODU Tools를 다시 설치하면 해결됩니다.
        </p>
      )}

      {err && (
        <div className="note note--warn">
          {err}
          <br />현재 작업은 그대로 유지됩니다.
          <div className="importerr__btns">
            <button className="btn btn--line" onClick={() => void run()} disabled={busy || !url.trim()}>
              다시 시도
            </button>
            <button className="btn btn--line" onClick={() => onPaste('')}>
              내용 직접 붙여넣기
            </button>
          </div>
        </div>
      )}

      {/* ---------------- 가져온 정보 확인 ---------------- */}
      {got && (
        <div className="importres">
          <p className="plan__source">
            {SOURCE_LABEL[got.sourceType]}에서 가져옴 · {cleanTitle(got.title) || got.url}
          </p>

          {products.length > 1 && (
            <>
              <h4 className="importres__h">가져올 촬영상품 선택</h4>
              <div className="chiprow">
                {products.map((p) => (
                  <button
                    key={p}
                    className={'chip' + (pickedProduct === p ? ' is-on' : '')}
                    onClick={() => setPickedProduct(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}

          {fields.length > 0 ? (
            <>
              <h4 className="importres__h">가져온 정보 확인</h4>
              <p className="field__hint">적용할 항목만 켜주세요. 적용 전에는 아무것도 바뀌지 않습니다.</p>
              <div className="stack">
                {fields.map((f) => {
                  const conflict = conflictOf(f, project);
                  const value = f.key === 'productName' && pickedProduct ? pickedProduct : f.value;
                  return (
                    <label key={f.key} className={'importitem' + (use[f.key] ? ' is-on' : '')}>
                      <input
                        type="checkbox" checked={!!use[f.key]}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setUse((prev) => ({ ...prev, [f.key]: on }));
                        }}
                      />
                      <span>
                        <b>{f.label}</b>
                        <em>{value}</em>
                        {conflict && (
                          <i className="importitem__warn">
                            지금 적어두신 값: {conflict}
                            <br />꺼두면 적어두신 값을 그대로 둡니다. 켜면 가져온 값으로 바뀝니다.
                          </i>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="menu__hint">
              이 페이지에서 상호·가격 같은 정보를 찾지 못했습니다.
              읽어온 글은 아래 붙여넣기 칸에 넣어뒀으니 직접 고쳐 쓰셔도 됩니다.
            </p>
          )}

          {got.images.length > 0 && (
            <>
              <h4 className="importres__h">사진 {got.images.length}장을 찾았습니다</h4>
              <p className="field__hint">쓰실 사진만 골라주세요. 고른 사진은 ② 사진에서 관리합니다.</p>
              <div className="importpics">
                {got.images.slice(0, 24).map((im) => (
                  <button
                    key={im.url}
                    className={'importpic' + (pickedImgs[im.url] ? ' is-on' : '')}
                    /* 이전 상태를 받아서 바꾼다 — 빠르게 여러 장 누르면 앞의 선택이 사라지던 문제 */
                    onClick={() => setPickedImgs((prev) => ({ ...prev, [im.url]: !prev[im.url] }))}
                    title={`${im.width}×${im.height}`}
                  >
                    {/* 미리보기와 '파일로 받기'가 같은 방식으로 요청해야
                        브라우저가 담아둔 답을 서로 다시 쓸 때 막히지 않는다 */}
                    <img src={photoSrc(im)} alt={im.alt || ''} loading="lazy" crossOrigin="anonymous" />
                    {pickedImgs[im.url] && <i>선택</i>}
                  </button>
                ))}
              </div>
            </>
          )}

          <button className="btn btn--main wide" onClick={() => void apply()} disabled={busy}>
            선택한 내용 적용
          </button>
          <p className="field__hint">
            적용해도 실행취소(Ctrl+Z)로 되돌릴 수 있습니다.
          </p>
        </div>
      )}

      {/* ---------------- 적용 뒤 ---------------- */}
      {done && (
        <div className="note note--ok">
          <b>{done.text}</b>
          {done.note && <><br /><span className="field__hint">{done.note}</span></>}
          <br /><span className="field__hint">
            이어서 <b>빈칸 채우기</b>로 나머지를 채우거나, 아래 단계에서 직접 고치셔도 됩니다.
          </span>
          <div className="importerr__btns">
            <button className="btn btn--line" onClick={revert}>적용 전으로 돌아가기</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * 페이지 제목을 화면에 보여줄 수 있게 다듬는다.
 * 사이트에 따라 눈에 보이지 않는 이상한 글자나 ' : 네이버' 같은 꼬리표가 붙어 온다.
 */
function cleanTitle(title: string): string {
  return (title ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[ -]/g, '')
    .replace(/\s*[:|]\s*(네이버|NAVER)\s*$/i, '')
    .trim();
}

/** 읽어온 글에서 촬영상품 이름을 모은다 — 여럿이면 사용자가 고른다 */
const PRODUCT_WORDS = [
  '가족사진', '프로필사진', '증명사진', '취업사진', '아기사진', '스냅사진',
  '복원사진', '장수사진', '반려동물사진', '웨딩사진', '돌사진', '백일사진',
  '한복사진', '여권사진', '비자사진',
];

function productsIn(got: ImportResult): string[] {
  const hay = [got.title, got.description, got.text].filter(Boolean).join('\n');
  return PRODUCT_WORDS.filter((w) => hay.includes(w));
}

/** 이미 적어두신 값이 있고 가져온 값과 다르면 그 값을 돌려준다 */
function conflictOf(f: ReadField, p: ReturnType<typeof useProject>['project']): string {
  const now: Record<string, string> = {
    shopName: p.studio?.name ?? p.product.brand ?? '',
    area: p.studio?.area ?? '',
    address: p.studio?.address ?? '',
    phone: p.studio?.phone ?? '',
    hours: p.studio?.hours ?? '',
    offDays: p.studio?.offDays ?? '',
    bookingUrl: p.studio?.bookingUrl ?? '',
    productName: p.shoot?.productName ?? '',
    listPrice: p.product.listPrice,
    eventPrice: p.product.salePrice,
  };
  const before = (now[f.key] ?? '').trim();
  return before && before !== f.value.trim() ? before : '';
}

/** 고른 사진만 받아와 파일로 만든다 (기존 사진 넣기 기능을 그대로 쓰기 위해) */
async function downloadAsFiles(urls: string[]): Promise<File[]> {
  const out: File[] = [];
  const seen = new Set<string>();

  for (const u of urls.slice(0, 20)) {
    /*
     * 같은 사진이 여러 번 나오면 한 번만.
     * BARODU Tools 가 대신 받아주는 주소는 **앞부분이 모두 같고** 진짜 주소가 뒤에 붙는다.
     * 그래서 앞부분만 보고 견주면 사진이 전부 한 장으로 합쳐져 버린다.
     */
    const key = originalOf(u);
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      /*
       * 담아둔 답을 쓰지 않고 새로 받는다.
       * 미리보기(`<img>`)가 먼저 받아 둔 답이 남아 있으면,
       * 파일로 받을 때 "허락 표시가 없다"며 막히는 일이 있었다.
       */
      const res = await fetch(u, { cache: 'reload' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!/^image\//.test(blob.type)) continue;
      out.push(new File([blob], fileNameOf(key, blob.type), { type: blob.type }));
    } catch {
      /* 못 받아오는 사진은 건너뛴다 */
    }
  }
  return out;
}

/** 대신 받아주는 주소라면 그 안에 든 진짜 사진 주소를 꺼낸다 */
function originalOf(u: string): string {
  try {
    const parsed = new URL(u, window.location.href);
    const inner = parsed.searchParams.get('url');
    return inner ? inner.split('?')[0] : parsed.origin + parsed.pathname;
  } catch {
    return u.split('?')[0];
  }
}

/** 파일 이름을 만든다 — 확장자가 없으면 받은 형식으로 붙인다 */
function fileNameOf(originalUrl: string, mime: string): string {
  const base = (originalUrl.split('/').pop() || 'photo').split('?')[0] || 'photo';
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return `${base}.${ext}`;
}
