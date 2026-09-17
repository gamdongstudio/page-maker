import type { Photo, ProjectData } from '@/types/project';

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

/**
 * 사진 바꾸기 — 자리는 그대로 두고 그림만 바꾼다.
 * id 를 유지해야 이 사진을 쓰던 영역 배치가 흐트러지지 않는다.
 */
export function replacePhoto(d: ProjectData, photoId: string, next: Photo): void {
  const i = d.photos.findIndex((p) => p.id === photoId);
  if (i < 0) return;
  const old = d.photos[i];
  d.photos[i] = { ...next, id: old.id, kind: old.kind, caption: old.caption, source: next.source ?? 'upload' };
}

/** '제외 추천'을 받아들이기 — 지우지 않고 '사용하지 않음'으로 둔다 */
export function excludePhoto(d: ProjectData, photoId: string): void {
  const p = d.photos.find((x) => x.id === photoId);
  if (!p) return;
  const wasMain = p.kind === 'main';
  p.kind = 'unused';
  delete p.exclude;
  if (wasMain) {
    const next = d.photos.find((x) => x.kind !== 'unused');
    if (next) setMainPhoto(d, next.id);
  }
}

/** 사진 순서 바꾸기 */
export function movePhoto(d: ProjectData, fromId: string, toId: string): void {
  if (fromId === toId) return;
  const from = d.photos.findIndex((p) => p.id === fromId);
  const to = d.photos.findIndex((p) => p.id === toId);
  if (from < 0 || to < 0) return;
  const [moved] = d.photos.splice(from, 1);
  d.photos.splice(to, 0, moved);
}

/**
 * 가격 맞추기.
 *
 * 가격은 여러 곳(상품정보 · 가격 안내 · 이벤트)에서 보인다.
 * 한 곳만 바꾸면 **화면마다 다른 가격이 보인다.** 그래서 늘 같이 바꾼다.
 */
export function setPrice(d: ProjectData, which: 'list' | 'sale', value: string): void {
  const v = value.replace(/[^\d]/g, '');
  if (which === 'list') {
    d.product.listPrice = v;
    if (d.pricing) d.pricing.listPrice = v;
    if (d.event && d.event.listPrice !== undefined && (d.event.listPrice || d.event.eventPrice)) d.event.listPrice = v;
  } else {
    d.product.salePrice = v;
    if (d.pricing) d.pricing.eventPrice = v;
    if (d.event && (d.event.listPrice || d.event.eventPrice)) d.event.eventPrice = v;
  }
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
