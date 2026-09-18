import { useProject } from '@/store/ProjectStore';
import { Icon } from '@/components/ui/Icon';
import { STEPS, stepDone, stepInfo, type FlowStep } from './steps';

/**
 * ① → ② → ③ → ④ 단계 표시.
 *
 * 어느 단계든 바로 눌러 옮겨갈 수 있다. 순서를 강제하지 않는다.
 * 단계를 오가도 작업 내용은 그대로다. (같은 저장소를 본다)
 */
export function StepBar({ now, onGo }: { now: FlowStep | null; onGo: (s: FlowStep) => void }) {
  const { project } = useProject();
  const done = stepDone(project);

  return (
    <nav className="stepbar" aria-label="만드는 순서">
      {STEPS.map((s, i) => {
        const on = now === s.key;
        return (
          <button
            key={s.key}
            className={'stepbar__item' + (on ? ' is-on' : '') + (done[s.key] && !on ? ' is-done' : '')}
            onClick={() => onGo(s.key)}
            aria-current={on ? 'step' : undefined}
          >
            <span className="stepbar__no">
              {done[s.key] && !on ? <Icon name="check" size={13} /> : s.no}
            </span>
            <span className="stepbar__label">{s.label}</span>
            {i < STEPS.length - 1 && <i className="stepbar__line" aria-hidden />}
          </button>
        );
      })}
    </nav>
  );
}

/** 단계 맨 위 — 한두 줄 안내 + 필요한 사람만 여는 도움말 */
export function StepLead({ step }: { step: FlowStep }) {
  const info = stepInfo(step);
  return (
    <header className="steplead">
      <h2 className="steplead__title">
        <span className="steplead__no">{info.no}</span>
        {info.label}
      </h2>
      <p className="steplead__text">{info.lead}</p>
    </header>
  );
}

/** 단계 맨 아래 — 이전 / 다음 */
export function StepNav({ step, onGo }: { step: FlowStep; onGo: (s: FlowStep) => void }) {
  const i = STEPS.findIndex((s) => s.key === step);
  const prev = STEPS[i - 1];
  const next = STEPS[i + 1];
  return (
    <div className="stepnav">
      {prev ? (
        <button className="btn btn--line" onClick={() => onGo(prev.key)}>
          이전: {prev.label}
        </button>
      ) : <span />}
      {next && (
        <button className="btn btn--main" onClick={() => onGo(next.key)}>
          다음: {next.label}
        </button>
      )}
    </div>
  );
}
