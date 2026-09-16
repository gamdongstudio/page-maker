import { useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { analyzeCapture, type ReferenceRead } from '@/services/reference/analyzeCapture';
import { DESIGN_PRESETS } from '@/types/defaults';
import { STYLE_PRESET_LABEL } from '@/types/project';

/**
 * 참고 캡처에서 느낌 가져오기 (PRO)
 *
 * 사용자가 "이런 느낌으로 만들고 싶어요" 하며 올린 캡처에서
 * 색 분위기·여백·구성만 읽어 지금 상품에 맞게 제안한다.
 * 남의 페이지를 그대로 베끼지 않는다는 점을 화면에 밝힌다.
 */
export function ReferenceCapture() {
  const { project, update } = useProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const [read, setRead] = useState<ReferenceRead | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const note = project.reference;

  const run = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMsg('');
    try {
      const result = await analyzeCapture(file);
      setRead(result);
      update((d) => {
        d.reference = {
          fileName: result.fileName,
          readAt: Date.now(),
          findings: result.findings,
          sections: result.sections,
          ctaBottom: result.ctaBottom,
          presetGuess: result.presetGuess,
          applied: false,
        };
      }, { label: 'reference.read', merge: false });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '캡처를 살펴보지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  /** 읽은 느낌을 지금 디자인에 반영한다 (글과 사진은 건드리지 않는다) */
  const apply = (withPreset: boolean) => {
    if (!read) return;
    update((d) => {
      if (withPreset) d.design = { ...DESIGN_PRESETS[read.presetGuess] };
      d.design = { ...d.design, ...read.suggest };
      if (d.reference) d.reference.applied = true;
    }, { label: 'reference.apply', merge: false });
    setMsg(
      withPreset
        ? '간편 스타일까지 함께 바꿨습니다. 실행취소로 되돌릴 수 있어요.'
        : '색과 여백만 바꿨습니다. 실행취소로 되돌릴 수 있어요.',
    );
  };

  return (
    <div className="stack refcap">
      <div
        className={'drop drop--small' + (dragOver ? ' is-over' : '')}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void run(e.dataTransfer.files[0]);
        }}
      >
        <b>참고 캡처 올리기</b>
        <span>마음에 드는 상세페이지를 캡처해서 올려주세요. 느낌만 가져옵니다.</span>
      </div>
      <input
        ref={fileRef} type="file" accept="image/*" hidden
        onChange={(e) => {
          /* value 를 먼저 비우면 파일이 사라지므로 반드시 먼저 꺼낸다 */
          const picked = e.target.files?.[0];
          e.target.value = '';
          void run(picked);
        }}
      />

      <p className="note note--warn">
        지금 읽을 수 있는 것은 <b>색·여백·구간 수·사진 비율</b>까지입니다.
        캡처 속 <b>글자는 읽지 못합니다</b> (AI 연결 후 가능).
      </p>
      <p className="note">
        캡처의 <b>색 분위기·여백·구성 방식</b>만 읽습니다.
        글이나 사진을 가져오거나 남의 페이지를 그대로 베끼지 않습니다.
        캡처 사진은 저장하지 않습니다.
      </p>

      {busy && <p className="note">캡처를 살펴보는 중…</p>}
      {msg && <p className="note note--ok">{msg}</p>}

      {read && (
        <div className="refcap__result">
          <p className="plan__source">
            {read.fileName} · {read.width}×{read.height}
            <br />색과 여백을 직접 재서 계산한 결과입니다. (AI 아님)
          </p>

          <ul className="refcap__list">
            {read.findings.map((f, i) => <li key={i}>{f}</li>)}
          </ul>

          <div className="refcap__swatch">
            {(['background', 'primary', 'accent', 'text'] as const).map((k) => (
              read.suggest[k] ? (
                <span key={k}>
                  <i style={{ background: read.suggest[k] as string, border: '1px solid #dfe3ea' }} />
                  {k === 'background' ? '배경색' : k === 'primary' ? '대표색' : k === 'accent' ? '강조색' : '글자색'}
                </span>
              ) : null
            ))}
          </div>

          <p className="field__hint">
            어울리는 간편 스타일: <b>{STYLE_PRESET_LABEL[read.presetGuess]}</b>
          </p>

          <div className="plan__acts">
            <button className="btn btn--main" onClick={() => apply(true)}>이 느낌으로 바꾸기</button>
            <button className="btn btn--line" onClick={() => apply(false)}>색·여백만 가져오기</button>
          </div>
          <p className="field__hint">상품정보·사진·메뉴 글은 그대로 둡니다.</p>
        </div>
      )}

      {!read && note && (
        <p className="note">
          지난번에 <b>{note.fileName}</b> 캡처를 살펴봤어요.
          {note.applied ? ' 그 느낌이 지금 디자인에 적용돼 있습니다.' : ' 아직 적용하지는 않았습니다.'}
        </p>
      )}
    </div>
  );
}
