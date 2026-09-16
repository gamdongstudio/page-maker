import { PROJECT_VERSION, type ProjectData } from '@/types/project';
import { dbDel, dbGet, dbSet } from './db';
import { normalizeFont } from '@/config/fonts';

/**
 * 최근 작업 저장 / 불러오기.
 *
 * 저장 위치는 이 컴퓨터의 브라우저 안이다. 서버로 보내지 않는다.
 * 사진이 많아도 저장되도록 넉넉한 저장소(db.ts)를 먼저 쓰고,
 * 그걸 못 쓰는 환경에서만 예전 방식(localStorage)으로 물러난다.
 */

/** 예전 방식으로 저장해 두었던 자리 — 한 번 옮기고 나면 비운다 */
const OLD_KEY = 'saypagemaker.current.v1';
/** 넉넉한 저장소 안에서 쓰는 이름 */
const CURRENT_KEY = 'current';

/** 지금 쓰는 간편 스타일 목록 */
const KNOWN_PRESETS = ['clean', 'luxury', 'emotional', 'warm', 'minimal', 'bright'];

export type SaveResult = { ok: true } | { ok: false; reason: string };

/** 작업한 적이 있는지 빠르게 알기 위한 표시 (첫 화면을 정할 때만 쓴다) */
const HAS_WORK_KEY = 'saypagemaker.hasWork';

export function hasWork(): boolean {
  try {
    return localStorage.getItem(HAS_WORK_KEY) === '1';
  } catch {
    return false;
  }
}

function markWork(on: boolean): void {
  try {
    if (on) localStorage.setItem(HAS_WORK_KEY, '1');
    else localStorage.removeItem(HAS_WORK_KEY);
  } catch {
    /* 무시 */
  }
}

/* ------------------------------------------------------------------ */
/* 최근 작업                                                            */
/* ------------------------------------------------------------------ */

/**
 * 최근 작업 불러오기.
 * 넉넉한 저장소를 먼저 보고, 없으면 예전 자리를 본다.
 * 예전 자리에서 찾으면 새 저장소로 옮겨주고 예전 자리는 비운다.
 */
export async function loadProject(): Promise<ProjectData | null> {
  const fromDb = await dbGet<ProjectData>(CURRENT_KEY);
  if (fromDb && typeof fromDb === 'object') return migrate(fromDb);

  const old = readOld();
  if (!old) return null;

  /* 예전에 쓰던 작업을 새 저장소로 옮긴다 */
  const moved = await dbSet(CURRENT_KEY, old);
  if (moved) clearOld();
  return old;
}

/** 최근 작업 저장하기 */
export async function saveProject(data: ProjectData): Promise<SaveResult> {
  if (await dbSet(CURRENT_KEY, data)) { markWork(true); return { ok: true }; }

  /* 넉넉한 저장소를 못 쓰는 환경이면 예전 방식으로라도 저장해 본다 */
  try {
    localStorage.setItem(OLD_KEY, JSON.stringify(data));
    markWork(true);
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: '사진이 많아 저장 공간이 가득 찼습니다. 사진을 줄이거나 [작업파일 저장]으로 파일을 받아두세요.',
    };
  }
}

/** 최근 작업 지우기 (새 프로젝트) */
export async function clearProject(): Promise<void> {
  await dbDel(CURRENT_KEY);
  clearOld();
  markWork(false);
}

function readOld(): ProjectData | null {
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ProjectData;
    if (!data || typeof data !== 'object') return null;
    return migrate(data);
  } catch {
    return null;
  }
}

function clearOld(): void {
  try {
    localStorage.removeItem(OLD_KEY);
  } catch {
    /* 무시 */
  }
}

/* ------------------------------------------------------------------ */
/* 옛 형식 맞춰주기                                                     */
/* ------------------------------------------------------------------ */

/** 옛 형식으로 저장된 파일도 읽을 수 있게 한다 */
export function migrate(data: ProjectData): ProjectData {
  const out = { ...data };
  if (typeof out.version !== 'number') out.version = PROJECT_VERSION;
  out.photos = Array.isArray(out.photos) ? out.photos : [];
  out.videos = Array.isArray(out.videos) ? out.videos : [];
  out.menus = Array.isArray(out.menus) ? out.menus : [];
  /* 예전에 저장한 파일에는 없는 값이므로 기본값을 채워준다 */
  if (out.design && !out.design.heroShape) out.design = { ...out.design, heroShape: 'auto' };
  /* 예전 글꼴 이름(나눔명조 등)으로 저장된 파일도 열리게 한다 */
  if (out.design) {
    out.design = {
      ...out.design,
      titleFont: normalizeFont(out.design.titleFont),
      bodyFont: normalizeFont(out.design.bodyFont),
    };
  }
  /* 지금은 없어진 스타일(강렬한)로 저장된 파일도 열리게 한다.
     색·글씨·여백은 사용자가 만든 그대로 두고 스타일 이름만 바꾼다. */
  if (out.design && !KNOWN_PRESETS.includes(out.design.preset)) {
    out.design = { ...out.design, preset: 'clean' };
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 작업파일 저장 / 불러오기                                              */
/* ------------------------------------------------------------------ */

export function downloadProjectFile(data: ProjectData): void {
  const safe = (data.title || '상세페이지').replace(/[\\/:*?"<>|]/g, '').trim() || '상세페이지';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}.saypage.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readProjectFile(file: File): Promise<ProjectData> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(String(r.result)) as ProjectData;
        if (!data || !data.product || !Array.isArray(data.menus)) {
          reject(new Error('작업파일 형식이 아닙니다.'));
          return;
        }
        resolve(migrate(data));
      } catch {
        reject(new Error('작업파일을 읽지 못했습니다.'));
      }
    };
    r.onerror = () => reject(new Error('작업파일을 읽지 못했습니다.'));
    r.readAsText(file);
  });
}
