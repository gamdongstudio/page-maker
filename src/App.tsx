import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorPanel, type PanelView } from '@/components/editor/EditorPanel';
import { Icon } from '@/components/ui/Icon';
import { SplitLayout } from '@/components/layout/SplitLayout';
import { Preview } from '@/components/preview/Preview';
import { useProject } from '@/store/ProjectStore';
import { useEdition } from '@/store/EditionContext';
import { downloadProjectFile, readProjectFile } from '@/services/storage/local';
import { saveStudio } from '@/services/storage/studio';
import { saveWork } from '@/services/storage/works';
import { ExportStage } from '@/components/export/ExportStage';
import type { PreviewEdit } from '@/components/preview/editApi';
import { AddMenuHere } from '@/components/menus/AddMenuHere';
import { KEY_MENU_KINDS, makeMenu, uid } from '@/types/defaults';
import { readPhotoFiles } from '@/utils/image';
import { removePhoto, replacePhoto, setMainPhoto, setPrice } from '@/utils/photoOps';
import { isEmptyProject, type EditTab, type FlowStep } from '@/components/flow/steps';
import { Welcome } from '@/components/welcome/Welcome';
import { ExampleViewer } from '@/components/welcome/ExampleViewer';

/**
 * 한 화면에서 전부 한다.
 *
 * 왼쪽 = 실시간 미리보기 · 오른쪽 = ①~④ 단계 편집도구
 * 처음 온 사람에게는 편집도구보다 **결과(완성 예시)** 를 먼저 보여준다.
 */

const WELCOMED = 'barodu.welcomed';
const STEP_KEY = 'barodu.step';

