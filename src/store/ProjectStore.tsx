import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState,
} from 'react';
import type { ProjectData } from '@/types/project';
import { createProject } from '@/types/defaults';
import { clearProject, loadProject, saveProject } from '@/services/storage/local';

/**
 * 프로젝트 상태 + 자동저장 + 실행취소/다시하기.
 *
 * 중요: 되돌리기 기록(past/future)까지 **하나의 상태**로 두고 순수 함수로만 바꾼다.
 * (상태 갱신 함수 안에서 바깥 값을 건드리면 React 개발 모드의 이중 호출 때문에
 *  기록이 어긋나 실행취소가 동작하지 않는다 — 실제로 겪은 문제라 이 구조를 지킨다)
 */

const HISTORY_LIMIT = 50;
/** 글자를 칠 때마다 기록하지 않고 잠깐 모아서 한 번에 기록한다 (ms) */
const HISTORY_MERGE_MS = 700;
const AUTOSAVE_MS = 400;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface HistoryState {
  past: ProjectData[];
  present: ProjectData;
  future: ProjectData[];
  /** 연속 입력을 하나로 묶기 위한 표시 */
  lastLabel: string;
  lastAt: number;
}

type Action =
  | { type: 'update'; recipe: (d: ProjectData) => void; label: string; at: number; merge: boolean }
  | { type: 'replace'; next: ProjectData }
  /** 처음 열 때 저장해 둔 작업을 올려놓는 것 — 되돌리기 기록에 남기지 않는다 */
  | { type: 'hydrate'; next: ProjectData }
  | { type: 'undo' }
  | { type: 'redo' };

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'update': {
      const draft = clone(state.present);
      action.recipe(draft);
      draft.updatedAt = action.at;

      const mergeable =
        action.merge &&
        action.label !== '' &&
        action.label === state.lastLabel &&
        action.at - state.lastAt < HISTORY_MERGE_MS;

      const past = mergeable
        ? state.past
        : [...state.past, state.present].slice(-HISTORY_LIMIT);

      return { past, present: draft, future: [], lastLabel: action.label, lastAt: action.at };
    }

    case 'replace':
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: clone(action.next),
        future: [],
        lastLabel: '',
        lastAt: 0,
      };

    /* 이어하기: 기록을 처음부터 다시 시작한다.
       (실행취소를 눌렀을 때 내 작업이 아닌 샘플로 돌아가면 안 된다) */
    case 'hydrate':
      return {
        past: [],
        present: clone(action.next),
        future: [],
        lastLabel: '',
        lastAt: 0,
      };

    case 'undo': {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
        lastLabel: '',
        lastAt: 0,
      };
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: state.future.slice(1),
        lastLabel: '',
        lastAt: 0,
      };
    }

    default:
      return state;
  }
}

interface ProjectContextValue {
  project: ProjectData;
  /** 되돌릴 수 있는 변경 */
  update: (recipe: (draft: ProjectData) => void, opts?: { label?: string; merge?: boolean }) => void;
  /** 프로젝트 통째로 교체 (새 프로젝트 / 불러오기) */
  replace: (next: ProjectData) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: SaveState;
  saveError: string | null;
  newProject: (sample?: boolean) => void;
  /** 처음 열 때 자동저장 작업을 이어서 불러왔다면 그 작업의 마지막 저장 시각 (없으면 0) */
  restoredAt: number;
}

const Ctx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, (): HistoryState => ({
    past: [],
    /* 저장된 작업은 조금 뒤에 올라온다. 그 전까지는 샘플을 보여준다. */
    present: createProject({ sample: true }),
    future: [],
    lastLabel: '',
    lastAt: 0,
  }));

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  /** 저장해 둔 작업을 아직 올리는 중이면 저장하지 않는다 (샘플로 덮어쓰면 안 된다) */
  const [ready, setReady] = useState(false);
  const askedOnce = useRef(false);
  /** 불러오기가 끝나기 전에 사용자가 벌써 뭔가 고쳤는지 */
  const touched = useRef(false);
  /** 방금 저장한 시각 — 같은 내용을 또 저장하지 않으려고 */
  const savedAt = useRef(0);
  const [restoredAt, setRestoredAt] = useState(0);

  /* ---------------- 처음 열 때: 최근 작업 이어하기 ---------------- */
  useEffect(() => {
    /*
     * 한 번만 불러온다.
     * 여기서 "화면이 사라지면 그만두기" 같은 장치를 두면 안 된다 —
     * React 개발 모드는 화면을 한 번 붙였다 떼었다 다시 붙이는데,
     * 그때 불러오기가 취소돼 저장해 둔 작업이 영영 올라오지 않는다.
     * (실제로 겪은 문제라 이 구조를 지킨다)
     */
    if (askedOnce.current) return;
    askedOnce.current = true;

    void loadProject().then((found) => {
      /* 불러오는 사이에 사용자가 벌써 뭔가 적었다면 그것을 지우지 않는다 */
      if (found && !touched.current) {
        savedAt.current = found.updatedAt;
        dispatch({ type: 'hydrate', next: found });
        setRestoredAt(found.updatedAt || Date.now());
      }
      setReady(true);
    });
  }, []);

  /* ---------------- 자동저장 ---------------- */
  useEffect(() => {
    /* 아직 이어하기 중이거나, 방금 저장한 그대로면 넘어간다 */
    if (!ready || state.present.updatedAt === savedAt.current) return;

    setSaveState('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const at = state.present.updatedAt;
      void saveProject(state.present).then((res) => {
        if (res.ok) savedAt.current = at;
        setSaveState(res.ok ? 'saved' : 'error');
        setSaveError(res.ok ? null : res.reason);
      });
    }, AUTOSAVE_MS);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state.present, ready]);

  const update = useCallback(
    (recipe: (draft: ProjectData) => void, opts?: { label?: string; merge?: boolean }) => {
      touched.current = true;
      dispatch({
        type: 'update',
        recipe,
        label: opts?.label ?? '',
        merge: opts?.merge !== false,
        at: Date.now(),
      });
    },
    [],
  );

  const replace = useCallback((next: ProjectData) => {
    touched.current = true;
    dispatch({ type: 'replace', next });
  }, []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);

  const newProject = useCallback((sample = false) => {
    touched.current = true;
    void clearProject();
    dispatch({ type: 'replace', next: createProject({ sample }) });
  }, []);

  /* 단축키: Ctrl+Z / Ctrl+Shift+Z */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const t = e.target as HTMLElement | null;
      /* 입력 중에는 방해하지 않는다 — 미리보기에서 글자를 고치는 중(눌러서 고치는 칸)도 마찬가지.
         (예전에는 미리보기 글자를 고치다 Ctrl+Z 를 누르면 작업 전체가 한 단계 되돌아갔다) */
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      project: state.present,
      update,
      replace,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      saveState,
      saveError,
      newProject,
      restoredAt,
    }),
    [state.present, state.past.length, state.future.length, update, replace, undo, redo, saveState, saveError, newProject, restoredAt],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProject(): ProjectContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('ProjectProvider 안에서만 사용할 수 있습니다.');
  return v;
}
