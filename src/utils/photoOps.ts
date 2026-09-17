import type { ProjectData } from '@/types/project';

/**
 * 사진 다루기 — 여러 화면이 **같은 방식**으로 바꾸도록 한 곳에 둔다.
 * (화면마다 따로 고치면 한쪽만 맞고 한쪽은 어긋난다)
 *
 * ⚠ 사진 자체는 손대지 않는다. 어디에 쓸지만 정한다.
 */

/**
 * 대표사진 정하기.
 *
 * 맨 위(메인) 영역에 사진을 직접 골라둔 경우에도 **맨 위 사진이 함께 바뀐다.**
 * (예전에는 대표를 바꿔도 맨 위 사진이 그대로여서 눌러도 안 되는 것처럼 보였다)
 */
export function setMainPhoto(d: ProjectData, photoId: string): void {
  const target = d.photos.find((p) => p.id === photoId);
  if (!target) return;
  d.photos.forEach((p) => { if (p.kind === 'main' && p.id !== photoId) p.kind = 'product'; });
  target.kind = 'main';
  d.menus.forEach((m) => {
    if (m.kind === 'main' && m.photoIds.length > 0) m.photoIds = [photoId];
  });
}

/** 사진 지우기 — 그 사진을 쓰던 모든 영역에서도 함께 뺀다 */
export function removePhoto(d: ProjectData, photoId: string): void {
  const wasMain = d.photos.find((p) => p.id === photoId)?.kind === 'main';
  d.photos = d.photos.filter((p) => p.id !== photoId);
  d.menus.forEach((m) => { m.photoIds = m.photoIds.filter((id) => id !== photoId); });
  d.packages?.forEach((pk) => { if (pk.photoId === photoId) pk.photoId = ''; });
  /* 대표를 지웠으면 남은 첫 사진을 대표로 — 맨 위가 비지 않게 */
  if (wasMain) {
    const next = d.photos.find((p) => p.kind !== 'unused');
    if (next) next.kind = 'main';
  }
}
