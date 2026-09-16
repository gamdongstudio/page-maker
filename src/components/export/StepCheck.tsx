import { useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { useEdition } from '@/store/EditionContext';
import { checkProject, summarize, type CheckItem } from '@/services/export/checkStore';
import { downloadProjectFile } from '@/services/storage/local';
import {
  cutHintsOf, download, exportSlices, exportWhole, safeName, waitForImages, zipBlobs,
} from '@/services/export/exportImage';
import { SmartStore } from './SmartStore';
import { SmartPlace } from './SmartPlace';

/** ⑦ 검수·완성 */
export function StepCheck({ getStage }: { getStage: () => HTMLElement | null }) {
  const { project } = useProject();
  const { isPro } = useEdition();
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState('');
  const [more, setMore] = useState(false);

  const runCheck = () => {
    setItems(checkProject(project));
    setDone('');
  };

  const withStage = async (label: string, fn: (stage: HTMLElement) => Promise<string>) => {
    const stage = getStage();
    if (!stage) { setDone('미리보기를 찾지 못했습니다.'); return; }
    setBusy(label);
    setDone('');
    try {
      /* 사진이 다 그려진 뒤에 뽑는다 */
      await waitForImages(stage);
      const msg = await fn(stage);
      setDone(msg);
    } catch (e) {
      setDone(e instanceof Error ? e.message : '이미지를 만들지 못했습니다.');
    } finally {
      setBusy('');
    }
  };

  const base = safeName(project.product.name || project.title);

  const doWhole = () =>
    withStage('전체 이미지를 만드는 중…', async (stage) => {
      const blob = await exportWhole(stage);
      download(blob, `${base}_전체.jpg`);
      return '전체 이미지를 저장했습니다.';
    });

  const doSlices = () =>
    withStage('나눠서 만드는 중…', async (stage) => {
      const { blobs } = await exportSlices(stage, cutHintsOf(stage));
      blobs.forEach((b, i) => download(b, `${base}_${String(i + 1).padStart(2, '0')}.jpg`));
      return `${blobs.length}장으로 나눠 저장했습니다.`;
    });

  const doZip = () =>
    withStage('ZIP 으로 묶는 중…', async (stage) => {
      const { blobs } = await exportSlices(stage, cutHintsOf(stage));
      const zip = await zipBlobs(blobs, base);
      download(zip, `${base}.zip`);
      return `${blobs.length}장을 ZIP 으로 저장했습니다.`;
    });

  /* 완성도 — 이미 있는 데이터만 본다. 새 검증 장치를 따로 만들지 않는다. */
  const ready = readiness(project);

  return (
    <div className="stack">
      {/* 처음 쓰는 분을 위한 추천 */}
      <div className="firstpick">
        <span className="firstpick__tag">처음이라면 추천</span>
        <p>스마트스토어에 올리실 거라면 <b>분할 JPG</b>가 가장 무난합니다.</p>
        <button className="btn btn--make" onClick={doSlices} disabled={!!busy}>
          분할 JPG로 저장
        </button>
      </div>

      {/* 쓰임새를 셋으로 나눠 보여준다 — 기능을 지우지 않고 자리만 나눈다 */}
      <p className="usehead">① 상세페이지 저장하기</p>
      <p className="field__hint">만든 상세페이지를 그림이나 작업파일로 받습니다. 아래 <b>다른 저장 방법 보기</b>에 전부 있습니다.</p>

      <p className="usehead">② 네이버 스마트스토어에 사용하기</p>
      <SmartStore getStage={getStage} />

      <p className="usehead">③ 네이버 스마트플레이스에 사용하기</p>
      <SmartPlace />

      {/* 완성도 */}
      <div className="ready">
        <div className="ready__bar"><i style={{ width: ready.percent + '%' }} /></div>
        <b>상세페이지 준비 상태 {ready.percent}%</b>
        <ul>
          {ready.items.map((it, i) => (
            <li key={i} className={it.ok ? 'is-ok' : 'is-warn'}>
              {it.ok ? '✓' : '⚠'} {it.text}
            </li>
          ))}
        </ul>
      </div>

      <button className="more__btn" onClick={() => setMore((v) => !v)}>
        {more ? '다른 저장 방법 닫기' : '다른 저장 방법 보기'}
      </button>

      {more && (<>
      {isPro && (
        <button className="btn btn--line wide" onClick={runCheck}>스마트스토어 체크</button>
      )}

      {isPro && items && (
        <div className={'checkbox' + (items.some((i) => i.level === 'warn') ? ' is-warn' : ' is-ok')}>
          <b>{summarize(items)}</b>
          {items.length > 0 && (
            <ul>
              {items.map((it, i) => (
                <li key={i} className={it.level === 'warn' ? 'is-warn' : ''}>
                  <span>{it.where}</span> {it.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isPro && <hr className="sep" />}

      {/* 저장 방식 이름보다 **어디에 쓰는지**를 먼저 읽히게 한다 */}
      <span className="field__label">어디에 쓰실 건가요?</span>
      <div className="exports">
        {isPro && (
          <button className="btn btn--main wide savepick" onClick={doSlices} disabled={!!busy}>
            <b>스마트스토어에 올릴 때</b>
            <em>분할 JPG · 길이에 맞춰 여러 장으로</em>
          </button>
        )}
        <button
          className={'btn wide savepick ' + (isPro ? 'btn--line' : 'btn--main')}
          onClick={doWhole}
          disabled={!!busy}
        >
          <b>한 장 이미지가 필요할 때</b>
          <em>전체 JPG · 통째로 한 장</em>
        </button>
        {isPro && (
          <>
            <button className="btn btn--line wide savepick" onClick={doZip} disabled={!!busy}>
              <b>백업하거나 전달할 때</b>
              <em>ZIP · 나눈 이미지를 한 번에</em>
            </button>
            <button className="btn btn--line wide savepick" onClick={() => downloadProjectFile(project)}>
              <b>나중에 다시 편집할 때</b>
              <em>작업파일 (.saypage) · 열어서 계속 수정할 수 있습니다</em>
            </button>
          </>
        )}
      </div>

      {!isPro && (
        <p className="field__hint">
          여러 장으로 나눠 저장하기와 스마트스토어 체크는 PRO에서 쓸 수 있어요.
        </p>
      )}

      {isPro && (
        <p className="field__hint">
          나눌 때는 메뉴와 메뉴 사이 여백을 먼저 찾아 자릅니다. 글자나 사진 한가운데가 잘리지 않습니다.
        </p>
      )}
      </>)}

      {busy && <p className="note">{busy}</p>}
      {done && <p className="note note--ok">{done}</p>}
    </div>
  );
}

/** 준비 상태 — 지금 있는 데이터만 보고 알려준다 */
function readiness(p: ReturnType<typeof useProject>['project']) {
  const s = p.studio;
  const items = [
    { ok: !!p.product.name.trim(), text: p.product.name.trim() ? '상품명 입력됨' : '상품명을 넣어주세요' },
    { ok: !!p.product.salePrice.trim(), text: p.product.salePrice.trim() ? '가격 입력됨' : '가격을 넣어주세요' },
    { ok: p.photos.length > 0, text: p.photos.length > 0 ? `사진 ${p.photos.length}장` : '사진을 올려주세요' },
    { ok: p.menus.some((m) => !m.hidden && m.kind === 'cta'), text: p.menus.some((m) => !m.hidden && m.kind === 'cta') ? '예약·문의 있음' : '예약·문의를 넣어주세요' },
    { ok: !!(s?.phone || s?.bookingUrl), text: (s?.phone || s?.bookingUrl) ? '연락처 있음' : '전화번호나 예약링크 확인 필요' },
    { ok: p.menus.filter((m) => !m.hidden).length >= 5, text: p.menus.filter((m) => !m.hidden).length >= 5 ? '상세페이지 구성 충분' : '내용을 더 넣으면 좋습니다' },
  ];
  const done = items.filter((i) => i.ok).length;
  return { percent: Math.round((done / items.length) * 100), items };
}

