import { useEffect, useMemo, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { Icon } from '@/components/ui/Icon';
import {
  cutHintsOf, download, exportSlices, waitForImages,
} from '@/services/export/exportImage';
import { buildPayload, checkReady, type SmartStorePayload } from '@/services/smartstore/payload';
import { buildZip, plannedNames, zipFileName } from '@/services/smartstore/pack';
import { copyBlocks, fullText } from '@/services/smartstore/text';
import { autoFill, canAutoFill, type FillMode, type PublishStep } from '@/services/smartstore/publish';
import { onPublicAddress } from '@/services/import/baroduTools';

/**
 * 네이버 스마트스토어에 올리기.
 *
 * 두 가지 길이 있고 **둘 다 같은 내용**을 쓴다 (`buildPayload` 한 곳에서 나온다).
 *
 *   1) 스마트스토어 자동입력   — BARODU Tools 가 상품등록 화면에 채워 넣는다
 *   2) 스마트스토어 등록자료 받기 — 사진과 문구를 ZIP 으로 받아 직접 올린다
 *
 * ⚠ 자동입력은 **마지막 등록 단추를 누르지 않는다.** 확인은 사장님 몫이다.
 * ⚠ 등록자료 받기는 BARODU Tools 가 없어도 된다.
 */
export function SmartStore({ getStage }: { getStage: () => HTMLElement | null }) {
  const { project, update } = useProject();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [openCopy, setOpenCopy] = useState(false);
  const [toolsWhy, setToolsWhy] = useState<string>('확인하는 중…');
  const [toolsOk, setToolsOk] = useState(false);
  const [steps, setSteps] = useState<PublishStep[] | null>(null);
  const [failed, setFailed] = useState(false);

  /* 지금 작업에서 올릴 내용 한 벌 — 화면·ZIP·자동입력이 모두 이것만 쓴다 */
  const payload: SmartStorePayload = useMemo(() => buildPayload(project), [project]);
  const blocks = useMemo(() => copyBlocks(payload), [payload]);
  const names = useMemo(() => plannedNames(payload), [payload]);

  /* 상세페이지 장수는 만들어 봐야 정확히 알 수 있다 — 여기서는 메뉴 수로 어림한다 */
  const guessDetail = project.menus.filter((m) => !m.hidden).length;
  const ready = checkReady(payload, guessDetail);

  const checkTools = async () => {
    setToolsWhy('확인하는 중…');
    const r = await canAutoFill();
    setToolsOk(r.ok);
    setToolsWhy(r.ok ? '' : r.reason);
  };

  useEffect(() => { void checkTools(); }, []);

  const say = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(''), 5000);
  };

  /**
   * 글을 복사한다.
   *
   * 브라우저가 새 방식(`navigator.clipboard`)을 막는 경우가 있어
   * **예전 방식으로 한 번 더** 해본다. 두 가지 다 안 될 때만 알린다.
   */
  const copy = async (key: string, text: string) => {
    const done = () => {
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1800);
    };

    try {
      await navigator.clipboard.writeText(text);
      done();
      return;
    } catch {
      /* 아래 예전 방식으로 다시 해본다 */
    }

    try {
      const box = document.createElement('textarea');
      box.value = text;
      /* 화면에 보이지 않게 두되, 선택은 되어야 한다 */
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.top = '0';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      box.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(box);
      if (ok) { done(); return; }
    } catch {
      /* 아래에서 알린다 */
    }

    say('복사하지 못했습니다. 글을 직접 선택해 복사해 주세요.');
  };

  /** 상세페이지 분할 이미지를 지금 만든다 (완성·저장의 분할 JPG 와 같은 방식) */
  const makeDetail = async (): Promise<Blob[]> => {
    const stage = getStage();
    if (!stage) throw new Error('미리보기를 찾지 못했습니다.');
    await waitForImages(stage);
    const { blobs } = await exportSlices(stage, cutHintsOf(stage));
    return blobs;
  };

  const doZip = async () => {
    setBusy('등록자료를 만드는 중…');
    setMsg('');
    /**
     * 상세페이지 이미지는 화면을 그려야 나오기 때문에 실패할 수 있다.
     * 그렇다고 **전부 실패로 돌리지 않는다.** 사진과 문구만이라도 받으시는 게 낫다.
     */
    let detail: Blob[] = [];
    let imageWarn = '';
    try {
      detail = await makeDetail();
    } catch (e) {
      imageWarn = e instanceof Error ? e.message : '상세페이지 이미지를 만들지 못했습니다.';
    }

    try {
      const full: SmartStorePayload = { ...payload, detailImages: detail };
      const zip = await buildZip(full);
      download(zip, zipFileName(full));
      say(
        imageWarn
          ? `사진과 문구는 저장했습니다. 다만 상세페이지 이미지는 만들지 못했습니다 — ${imageWarn}`
          : `등록자료를 저장했습니다. 상세페이지 ${detail.length}장이 들어 있습니다.`,
      );
    } catch (e) {
      say(e instanceof Error ? e.message : '등록자료를 만들지 못했습니다.');
    } finally {
      setBusy('');
    }
  };

  const doAuto = async (mode: FillMode) => {
    setBusy('스마트스토어 준비 중…');
    setMsg('');
    setFailed(false);
    setSteps(null);
    try {
      const detail = await makeDetail();
      const full: SmartStorePayload = { ...payload, detailImages: detail };
      setBusy('스마트스토어에 넣는 중…');
      const r = await autoFill(full, mode);
      setSteps(r.steps ?? []);
      if (r.ok) {
        say('스마트스토어 자동입력이 완료되었습니다. 내용을 확인한 후 직접 등록해주세요.');
      } else {
        setFailed(true);
        say(r.reason || '스마트스토어 자동입력을 완료하지 못했습니다.');
      }
    } catch (e) {
      setFailed(true);
      say(e instanceof Error ? e.message : '스마트스토어 자동입력을 완료하지 못했습니다.');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="ss">
      <header className="ss__head">
        <b>네이버 스마트스토어</b>
        <span>상세페이지를 그대로 상품등록에 씁니다</span>
      </header>

      {/* 등록 준비 상태 — 모르는 것은 아는 척하지 않는다 */}
      {/* 스마트스토어 제목 — 메인 제목과 따로 고친다 */}
      <label className="field">
        <span className="field__label">스마트스토어 제목</span>
        <input
          className="field__input"
          value={project.product.storeTitle ?? project.product.name}
          placeholder="예) 구미 가족사진 부모님과 함께하는 가족촬영"
          onChange={(e) => { const v = e.target.value; update((d) => { d.product.storeTitle = v; }, { label: 'product.storeTitle' }); }}
        />
      </label>

      <ul className="ss__ready">
        {ready.map((r) => (
          <li key={r.label} className={'is-' + r.state}>
            <i>{r.state === 'ok' ? '✓' : r.state === 'check' ? '△' : '·'}</i>
            <b>{r.label}</b>
            <span>{r.note}</span>
          </li>
        ))}
      </ul>

      {/* 1) 자동입력 */}
      <div className="ss__way">
        <button
          className="btn btn--main wide savepick"
          onClick={() => void doAuto('empty-only')}
          disabled={!!busy || !toolsOk}
        >
          <b>스마트스토어 자동입력</b>
          <em>PM Connect가 상품등록 화면을 열고 정보와 사진을 채웁니다</em>
        </button>
        {!toolsOk && toolsWhy && (
          <p className="ss__why">
            {toolsWhy}
            {!onPublicAddress() && (
              <button className="tiny" onClick={() => void checkTools()}>다시 확인</button>
            )}
          </p>
        )}
        <p className="field__hint">
          마지막 <b>등록</b> 단추는 누르지 않습니다. 내용을 확인하신 뒤 직접 눌러주세요.
        </p>
      </div>

      {/* 자동입력 진행 상태 */}
      {steps && steps.length > 0 && (
        <ul className="ss__steps">
          {steps.map((s, i) => (
            <li key={i} className={'is-' + s.state}>
              <i>{s.state === 'done' ? '✓' : s.state === 'fail' ? '!' : '·'}</i>
              {s.label}{s.note ? ` — ${s.note}` : ''}
            </li>
          ))}
        </ul>
      )}

      {/* 실패했을 때 — 작업은 그대로 두고 다른 길을 알려준다 */}
      {failed && (
        <div className="ss__fail">
          <b>스마트스토어 자동입력을 완료하지 못했습니다.</b>
          <span>지금까지 만드신 내용은 그대로 남아 있습니다.</span>
          <div className="ss__fail__acts">
            <button className="btn btn--line" onClick={() => void doAuto('empty-only')} disabled={!!busy}>
              빈 항목만 다시 시도
            </button>
            <button className="btn btn--line" onClick={() => void doAuto('overwrite')} disabled={!!busy}>
              전체 다시 입력
            </button>
            <button className="btn btn--main" onClick={() => void doZip()} disabled={!!busy}>
              등록자료 받아 직접 입력하기
            </button>
          </div>
        </div>
      )}

      {/* 2) 등록자료 받기 */}
      <div className="ss__way">
        <button className="btn btn--line wide savepick" onClick={() => void doZip()} disabled={!!busy}>
          <b>스마트스토어 등록자료 받기</b>
          <em>사진과 복사용 문구를 ZIP 으로 — PM Connect 없이도 됩니다</em>
        </button>
        <p className="field__hint">
          01_대표사진 · 02_추가사진 · 03_상세페이지 · 04_입력문구 순서로 들어 있습니다.
        </p>
      </div>

      {/* 항목별 복사 */}
      <button className="more__btn" onClick={() => setOpenCopy((v) => !v)}>
        {openCopy ? '항목별 복사 닫기' : '항목별로 복사하기'}
      </button>

      {openCopy && (
        <div className="ss__copy">
          {blocks.map((b) => (
            <div key={b.key} className="ss__row">
              <b>{b.label}</b>
              <span title={b.text}>{b.text.split('\n')[0]}</span>
              <button className="tiny" onClick={() => void copy(b.key, b.text)}>
                {copied === b.key ? '복사됨' : '복사'}
              </button>
            </div>
          ))}
          {blocks.length === 0 && (
            <p className="field__hint">아직 복사할 내용이 없습니다. 상품정보를 먼저 채워주세요.</p>
          )}
          <button
            className="btn btn--line wide"
            onClick={() => void copy('__all', fullText(payload))}
          >
            {copied === '__all' ? '복사되었습니다.' : '전체 문구 복사'}
          </button>

          {/* 사진이 어떤 이름으로 올라가는지 미리 보여준다 */}
          {(names.main || names.extra.length > 0) && (
            <div className="ss__names">
              <span className="field__label">올릴 사진 이름</span>
              {names.main && <p>{names.main}</p>}
              {names.extra.slice(0, 3).map((n) => <p key={n}>{n}</p>)}
              {names.extra.length > 3 && <p>… 외 {names.extra.length - 3}장</p>}
              <p className="field__hint">
                올려주신 원본은 그대로 둡니다. 올릴 때 쓸 복사본에만 이름을 붙입니다.
              </p>
            </div>
          )}
        </div>
      )}

      {busy && <p className="note"><Icon name="clipboard" size={14} />{busy}</p>}
      {msg && <p className="note note--ok">{msg}</p>}
    </section>
  );
}
