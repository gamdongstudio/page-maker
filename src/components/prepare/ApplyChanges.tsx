import { useMemo, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { planStudioPage } from '@/services/ai/studioPlanner';
import { isAuto, regenerateMenu } from '@/services/ai/applyPlan';

/**
 * 자동 제작 뒤에 자료(상품명·가격·매장 정보 …)를 고쳤을 때
 * **관련된 영역만** 새 자료에 맞춰 다시 채운다.
 *
 * 규칙
 *  - 자동으로 넣은 뒤 **손대지 않은 영역만** 바꾼다. 직접 고친 영역은 그대로 둔다.
 *  - 사진·순서·모양은 건드리지 않는다. 글(제목·내용)만 맞춘다.
 *  - 바뀔 것이 없으면 아무것도 보여주지 않는다.
 */
export function ApplyChanges() {
  const { project, update } = useProject();
  const [msg, setMsg] = useState('');

  const plan = useMemo(() => planStudioPage(project), [project]);

  /* 자동으로 넣은 그대로인데, 지금 자료로 만들면 달라지는 영역 */
  const stale = useMemo(() => project.menus.filter((m) => {
    if (!isAuto(m)) return false;
    const planned = plan.menus.find((p) => p.kind === m.kind);
    if (!planned) return false;
    const sameTitle = !planned.title || planned.title === m.title;
    const sameBody = planned.body === m.body;
    const sameLines = planned.lines.join('\n') === m.lines.join('\n');
    return !(sameTitle && sameBody && sameLines);
  }), [project.menus, plan]);

  if (!project.flow?.recommendedAt || stale.length === 0) return null;

  const apply = () => {
    const ids = stale.map((m) => m.id);
    update((d) => {
      ids.forEach((id) => {
        regenerateMenu(d, id, plan, 'title');
        regenerateMenu(d, id, plan, 'body');
      });
    }, { label: 'apply.changes', merge: false });
    setMsg(`${ids.length}곳을 고친 자료에 맞췄습니다. (실행취소로 되돌리기)`);
    window.setTimeout(() => setMsg(''), 4000);
  };

  return (
    <div className="suggest">
      <b>고친 자료를 반영할까요?</b>
      <span>
        {stale.map((m) => m.title).join(' · ')} 영역이 지금 자료와 다릅니다.
        직접 고치신 영역은 건드리지 않습니다.
      </span>
      <div className="suggest__acts">
        <button className="btn btn--main" onClick={apply}>수정 내용 반영</button>
      </div>
      {msg && <p className="note note--ok">{msg}</p>}
    </div>
  );
}