export default function App() {
  const {
    project, replace, update, undo, redo, canUndo, canRedo, saveState, saveError, newProject,
  } = useProject();
  const { isPro, setEdition } = useEdition();

  const [rightHidden, setRightHidden] = useState(false);
  /* 새로고침해도 보던 단계로 돌아온다 (이 컴퓨터에만 기억) */
  const [step, setStepRaw] = useState<FlowStep>(() => {
    try {
      const v = localStorage.getItem(STEP_KEY);
      return v === 'recommend' || v === 'edit' || v === 'save' ? v : 'prepare';
    } catch { return 'prepare'; }
  });
  const setStep = useCallback((s: FlowStep) => {
    setStepRaw(s);
    try { localStorage.setItem(STEP_KEY, s); } catch { /* 기억 못 해도 괜찮다 */ }
  }, []);
  const [worksOpen, setWorksOpen] = useState(false);
  const [tab, setTab] = useState<EditTab>('content');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [toast, setToast] = useState('');
  const [focusMenuId, setFocusMenuId] = useState<string | null>(null);
  /** 미리보기에서 지금 고르고 있는 영역 — 테두리로 표시한다 */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  /** 미리보기의 '+ 여기에 넣기' 를 눌렀을 때 — 보이는 것 기준 자리 */
  const [addAt, setAddAt] = useState<number | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [examples, setExamples] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  /*
   * 처음 온 사람에게만 시작 화면.
   * 저장해 둔 작업이 올라오는 데 잠깐 걸리므로 조금 기다렸다가 판단한다 (깜빡임 방지).
   */
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(WELCOMED) === '1'; } catch { /* 못 읽어도 괜찮다 */ }
    if (seen) return;
    const t = window.setTimeout(() => {
      if (isEmptyProject(projectRef.current)) setWelcome(true);
    }, 500);
    return () => window.clearTimeout(t);
  }, []);

  const markWelcomed = () => {
    try { localStorage.setItem(WELCOMED, '1'); } catch { /* 무시 */ }
    setWelcome(false);
  };

  /*
   * 사진관 정보는 다음 작업에서도 다시 쓰도록 따로 보관한다.
   * (예전에는 작업 상태를 바꾸는 도중에 보관까지 해서 화면 경고가 났다 — 이제 바뀐 뒤에 한다)
   */
  const studioKey = JSON.stringify(project.studio ?? null);
  useEffect(() => {
    const s = projectRef.current.studio;
    if (!s || (!s.name && !s.phone)) return;
    const t = window.setTimeout(() => { void saveStudio(s); }, 800);
    return () => window.clearTimeout(t);
  }, [studioKey]);

  const clearFocus = useCallback(() => setFocusMenuId(null), []);

  const say = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const goStep = useCallback((s: FlowStep) => {
    setRightHidden(false);
    setWorksOpen(false);
    setStep(s);
  }, [setStep]);

  /* 미리보기에서 무엇을 눌렀을 때 오른쪽의 어느 자리로 옮겨갈지 */
  const jump = useCallback((tool: string, menuId?: string) => {
    setRightHidden(false);
    setWorksOpen(false);
    if (tool === 'check') { setStep('save'); return; }
    if (tool === 'ai') { setStep('prepare'); return; }
    const t: EditTab = tool === 'media' ? 'photos' : tool === 'menus' ? 'menus' : tool === 'design' ? 'design' : 'content';
    setStep('edit');
    setTab(t);
    if (menuId) {
      setFocusMenuId(menuId);
      setSelectedId(menuId);
    }
  }, [setStep]);

  /* ------------------------------------------------------------------ */
  /* 미리보기에서 바로 고치기                                             */
  /*                                                                    */
  /* 값을 바꾸는 방법은 오른쪽 입력칸과 **똑같다.**                        */
  /* 그래서 자동저장·실행취소가 따로 손볼 것 없이 그대로 된다.              */
  /* ------------------------------------------------------------------ */

  const edit: PreviewEdit = useMemo(
    () => ({
      onProduct: (key, value) =>
        update((d) => {
          if (key === 'listPrice') setPrice(d, 'list', value);
          else if (key === 'salePrice') setPrice(d, 'sale', value);
          else d.product[key] = value;
        }, { label: 'product.' + key }),

      onMenuText: (id, key, value) =>
        update((d) => {
          const m = d.menus.find((x) => x.id === id);
          if (m) m[key] = value;
        }, { label: `menu.${key}.${id}` }),

      onPackage: (pkgId, key, value) =>
        update((d) => {
          const it = d.packages?.find((x) => x.id === pkgId);
          if (it) it[key] = value;
        }, { label: `pkg.${key}.${pkgId}` }),

      onJump: (tool, menuId) => jump(tool, menuId),

      onSection: (action, id) => {
        const m = projectRef.current.menus.find((x) => x.id === id);
        if (!m) return;
        /* 중요한 영역은 지우기 전에 한 번 여쭤본다 */
        if ((action === 'hide' || action === 'del') && KEY_MENU_KINDS.includes(m.kind)) {
          const what = action === 'del' ? '지우시겠습니까?' : '숨기시겠습니까?';
          if (!confirm(`'${m.title}'은(는) 상세페이지에서 중요한 영역입니다. ${what}`)) return;
        }
        if (action === 'del') {
          update((d) => { d.menus = d.menus.filter((x) => x.id !== id); }, { label: 'menu.del', merge: false });
          if (selectedId === id) setSelectedId(null);
          say('지웠습니다. 되돌리려면 실행취소를 눌러주세요.');
          return;
        }
        if (action === 'hide') {
          update((d) => {
            const x = d.menus.find((y) => y.id === id);
            if (x) x.hidden = true;
          }, { label: 'menu.hide', merge: false });
          say('숨겼습니다. [구성]에서 다시 보이게 할 수 있어요.');
          return;
        }
        if (action === 'dup') {
          update((d) => {
            const i = d.menus.findIndex((x) => x.id === id);
            if (i < 0) return;
            d.menus.splice(i + 1, 0, {
              ...d.menus[i], id: uid('menu'),
              title: d.menus[i].title + ' 복사',
              photoIds: [...d.menus[i].photoIds],
              lines: [...d.menus[i].lines],
            });
          }, { label: 'menu.dup', merge: false });
          return;
        }
        /* 위로 / 아래로 — 보이는 것끼리 자리를 바꾼다 */
        update((d) => {
          const visible = d.menus.filter((x) => !x.hidden);
          const vi = visible.findIndex((x) => x.id === id);
          const other = visible[action === 'up' ? vi - 1 : vi + 1];
          if (!other) return;
          const a = d.menus.findIndex((x) => x.id === id);
          const b = d.menus.findIndex((x) => x.id === other.id);
          [d.menus[a], d.menus[b]] = [d.menus[b], d.menus[a]];
        }, { label: 'menu.order', merge: false });
      },

      onAddAt: (index) => setAddAt(index),

      onReorder: (fromId, toId) => {
        if (fromId === toId) return;
        update((d) => {
          const from = d.menus.findIndex((m) => m.id === fromId);
          const to = d.menus.findIndex((m) => m.id === toId);
          if (from < 0 || to < 0) return;
          const [moved] = d.menus.splice(from, 1);
          d.menus.splice(to, 0, moved);
        }, { label: 'menu.order', merge: false });
      },

      onPhotoFiles: (menuId, photoId, files) => {
        void (async () => {
          const added = await readPhotoFiles(files, 'upload');
          if (!added.length) {
            say('사진을 읽지 못했습니다. 다른 사진으로 해보세요.');
            return;
          }
          update((d) => {
            if (photoId) {
              /* 교체 — 자리는 그대로 두고 그림만 바꾼다 */
              replacePhoto(d, photoId, added[0]);
              return;
            }
            const hadMain = d.photos.some((p) => p.kind === 'main');
            d.photos.push(...added);
            const m = d.menus.find((x) => x.id === menuId);
            if (m?.kind === 'main') {
              /* 맨 위 칸에 넣으면 첫 장이 대표사진이 된다. 나머지는 보관함에만 들어간다 */
              setMainPhoto(d, added[0].id);
              return;
            }
            if (!hadMain) setMainPhoto(d, added[0].id);
            if (m) m.photoIds = [...m.photoIds, ...added.map((a) => a.id)];
          }, { label: 'photos.preview', merge: false });
          say(photoId ? '사진을 바꿨습니다.' : `사진 ${added.length}장을 넣었습니다.`);
        })();
      },

      onPhoto: (action, menuId, photoId) => {
        if (action === 'main') {
          update((d) => { setMainPhoto(d, photoId); }, { label: 'photos.main', merge: false });
          say('대표사진으로 정했습니다.');
          return;
        }
        if (action === 'remove') {
          if (!confirm('이 사진을 상세페이지에서 지울까요?')) return;
          update((d) => { removePhoto(d, photoId); }, { label: 'photos.remove', merge: false });
          say('사진을 지웠습니다. 되돌리려면 실행취소를 눌러주세요.');
          return;
        }
        jump('media', menuId);
      },
    }),
    [update, jump, say, selectedId],
  );

  /** 새 상세페이지 — 지금 작업은 잃지 않게 '내 작업'에 보관하고 시작한다 */
  const onNew = async () => {
    setMoreOpen(false);
    const now = projectRef.current;
    if (!isEmptyProject(now)) {
      if (!confirm('지금 작업은 [내 작업]에 보관하고 새 상세페이지를 시작할까요?')) return;
      const id = await saveWork(now, now.title || '이름 없는 작업');
      if (!id) {
        if (!confirm('보관하지 못했습니다. (저장 공간이 부족할 수 있어요) 그래도 새로 시작할까요?')) return;
      }
    }
    newProject(false);
    setSelectedId(null);
    goStep('prepare');
    say('새 상세페이지를 시작합니다.');
  };

  const onOpenFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = await readProjectFile(f);
      replace(data);
      say('작업파일을 불러왔습니다.');
    } catch (e) {
      say(e instanceof Error ? e.message : '작업파일을 읽지 못했습니다.');
    }
  };

  /** 간편 편집으로 바꾸기 전에 무엇이 달라지는지 알려준다 */
  const toggleEdition = () => {
    if (isPro) {
      const ok = confirm(
        '간편 편집에서는 자주 사용하는 기능만 표시합니다.\n'
        + '작업파일과 여러 장 저장 등 모든 기능은 상세 편집에서 사용할 수 있습니다.\n\n'
        + '작성하신 내용은 그대로 남습니다. 간편 편집으로 바꿀까요?',
      );
      if (!ok) return;
      setEdition('lite');
      say('간편 편집으로 바꿨습니다.');
    } else {
      setEdition('pro');
      say('상세 편집으로 바꿨습니다.');
    }
    setMoreOpen(false);
  };

  const view: PanelView = worksOpen ? 'works' : step;

  return (
    <div className="app">
      <header className="top">
        <div className="top__brand">
          BARODU <b>PAGE MAKER</b>
        </div>

        <div className="top__title" title={project.title}>{project.title}</div>

        <div className="top__actions">
          <SaveBadge state={saveState} />
          <button className="btn btn--icon" onClick={undo} disabled={!canUndo} title="되돌리기 (Ctrl+Z)" aria-label="실행취소">
            <Icon name="undo" size={17} />
          </button>
          <button className="btn btn--icon" onClick={redo} disabled={!canRedo} title="다시하기 (Ctrl+Shift+Z)" aria-label="다시하기">
            <Icon name="redo" size={17} />
          </button>

          <div className="moremenu">
            <button
              className="btn btn--icon"
              onClick={() => setMoreOpen((v) => !v)}
              title="더보기"
              aria-label="더보기"
            >
              <Icon name="more" size={17} />
            </button>
            {moreOpen && (
              <>
                <div className="moremenu__mask" onClick={() => setMoreOpen(false)} />
                <div className="moremenu__list">
                  <button onClick={() => void onNew()}>새 상세페이지 만들기</button>
                  <button onClick={() => { setExamples(true); setMoreOpen(false); }}>완성 예시 보기</button>
                  <button onClick={() => { setWorksOpen(true); setRightHidden(false); setMoreOpen(false); }}>
                    내 작업 (보관·다시 열기)
                  </button>
                  <button onClick={() => { fileRef.current?.click(); setMoreOpen(false); }}>작업파일 불러오기</button>
                  <button onClick={() => { downloadProjectFile(project); setMoreOpen(false); say('작업파일을 저장했습니다.'); }}>
                    작업파일 저장
                  </button>
                  <button onClick={toggleEdition}>
                    {isPro ? '간편 편집으로 바꾸기' : '상세 편집으로 바꾸기'}
                  </button>
                  <button onClick={() => { setRightHidden((v) => !v); setMoreOpen(false); }}>
                    {rightHidden ? '편집도구 보기' : '편집도구 숨기기'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,.saypage,application/json"
          hidden
          onChange={(e) => { void onOpenFile(e.target.files?.[0]); e.target.value = ''; }}
        />
      </header>

      {saveError && <div className="warnbar">{saveError}</div>}

      <SplitLayout
        isMobile={isMobile}
        rightHidden={rightHidden}
        left={<Preview edit={edit} selectedId={selectedId} />}
        right={
          <EditorPanel
            view={view}
            onStep={goStep}
            onCloseWorks={() => setWorksOpen(false)}
            tab={tab}
            onTab={setTab}
            focusMenuId={focusMenuId}
            onFocused={clearFocus}
            getStage={() => stageRef.current}
            onNew={() => void onNew()}
          />
        }
      />

      {rightHidden && isMobile && (
        <button className="fab" onClick={() => setRightHidden(false)}>편집도구 열기</button>
      )}

      {/* 미리보기의 '+ 여기에 넣기' — 어떤 영역을 넣을지 고른다 */}
      {addAt !== null && (
        <AddMenuHere
          onClose={() => setAddAt(null)}
          onPick={(kind) => {
            update((d) => {
              const visible = d.menus.filter((m) => !m.hidden);
              const at = addAt >= visible.length
                ? d.menus.length
                : d.menus.findIndex((m) => m.id === visible[addAt].id);
              d.menus.splice(at, 0, makeMenu(kind));
            }, { label: 'menu.add', merge: false });
            setAddAt(null);
            say('넣었습니다. 글자를 눌러 바로 고칠 수 있어요.');
          }}
        />
      )}

      {welcome && (
        <Welcome
          onExamples={() => { markWelcomed(); setExamples(true); }}
          onStart={() => { markWelcomed(); goStep('prepare'); }}
        />
      )}

      {examples && (
        <ExampleViewer
          onClose={() => setExamples(false)}
          onStarted={() => { setExamples(false); setSelectedId(null); goStep('prepare'); say('예시 구성으로 새 상세페이지를 시작합니다.'); }}
        />
      )}

      <ExportStage ref={stageRef} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function SaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  const text =
    state === 'saving' ? '저장 중…' :
    state === 'saved' ? '자동저장됨' :
    state === 'error' ? '자동저장 안 됨' : '';
  if (!text) return null;
  return <span className={'save save--' + state}>{text}</span>;
}
