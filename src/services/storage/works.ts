import { dbDel, dbGet, dbSet } from './db';
import { migrate } from './local';
import { uid } from '@/types/defaults';
import type { ProjectData } from '@/types/project';

/**
 * 내 작업 — 사용자가 이름을 붙여 보관하는 상세페이지.
 *
 * 자동저장과는 다르다.
 *  - 자동저장: 지금 하던 것을 잃지 않게 계속 덮어쓴다 (한 개)
 *  - 내 작업: 사장님이 이름을 붙여 남겨두는 것 (여러 개)
 *
 * 목록과 내용을 따로 둔다. 목록만 읽을 때 사진까지 전부 읽지 않기 위해서다.
 */

const LIST_KEY = 'works.list';
const ITEM = (id: string) => `work.${id}`;

export interface WorkSummary {
  id: string;
  name: string;
  updatedAt: number;
  /** 목록에서 보여줄 작은 정보 */
  photoCount: number;
  productName: string;
}

/* ------------------------------------------------------------------ */

export async function listWorks(): Promise<WorkSummary[]> {
  const list = await dbGet<WorkSummary[]>(LIST_KEY);
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function writeList(list: WorkSummary[]): Promise<boolean> {
  return dbSet(LIST_KEY, list);
}

/** 이름을 붙여 보관 (같은 id 면 덮어쓴다) */
export async function saveWork(data: ProjectData, name: string, id?: string): Promise<string | null> {
  const workId = id ?? uid('work');
  const copy: ProjectData = JSON.parse(JSON.stringify(data));
  copy.title = name;

  const ok = await dbSet(ITEM(workId), copy);
  if (!ok) return null;

  const list = await listWorks();
  const summary: WorkSummary = {
    id: workId,
    name,
    updatedAt: Date.now(),
    photoCount: copy.photos.length,
    productName: copy.shoot?.productName ?? copy.product.category ?? '',
  };
  const next = [summary, ...list.filter((w) => w.id !== workId)];
  await writeList(next);
  return workId;
}

export async function openWork(id: string): Promise<ProjectData | null> {
  const got = await dbGet<ProjectData>(ITEM(id));
  if (!got || typeof got !== 'object') return null;
  /* 옛 형식으로 저장된 것도 그대로 열린다 */
  return migrate(got);
}

/**
 * 새로 시작하기 전에 지금 작업을 [내 작업]에 보관한다 (빈 작업이면 건너뜀).
 * 같은 작업을 여러 번 보관해도 목록에 하나만 남도록 작업 번호를 그대로 쓴다.
 * 보관하지 못했으면 false — 이때는 새로 시작하지 않는다.
 */
export async function keepCurrentWork(now: ProjectData, isEmpty: boolean): Promise<boolean> {
  if (isEmpty) return true;
  const name = (now.studio?.name || now.title || '이름 없는 작업').trim();
  return !!(await saveWork(now, name, now.id));
}

/** 복제 — 디자인과 구성은 그대로 두고 새 작업으로 만든다 */
export async function duplicateWork(id: string): Promise<string | null> {
  const src = await openWork(id);
  if (!src) return null;
  const copy: ProjectData = JSON.parse(JSON.stringify(src));
  copy.id = uid('prj');
  return saveWork(copy, `${src.title} 복사본`);
}

export async function renameWork(id: string, name: string): Promise<void> {
  const data = await openWork(id);
  if (data) {
    data.title = name;
    await dbSet(ITEM(id), data);
  }
  const list = await listWorks();
  await writeList(list.map((w) => (w.id === id ? { ...w, name, updatedAt: Date.now() } : w)));
}

/** 지우기 — 화면에서 반드시 한 번 확인한 뒤에만 부른다 */
export async function deleteWork(id: string): Promise<void> {
  await dbDel(ITEM(id));
  const list = await listWorks();
  await writeList(list.filter((w) => w.id !== id));
}

/* ------------------------------------------------------------------ */

/** 사람이 읽는 시각 ('20분 전' 처럼) */
export function whenText(at: number): string {
  const diff = Date.now() - at;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
