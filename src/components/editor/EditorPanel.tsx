import { useEffect, useRef } from 'react';
import { StepProduct } from './StepProduct';
import { StepMedia } from '@/components/media/StepMedia';
import { StepMenus } from '@/components/menus/StepMenus';
import { StepDesign } from '@/components/design/StepDesign';
import { StepCheck } from '@/components/export/StepCheck';
import { StepAi } from '@/components/ai/StepAi';
import { StepPrompter } from '@/components/ai/StepPrompter';
import { StepWorks } from '@/components/works/StepWorks';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useEdition } from '@/store/EditionContext';
import { useProject } from '@/store/ProjectStore';
import { DESIGN_PRESETS } from '@/types/defaults';

/**
 * 오른쪽 제작도구.
 *
 * 두 층으로 나눈다.
 *   1층 — **어떻게 넣을지**: 자동입력 / 직접입력
 *   2층 — **무엇을 고칠지**: 상품정보·사진·구성·디자인·PROMPTER·내 작업·완성
 *
 * 둘은 서로 다른 페이지가 아니다. **같은 작업 내용을 다루는 두 가지 방식**이라
 * 오가더라도 지금까지 넣은 내용은 그대로 남는다. (같은 저장소를 본다)
 */

export type StepKey =
  | 'ai' | 'product' | 'media' | 'menus' | 'design' | 'prompter' | 'works' | 'check';

interface Props {
  openStep: StepKey | null;
  setOpenStep: (s: StepKey | null) => void;
  focusMenuId?: string | null;
  onFocused?: () => void;
  jumpTo?: StepKey | null;
  onJumped?: () => void;
  getStage: () => HTMLElement | null;
}

interface Tool {
  key: StepKey;
  icon: IconName;
  label: string;
  /** 간편 편집에서도 보여줄지 */
  simple: boolean;
}

/** 2층 — 무엇을 고칠지 */
const TOOLS: Tool[] = [
  { key: 'product', icon: 'fileText', label: '상품정보', simple: true },
  { key: 'media', icon: 'image', label: '사진', simple: true },
  { key: 'menus', icon: 'grid', label: '구성', simple: true },
  { key: 'design', icon: 'palette', label: '디자인', simple: true },
  { key: 'prompter', icon: 'message', label: 'PROMPTER', simple: false },
  { key: 'works', icon: 'folder', label: '내 작업', simple: true },
  { key: 'check', icon: 'checkCircle', label: '완성', simple: true },
];

/** 직접입력으로 돌아올 때 기본으로 여는 도구 */
const FIRST_TOOL: StepKey = 'product';

const TITLE: Record<StepKey, string> = {
  ai: '자동입력',
  product: '촬영상품 정보',
  media: '사진·영상',
  menus: '상세페이지 구성',
  design: '디자인',
  prompter: 'SAY PROMPTER',
  works: '내 작업',
  check: '완성·저장',
};

