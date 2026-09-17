import { useMemo, useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { planStudioPage } from '@/services/ai/studioPlanner';
import { applyScoped, applyStudioPlan } from '@/services/ai/applyPlan';
import { applyStyle } from '@/services/design/style';
import { listSnapshots, openSnapshot, saveSnapshot } from '@/services/storage/snapshots';
import { hasContent } from '@/components/preview/sectionContent';
import { formatWon } from '@/utils/format';
import { ChatGptPolish } from './ChatGptPolish';

/**
 * ② 자동 추천
 *
 * 버튼 하나로 초안 한 벌 — 글 · 사진 배치 · 영역 순서 · 기본 디자인(고급스러운)까지.
 * ChatGPT 없이도 완성된다. (이 컴퓨터 안에서 규칙대로 만든다)
 *
 * ⚠ 이미 고친 내용이 있으면 바로 지우지 않는다. 먼저 어떻게 할지 묻는다.
 * ⚠ 만들기 직전 모습을 보관해 두어 언제든 되돌릴 수 있다.
 */

const PHASES = ['글 정리 중…', '사진 고르는 중…', '초안 만드는 중…', '완료'];

type Mode = 'keep' | 'fresh';

export function StepRecommend({ onNext }: { onNext: () => void }) {
  const { project, update, replace } = useProject();
  const latest = useRef(project);
  latest.current = project;

  const [phase, setPhase] = useState(-1);
  const [asking, setAsking] = useState(false);
  const [snapAt, setSnapAt] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const plan = useMemo(() => planStudioPage(project), [project]);
  const made = !!project.flow?.recommendedAt;
  const running = phase >= 0 && phase < PHASES.length - 1;

  const usablePhotos = project.photos.filter((p) => p.kind !== 'unused' && !p.exclude).length;
  const price = formatWon(project.product.salePrice || project.product.listPrice);

  /** 사용자가 손댄 내용이 있는지 — 있으면 먼저 묻는다 */
  const touched = () => {
    const p = latest.current;
    const at = p.flow?.recommendedAt;
    /* 추천을 만든 뒤 한 번이라도 고쳤으면 (제목 고르기 포함) 먼저 묻는다 */
    if (at) return p.updatedAt > at;
    /* 처음 만들 때는 빈 곳만 채우므로 적어두신 글이 지워질 일이 없다 — 묻지 않는다 */
    return false;
  };

  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

  const make = async (mode: Mode) => {
    setAsking(false);
    setMsg('');
    /* 누르자마자 반응한다 — 보관은 그다음 */
    setPhase(0);
    await saveSnapshot(latest.current, '자동 추천 전');
    const snaps = await listSnapshots();
    setSnapAt(snaps[0]?.at ?? null);
    await wait(250);
    const fresh = planStudioPage(latest.current);

    setPhase(1);
    await wait(300);

    setPhase(2);
    await wait(200);
    update((d) => {
      if (mode === 'fresh') applyStudioPlan(d, fresh, { mode: 'fresh' });
      else applyScoped(d, fresh, 'fillEmpty');

      /* 사용자가 스타일을 직접 고르지 않았다면 고급스러운 스타일로 */
      if (!d.design.styleChosen) applyStyle(d, 'luxury', { chosen: false, templates: false });

      /* 내용이 없는 영역은 숨겨둔다 — 빈 칸이 많은 초안이 되지 않게 (지우지는 않는다) */
      d.menus.forEach((m) => {
        if (m.kind === 'main' || m.kind === 'cta') return;
        if (!hasContent(m, d)) m.hidden = true;
      });

      if (d.shoot?.productName && (!d.title || d.title === '새 상세페이지')) {
        d.title = `${d.shoot.productName} 상세페이지`;
      }
      d.flow = { ...(d.flow ?? {}), recommendedAt: Date.now() };
    }, { label: 'recommend', merge: false });

    setPhase(3);
    setMsg('초안을 만들었습니다. 왼쪽에서 확인해보세요.');
  };

  const start = () => {
    if (touched()) setAsking(true);
    else void make('keep');
  };

  const undo = async () => {
    if (!snapAt) return;
    const data = await openSnapshot(snapAt);
    if (!data) return;
    replace(data);
    setPhase(-1);
    setSnapAt(null);
    setMsg('자동 추천 전으로 되돌렸습니다.');
  };

  const pickTitle = (t: string) => update((d) => { d.product.name = t; }, { label: 'recommend.title', merge: false });
  const pickHero = (t: string) => update((d) => { d.product.tagline = t; }, { label: 'recommend.hero', merge: false });

  return (
    <div className="stack recommend">
      <section className="box">
        <h3 className="box__title">지금 준비된 자료</h3>
        <ul className="havelist">
          <Have ok={!!project.shoot?.productName} text={project.shoot?.productName ? `상품 종류 · ${project.shoot.productName}` : '상품 종류를 고르면 더 알맞게 만듭니다'} />
          <Have ok={!!project.product.name.trim()} text={project.product.name.trim() ? `상품명 · ${project.product.name}` : '상품명은 추천해 드립니다'} soft />
          <Have ok={!!price} text={price ? `가격 · ${price}` : '가격은 지어내지 않습니다 — 적어주시면 들어갑니다'} soft />
          <Have ok={usablePhotos > 0} text={usablePhotos ? `사진 ${usablePhotos}장` : '사진이 없으면 글로만 만듭니다'} soft />
          <Have ok={!!(project.studio?.phone || project.product.contact)} text={project.studio?.phone || project.product.contact ? '연락처 있음' : '연락처가 없으면 예약·문의는 단추만 들어갑니다'} soft />
        </ul>

        <button className="btn btn--make" onClick={start} disabled={running}>
          {made ? '자동 추천 다시 만들기' : '자동 추천 만들기'}
        </button>

        {phase >= 0 && (
          <ol className="progress" aria-live="polite">
            {PHASES.map((s, i) => (
              <li key={s} className={i < phase ? 'is-done' : i === phase ? 'is-now' : ''}>{s}</li>
            ))}
          </ol>
        )}

        <p className="field__hint">
          이 컴퓨터 안에서 규칙대로 만듭니다. 가격·전화번호 같은 정보는 지어내지 않습니다.
        </p>
      </section>

      {asking && (
        <section className="box box--ask" role="dialog" aria-label="현재 수정한 내용">
          <h3 className="box__title">현재 수정한 내용을 어떻게 할까요?</h3>
          <div className="askchoice">
            <button className="btn btn--main" onClick={() => void make('keep')}>
              현재 내용 유지하고 다시 추천
              <em>적어두신 글은 그대로 두고 빈 곳만 채웁니다</em>
            </button>
            <button className="btn btn--line" onClick={() => void make('fresh')}>
              새로 만들기
              <em>구성과 글을 처음부터 다시 만듭니다 · 사진은 지우지 않습니다</em>
            </button>
            <button className="btn btn--quiet" onClick={() => setAsking(false)}>취소</button>
          </div>
          <p className="field__hint">어느 쪽이든 만들기 직전 모습을 보관해 두어 되돌릴 수 있습니다.</p>
        </section>
      )}

      {msg && (
        <div className="note note--ok">
          <b>{msg}</b>
          {snapAt && phase === 3 && (
            <button className="linkbtn" onClick={() => void undo()}>만들기 전으로 되돌리기</button>
          )}
        </div>
      )}

      {made && (
        <>
          <section className="box">
            <h3 className="box__title">메인 제목 고르기</h3>
            <div className="chiprow">
              {plan.searchTitles.map((t) => (
                <button key={t} className={'chip' + (project.product.name === t ? ' is-on' : '')} onClick={() => pickTitle(t)}>{t}</button>
              ))}
            </div>
            <h3 className="box__title box__title--sub">한 줄 소개 고르기</h3>
            <div className="chiprow">
              {plan.heroCopy.map((t) => (
                <button key={t} className={'chip' + (project.product.tagline === t ? ' is-on' : '')} onClick={() => pickHero(t)}>{t}</button>
              ))}
            </div>
            <p className="field__hint">고르지 않아도 됩니다. 왼쪽 글자를 눌러 직접 고칠 수도 있어요.</p>
          </section>

          {(plan.needsCheck.length > 0 || plan.draftTitles.length > 0) && (
            <section className="box">
              <h3 className="box__title">확인하면 좋은 것</h3>
              <ul className="checklist">
                {plan.needsCheck.map((n, i) => <li key={i}>{n}</li>)}
                {plan.draftTitles.length > 0 && (
                  <li><b>{plan.draftTitles.join(' · ')}</b> 은(는) 일반적인 문구로 채웠습니다. 우리 가게에 맞게 고쳐주세요.</li>
                )}
              </ul>
            </section>
          )}

          <ChatGptPolish />
        </>
      )}

      <div className="stepnav stepnav--single">
        <button className="btn btn--main" onClick={onNext}>다음: 보면서 고치기</button>
      </div>
    </div>
  );
}

function Have({ ok, text, soft = false }: { ok: boolean; text: string; soft?: boolean }) {
  return (
    <li className={ok ? 'is-ok' : soft ? 'is-soft' : 'is-warn'}>
      <i aria-hidden>{ok ? '✓' : '·'}</i>
      {text}
    </li>
  );
}
