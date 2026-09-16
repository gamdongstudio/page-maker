import { useMemo, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { download } from '@/services/export/exportImage';
import {
  applyEdits, buildPlacePayload, shownValue, type PlaceItem,
} from '@/services/smartplace/payload';
import { placeFileBody, placeFullText, PLACE_FILE_NAME } from '@/services/smartplace/text';

/**
 * 네이버 스마트플레이스 등록자료.
 *
 * 하는 일은 **글을 순서대로 정리해 드리는 것**뿐이다.
 *  - 네이버에 접속하지 않는다
 *  - 로그인하지 않는다
 *  - 대신 등록하지 않는다
 *
 * 화면·항목별 복사·전체 복사·메모장 파일이 **모두 같은 한 벌**을 쓴다.
 */
export function SmartPlace() {
  const { project, update } = useProject();
  const [copied, setCopied] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  /* 상세페이지 내용에서 만들고, 여기서만 고친 글이 있으면 그것을 덮어쓴다 */
  const items = useMemo(
    () => applyEdits(buildPlacePayload(project), project.place),
    [project],
  );

  const say = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(''), 3000);
  };

  /** 글 복사 — 새 방식이 막히면 예전 방식으로 한 번 더 */
  const copy = async (mark: string, text: string) => {
    const done = () => {
      setCopied(mark);
      window.setTimeout(() => setCopied(''), 1600);
    };
    try {
      await navigator.clipboard.writeText(text);
      done();
      return;
    } catch { /* 아래 예전 방식으로 */ }
    try {
      const box = document.createElement('textarea');
      box.value = text;
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
    } catch { /* 아래에서 알린다 */ }
    say('복사하지 못했습니다. 글을 직접 선택해 복사해 주세요.');
  };

  /** 스마트플레이스용으로만 글을 고친다 (상세페이지 원본은 그대로) */
  const edit = (key: string, value: string) =>
    update((d) => {
      d.place = { ...(d.place ?? {}), [key]: value };
    }, { label: 'place.' + key });

  const doFile = () => {
    const body = placeFileBody(items);
    download(new Blob([body], { type: 'text/plain;charset=utf-8' }), PLACE_FILE_NAME);
    say('스마트플레이스 등록자료를 저장했습니다.');
  };

  return (
    <section className="sp">
      <header className="sp__head">
        <b>네이버 스마트플레이스 등록자료</b>
        <span>스마트플레이스에 넣을 순서대로 정리했습니다. 네이버에 접속하지 않습니다.</span>
      </header>

      <button className="more__btn" onClick={() => setOpen((v) => !v)}>
        {open ? '등록자료 닫기' : '등록자료 보기 (15개 항목)'}
      </button>

      {open && (
        <>
          <ol className="sp__list">
            {items.map((it) => (
              <Row
                key={it.key}
                item={it}
                copied={copied === it.key}
                editing={editing === it.key}
                onCopy={() => void copy(it.key, it.value)}
                onEdit={() => setEditing(editing === it.key ? null : it.key)}
                onChange={(v) => edit(it.key, v)}
              />
            ))}
          </ol>

          <div className="sp__acts">
            <button
              className="btn btn--line wide"
              onClick={() => void copy('__all', placeFullText(items))}
            >
              {copied === '__all' ? '복사되었습니다 ✓' : '전체 내용 복사'}
            </button>
            <button className="btn btn--main wide savepick" onClick={doFile}>
              <b>스마트플레이스 등록자료 받기</b>
              <em>{PLACE_FILE_NAME} · 메모장에서 위에서부터 그대로 옮겨 적으세요</em>
            </button>
          </div>

          <p className="field__hint">
            고치신 글은 <b>스마트플레이스용으로만</b> 저장됩니다. 상세페이지 원본은 그대로예요.
          </p>
        </>
      )}

      {msg && <p className="note note--ok">{msg}</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * 항목 하나.
 *
 * ⚠ 항목 이름은 **한 번만** 쓴다. 값 앞에 `업체명:` 처럼 다시 붙이지 않는다.
 * ⚠ 복사 단추는 **값만** 복사한다. 번호와 항목 이름은 넣지 않는다.
 */
function Row({ item, copied, editing, onCopy, onEdit, onChange }: {
  item: PlaceItem;
  copied: boolean;
  editing: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onChange: (v: string) => void;
}) {
  const shown = shownValue(item);

  return (
    <li className={'sp__row' + (shown.missing ? ' is-missing' : '')}>
      <div className="sp__top">
        <span className="sp__no">{item.no}.</span>
        <span className="sp__label">{item.label}</span>
        <button className="tiny" onClick={onEdit}>{editing ? '닫기' : '수정'}</button>
        <button className="tiny" onClick={onCopy} disabled={shown.missing}>
          {copied ? '복사됨 ✓' : '복사'}
        </button>
      </div>

      {editing ? (
        item.long ? (
          <textarea
            className="mini mini--text"
            rows={4}
            value={item.value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="스마트플레이스에 넣을 내용을 적어주세요"
          />
        ) : (
          <input
            className="mini mini--text"
            value={item.value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="스마트플레이스에 넣을 내용을 적어주세요"
          />
        )
      ) : (
        <p className="sp__value">{shown.text}</p>
      )}
    </li>
  );
}
