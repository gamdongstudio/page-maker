import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorPanel, type StepKey } from '@/components/editor/EditorPanel';
import { Icon } from '@/components/ui/Icon';
import { SplitLayout } from '@/components/layout/SplitLayout';
import { Preview } from '@/components/preview/Preview';
import { useProject } from '@/store/ProjectStore';
import { useEdition } from '@/store/EditionContext';
import { downloadProjectFile, readProjectFile } from '@/services/storage/local';
import { ExportStage } from '@/components/export/ExportStage';
import type { PreviewEdit } from '@/components/preview/editApi';
import { AddMenuHere } from '@/components/menus/AddMenuHere';
import { KEY_MENU_KINDS, makeMenu, uid } from '@/types/defaults';
import { readPhotoFiles } from '@/utils/image';
import { removePhoto, setMainPhoto, setPrice } from '@/utils/photoOps';

/**
 * 한 화면에서 전부 한다.
 *
 * 왼쪽 미리보기 · 오른쪽 제작도구 구조를 처음부터 끝까지 유지한다.
 * AI 도 별도 화면이 아니라 오른쪽 ⑤ 패널 안에서 돈다.
 */
export default function App() {
  const {
    project, replace, update, undo, redo, canUndo, canRedo, saveState, saveError, newProject,
  } = useProject();
  const { isPro, setEdition } = useEdition();

  const [rightHidden, setRightHidden] = useState(false);
  /* 처음 열면 시작 화면을 거치지 않고 **바로 제작 화면**이다 (왼쪽 미리보기 + 오른쪽 도구) */
  const [openStep, setOpenStep] = useState<StepKey | null>('ai');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [toast, setToast] = useState('');
  const [focusMenuId, setFocusMenuId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  /** ⑤ 패널로 옮겨가야 할 때 올려두는 표시 */
  const [jumpTo, setJumpTo] = useState<StepKey | null>(null);
  /** 미리보기의 '+ 여기에 넣기' 를 눌렀을 때 — 보이는 것 기준 자리 */
  const [addAt, setAddAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const clearFocus = useCallback(() => setFocusMenuId(null), []);

  const say = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  /* 미리보기에서 무엇을 눌렀을 때 오른쪽의 어느 자리로 옮겨갈지 */
  const jump = useCallback((tool: StepKey, menuId?: string) => {
    setRightHidden(false);
    setOpenStep(tool);
    if (menuId) setFocusMenuId(menuId);
    setJumpTo(tool);
  }, []);

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

      onJump: (tool, menuId) => jump(tool as StepKey, menuId),

      onSection: (action, id) => {
        const m = project.menus.find((x) => x.id === id);
        if (!m) return;
        /* 사진관 상세페이지에서 중요한 영역은 지우기 전에 한 번 여쭤본다 */
        if ((action === 'hide' || action === 'del') && KEY_MENU_KINDS.includes(m.kind)) {
          const what = action === 'del' ? '지우시겠습니까?' : '숨기시겠습니까?';
          if (!confirm(`'${m.title}'은(는) 사진관 상세페이지에서 중요한 영역입니다. ${what}`)) return;
        }
        if (action === 'del') {
          update((d) => { d.menus = d.menus.filter((x) => x.id !== id); }, { label: 'menu.del', merge: false });
          say('지웠습니다. 되돌리려면 실행취소를 눌러주세요.');
          return;
        }
        if (action === 'hide') {
          update((d) => {
            const x = d.menus.find((y) => y.id === id);
            if (x) x.hidden = true;
          }, { label: 'menu.hide', merge: false });
          say('숨겼습니다. 구성 편집에서 다시 보이게 할 수 있어요.');
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
          const added = await readPhotoFiles(files);
          if (!added.length) {
            say('사진을 읽지 못했습니다. 다른 사진으로 해보세요.');
            return;
          }
          update((d) => {
            if (photoId) {
              /* 교체 — 자리는 그대로 두고 그림만 바꾼다 (id 를 유지해야 배치가 안 흐트러진다) */
              const i = d.photos.findIndex((p) => p.id === photoId);
              if (i >= 0) {
                const old = d.photos[i];
                d.photos[i] = { ...added[0], id: old.id, kind: old.kind, caption: old.caption };
                return;
              }
            }
            const hadMain = d.photos.some((p) => p.kind === 'main');
            d.photos.push(...added);
            const m = d.menus.find((x) => x.id === menuId);
            if (m?.kind === 'main') {
              /* 맨 위 칸에 넣으면 첫 장이 대표사진이 된다. 나머지는 보관함에만 들어간다 */
              setMainPhoto(d, added[0].id);
              return;
            }
            if (!hadMain) added[0].kind = 'main';
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
    [update, project.menus, jump, say],
  );

  const onNew = () => {
    if (!confirm('지금 작업한 내용이 모두 지워집니다. 새로 시작할까요?')) return;
    newProject(false);
    setOpenStep('ai');
    setMoreOpen(false);
    say('새로 시작합니다.');
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
        + '작업파일과 분할 저장 등 모든 기능은 상세 편집에서 사용할 수 있습니다.\n\n'
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

  return (
    <div className="app">
      <header className="top">
        <div className="top__brand">
          BARODU <b>PAGE MAKER</b> <em>{isPro ? '상세 편집' : '간편 편집'}</em>
        </div>

        <div className="top__title" title={project.title}>{project.title}</div>

        <div className="top__actions">
          <button className="btn btn--icon" onClick={undo} disabled={!canUndo} title="실행취소 (Ctrl+Z)" aria-label="실행취소">
            <Icon name="undo" size={17} />
          </button>
          <button className="btn btn--icon" onClick={redo} disabled={!canRedo} title="다시하기 (Ctrl+Shift+Z)" aria-label="다시하기">
            <Icon name="redo" size={17} />
          </button>
          <span className="divider" />
          <button
            className="btn btn--main"
            onClick={() => { setRightHidden(false); setOpenStep('check'); setJumpTo('check'); }}
          >
            <Icon name="download" size={16} />완성·저장
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
                  <button onClick={onNew}>새로 시작</button>
                  <button onClick={() => { setOpenStep('works'); setJumpTo('works'); setMoreOpen(false); }}>
                    내 작업 (저장·불러오기)
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

          <SaveBadge state={saveState} />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => { void onOpenFile(e.target.files?.[0]); e.target.value = ''; }}
        />
      </header>

      {saveError && <div className="warnbar">{saveError}</div>}

      <SplitLayout
        isMobile={isMobile}
        rightHidden={rightHidden}
        left={<Preview edit={edit} />}
        right={
          <EditorPanel
            openStep={openStep}
            setOpenStep={setOpenStep}
            focusMenuId={focusMenuId}
            onFocused={clearFocus}
            jumpTo={jumpTo}
            onJumped={() => setJumpTo(null)}
            getStage={() => stageRef.current}
          />
        }
      />

      {rightHidden && isMobile && (
        <button className="fab" onClick={() => setRightHidden(false)}>편집도구 열기</button>
      )}

      {/* 미리보기의 '+ 여기에 넣기' — 어떤 메뉴를 넣을지 고른다 */}
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

      <ExportStage ref={stageRef} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function SaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  const text =
    state === 'saving' ? '저장 중…' :
    state === 'saved' ? '자동저장됨' :
    state === 'error' ? '저장 실패' : '';
  if (!text) return null;
  return <span className={'save save--' + state}>{text}</span>;
}
