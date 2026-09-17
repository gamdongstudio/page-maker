import { dbGet, dbSet } from './db';
import { migrate } from './local';
import type { ProjectData } from '@/types/project';

/**
 * 큰 변경 직전 모습 보관.
 *
 * 자동 추천 · 자료 가져오기 · 스타일 전체 변경처럼 **한 번에 많이 바뀌는 일** 바로 전에
 * 지금 모습을 남겨둔다. 실행취소는 창을 닫으면 사라지지만, 이것은 이 컴퓨터에 남는다.
 *
 * 너무 많이 쌓이지 않게 최근 3개만 둔다. (사진이 들어 있어 용량이 크다)
 */

const KEY = 'snapshots';
const KEEP = 3;

export interface Snapshot {
  at: number;
  /** 무엇을 하기 전인지 — 사람이 읽는 말 */
  reason: string;
  data: ProjectData;
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const got = await dbGet<Snapshot[]>(KEY);
  return Array.isArray(got) ? got : [];
}

export async function saveSnapshot(data: ProjectData, reason: string): Promise<void> {
  const list = await listSnapshots();
  const copy = JSON.parse(JSON.stringify(data)) as ProjectData;
  await dbSet(KEY, [{ at: Date.now(), reason, data: copy }, ...list].slice(0, KEEP));
}

export async function openSnapshot(at: number): Promise<ProjectData | null> {
  const hit = (await listSnapshots()).find((s) => s.at === at);
  return hit ? migrate(hit.data) : null;
}