export function EditorPanel({ openStep, setOpenStep, focusMenuId, onFocused, jumpTo, onJumped, getStage }: Props) {
  const { isPro } = useEdition();
  const { project } = useProject();
  const boxRef = useRef<HTMLDivElement>(null);
  /** 직접입력에서 마지막으로 보던 도구 — 자동입력에 갔다 와도 그 자리로 돌아온다 */
  const lastTool = useRef<StepKey>(FIRST_TOOL);

  const now: StepKey = openStep ?? 'ai';
  const mode: 'auto' | 'manual' = now === 'ai' ? 'auto' : 'manual';

  useEffect(() => { if (now !== 'ai') lastTool.current = now; }, [now]);

  /* 상단 버튼으로 옮겨올 때: 그 도구를 열고 첫 입력칸에 커서를 둔다 */
  useEffect(() => {
    if (!jumpTo) return;
    const t = window.setTimeout(() => {
      boxRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      const input = boxRef.current?.querySelector<HTMLElement>(
        '.panelbody textarea, .panelbody input:not([type=hidden]):not([type=file]), .panelbody button.chip',
      );
      input?.focus({ preventScroll: true });
      onJumped?.();
    }, 120);
    return () => window.clearTimeout(t);
  }, [jumpTo, openStep, onJumped]);

  const status = stepStatus(project);
  const tools = TOOLS.filter((t) => isPro || t.simple);
  const todo = Object.values(status).filter((s) => s === 'todo').length;

  return (
    <div className="editor" ref={boxRef}>
      {/* 1층 — 어떻게 넣을지 */}
      <div className="modetabs" role="tablist" aria-label="입력 방식">
        <button
          role="tab"
          aria-selected={mode === 'auto'}
          className={'modetab' + (mode === 'auto' ? ' is-on' : '')}
          onClick={() => setOpenStep('ai')}
        >
          <Icon name="wand" size={16} />
          자동입력
        </button>
        <button
          role="tab"
          aria-selected={mode === 'manual'}
          className={'modetab' + (mode === 'manual' ? ' is-on' : '')}
          onClick={() => setOpenStep(lastTool.current)}
        >
          <Icon name="pen" size={16} />
          직접입력
        </button>
      </div>

      {/* 2층 — 무엇을 고칠지 (직접입력일 때만) */}
      {mode === 'manual' && (
        <nav className="toolnav" aria-label="작업 도구">
          {tools.map((t) => (
            <button
              key={t.key}
              className={'toolnav__btn' + (now === t.key ? ' is-on' : '')}
              onClick={() => setOpenStep(t.key)}
              aria-current={now === t.key}
            >
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
              {status[t.key] === 'done' && <i className="toolnav__done"><Icon name="check" size={11} /></i>}
              {status[t.key] === 'todo' && <i className="toolnav__todo" title="입력 필요" />}
            </button>
          ))}
        </nav>
      )}

      <div className="panelbody">
        {now === 'ai' && (
          <Panel title={TITLE.ai} icon="wand">
            <p className="panel__lead">
              <b>처음이시라면 자동입력부터 시작해보세요.</b><br />
              자동입력은 기존 자료와 사진을 이용해 초안을 빠르게 만들어드립니다. 만든 뒤에도 <b>직접입력</b>에서 얼마든지 고칠 수 있어요.
            </p>
            <StepAi />
          </Panel>
        )}
        {now === 'product' && <Panel title={TITLE.product} icon="fileText"><StepProduct /></Panel>}
        {now === 'media' && <Panel title={TITLE.media} icon="image"><StepMedia /></Panel>}
        {now === 'menus' && <Panel title={TITLE.menus} icon="grid"><StepMenus focusMenuId={focusMenuId} onFocused={onFocused} /></Panel>}
        {now === 'design' && <Panel title={TITLE.design} icon="palette"><StepDesign /></Panel>}
        {now === 'prompter' && (
          <Panel title={TITLE.prompter} icon="message">
            <p className="panel__lead">AI에게 수정 요청할 문장을 만들어드립니다.</p>
            <StepPrompter />
          </Panel>
        )}
        {now === 'works' && <Panel title={TITLE.works} icon="folder"><StepWorks /></Panel>}
        {now === 'check' && <Panel title={TITLE.check} icon="checkCircle"><StepCheck getStage={getStage} /></Panel>}
      </div>

      {/* 남은 일은 퍼센트가 아니라 **개수**로 알린다 */}
      {mode === 'manual' && todo > 0 && (
        <p className="editor__note">완성 전 확인할 항목 {todo}개</p>
      )}
      {!isPro && (
        <p className="editor__note">
          간편 편집입니다. 세부 구성·분할 저장 등은 <b>더보기 → 상세 편집</b>에서 쓸 수 있어요.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Panel({ title, icon, children }: {
  title: string; icon: IconName; children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel__head">
        <h2><Icon name={icon} size={17} />{title}</h2>
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}

/**
 * 각 도구가 어디까지 됐는지.
 * `done` 은 작은 체크만, `todo` 는 작은 점만 보여준다.
 * 나머지는 **아무것도 표시하지 않는다** — 다 채워야 하는 양식처럼 보이면 안 된다.
 */
type Status = 'done' | 'todo';

function stepStatus(p: ReturnType<typeof useProject>['project']): Partial<Record<StepKey, Status>> {
  const visible = p.menus.filter((m) => !m.hidden);
  const designTouched = JSON.stringify(p.design) !== JSON.stringify(DESIGN_PRESETS[p.design.preset]);

  return {
    product: p.product.name.trim() ? 'done' : 'todo',
    media: p.photos.length > 0 ? 'done' : 'todo',
    menus: visible.length >= 3 ? 'done' : undefined,
    design: designTouched ? 'done' : undefined,
    check: p.photos.length > 0 && p.product.name.trim() ? 'done' : undefined,
  };
}
