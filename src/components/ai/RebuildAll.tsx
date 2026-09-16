import { useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { planStudioPage } from '@/services/ai/studioPlanner';
import { applyStudioPlan, type WholeMode } from '@/services/ai/applyPlan';

/**
 * 전체 다시 만들기.
 *
 * 어느 것을 고르든 **사용자가 의도하지 않은 자료는 지우지 않는다.**
 *  - 사진은 어느 경우에도 지우지 않는다
 *  - 실행취소(Ctrl+Z)로 바로 되돌아간다
 */

const CHOICES: { mode: WholeMode; title: string; desc: string }[] = [
  { mode: 'designOnly', title: '내용은 그대로, 디자인만 새롭게', desc: '글과 사진은 손대지 않고 섹션 모양만 바꿉니다.' },
  { mode: 'keepPhotos', title: '사진은 그대로, 구성과 글을 새롭게', desc: '올린 사진을 그대로 두고 메뉴 구성과 문구를 다시 만듭니다.' },
  { mode: 'fresh', title: '완전히 새롭게', desc: '구성·제목·문구를 처음부터 다시 만듭니다. 사진은 지우지 않습니다.' },
];

export function RebuildAll() {
  const { project, update } = useProject();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WholeMode>('keepPhotos');
  const [msg, setMsg] = useState('');

  const run = () => {
    const plan = planStudioPage(project);
    update((d) => { applyStudioPlan(d, plan, { mode }); }, { label: 'rebuild.all', merge: false });
    setMsg('전체를 다시 만들었습니다. 마음에 안 들면 실행취소(Ctrl+Z)로 되돌릴 수 있어요.');
    window.setTimeout(() => setMsg(''), 5000);
  };

  return (
    <div className="rebuild">
      <button className="btn btn--line wide" onClick={() => setOpen((v) => !v)}>
        {open ? '전체 다시 만들기 닫기' : '전체 다시 만들기'}
      </button>

      {open && (
        <div className="stack">
          {CHOICES.map((c) => (
            <label key={c.mode} className={'pick' + (mode === c.mode ? ' is-on' : '')}>
              <input
                type="radio" name="rebuildmode" checked={mode === c.mode}
                onChange={() => setMode(c.mode)}
              />
              <span>
                <b>{c.title}</b>
                <em>{c.desc}</em>
              </span>
            </label>
          ))}
          <button className="btn btn--main wide" onClick={run}>이대로 다시 만들기</button>
          <p className="field__hint">
            사진은 어느 경우에도 지우지 않습니다. 인물을 새로 만들거나 얼굴을 바꾸지도 않습니다.
          </p>
        </div>
      )}

      {msg && <p className="note note--ok">{msg}</p>}
    </div>
  );
}
