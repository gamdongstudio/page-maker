import { useMemo, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import {
  applyPolish, buildPolishPrompt, parsePolish, POLISH_SLOTS, type PolishKey,
} from '@/services/prompter/polish';
import { saveSnapshot } from '@/services/storage/snapshots';
import { copyText } from '@/utils/copyText';

/**
 * ChatGPT 로 문구 더 다듬기 — **선택 기능.** 쓰지 않아도 상세페이지는 완성된다.
 *
 *   1. 요청문 복사  2. ChatGPT 에 붙여넣기  3. 받은 답 붙여넣기  4. [ChatGPT 결과 적용]
 *
 * BARODU 가 ChatGPT 를 직접 부르지 않는다. 되는 척하지 않는다.
 */
export function ChatGptPolish() {
  const { project, update, undo } = useProject();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [answer, setAnswer] = useState('');
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState('');

  const parsed = useMemo(() => parsePolish(answer), [answer]);
  const found = POLISH_SLOTS.filter((s) => parsed[s.key]);

  const copy = async () => {
    const ok = await copyText(buildPolishPrompt(project));
    setCopied(ok ? '요청문을 복사했습니다. ChatGPT에 붙여넣으세요.' : '복사하지 못했습니다. 다시 눌러주세요.');
  };

  const apply = async () => {
    const pick = found.map((s) => s.key).filter((k) => !off[k]) as PolishKey[];
    if (!pick.length) return;
    await saveSnapshot(project, 'ChatGPT 결과 적용 전');
    update((d) => { applyPolish(d, parsed, pick); }, { label: 'polish.apply', merge: false });
    setDone(`${pick.length}개 항목에 넣었습니다. 왼쪽에서 확인해보세요.`);
    setAnswer('');
  };

  if (!open) {
    return (
      <section className="box polish">
        <h3 className="box__title">문장을 조금 더 자연스럽게 다듬고 싶나요?</h3>
        <button className="btn btn--line" onClick={() => setOpen(true)}>ChatGPT로 문구 더 다듬기</button>
        <p className="field__hint">선택 기능입니다. 쓰지 않아도 상세페이지는 완성됩니다.</p>
      </section>
    );
  }

  return (
    <section className="box polish">
      <h3 className="box__title">ChatGPT로 문구 더 다듬기</h3>

      <ol className="polish__steps">
        <li>
          <b>요청문을 복사합니다.</b>
          <button className="btn btn--main" onClick={() => void copy()}>요청문 복사</button>
          {copied && <span className="field__hint">{copied}</span>}
        </li>
        <li>
          <b>ChatGPT에 붙여넣고 답을 받습니다.</b>
          <a className="btn btn--line" href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT 열기</a>
        </li>
        <li>
          <b>받은 답을 아래에 그대로 붙여넣습니다.</b>
          <textarea
            className="field__input"
            rows={6}
            value={answer}
            aria-label="ChatGPT 답 붙여넣기"
            placeholder={'[메인 제목]\n…\n[한 줄 소개]\n…'}
            onChange={(e) => { setAnswer(e.target.value); setDone(''); }}
          />
        </li>
      </ol>

      {answer.trim() && found.length === 0 && (
        <p className="note note--warn">
          답에서 항목을 찾지 못했습니다. ChatGPT 답에 <b>[메인 제목]</b> 같은 대괄호 제목이 있는지 확인해주세요.
        </p>
      )}

      {found.length > 0 && (
        <div className="stack">
          <span className="field__label">넣을 항목 ({found.length}개 찾음)</span>
          {found.map((s) => (
            <label key={s.key} className={'polishitem' + (off[s.key] ? '' : ' is-on')}>
              <input
                type="checkbox"
                checked={!off[s.key]}
                onChange={(e) => setOff((prev) => ({ ...prev, [s.key]: !e.target.checked }))}
              />
              <span>
                <b>{s.label}</b>
                <em>{parsed[s.key]}</em>
              </span>
            </label>
          ))}
          <button className="btn btn--main" onClick={() => void apply()}>ChatGPT 결과 적용</button>
          <p className="field__hint">가격·전화번호·주소는 바꾸지 않습니다.</p>
        </div>
      )}

      {done && (
        <p className="note note--ok">
          {done}{' '}
          <button className="linkbtn" onClick={() => { undo(); setDone('적용 전으로 되돌렸습니다.'); }}>적용 전으로 되돌리기</button>
        </p>
      )}

      <button className="linkbtn" onClick={() => setOpen(false)}>닫기</button>
    </section>
  );
}
