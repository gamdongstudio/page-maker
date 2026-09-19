import type { MenuItem, Photo, ProjectData } from '@/types/project';

/**
 * 메뉴에 보여줄 사진 고르기.
 *
 * ⚠ 여기서 하는 일은 **고르는 것뿐이다.**
 *   사진을 새로 만들거나 얼굴을 손보는 일은 이 프로그램에 없다. (docs/PHOTO-POLICY.md)
 *
 * 컴포넌트 파일이 아닌 곳에 둔다.
 * (컴포넌트 파일이 컴포넌트가 아닌 것을 내보내면 화면이 통째로 깨진 적이 있다)
 */

export function photosOf(menu: MenuItem, project: ProjectData): Photo[] {
  const chosen = menu.photoIds
    .map((id) => project.photos.find((p) => p.id === id))
    .filter(Boolean) as Photo[];
  const list = chosen.length > 0 ? chosen : autoPhotosFor(menu, project);
  /* '사용하지 않음' 으로 둔 사진은 상세페이지에 넣지 않는다 */
  return list.filter((p) => p.kind !== 'unused');
}

/** 메뉴 성격에 맞는 사진 고르기 (사용자가 직접 지정하지 않았을 때) */
export function autoPhotosFor(menu: MenuItem, project: ProjectData): Photo[] {
  /* '제외 추천' 이 붙은 사진은 알아서 넣지 않는다 (사용자가 직접 고르면 그때는 쓴다) */
  /* 최신 소식 이미지는 맨 위 '최신 소식' 영역에만 — 다른 영역(갤러리 등)에 자동으로 넣지 않는다 */
  if (menu.kind === 'news') return project.photos.filter((p) => p.news).slice(0, 1);
  const pool = project.photos.filter((p) => !p.exclude && !p.news);
  const byKind = (k: Photo['kind']) => pool.filter((p) => p.kind === k);

  switch (menu.kind) {
    case 'main':    return byKind('main').slice(0, 1);
    /* 갤러리는 촬영 작품만 — '가격·혜택'(이벤트·가격표) 이미지는 넣지 않는다 */
    case 'gallery': return pool.filter((p) => p.kind !== 'main' && p.kind !== 'unused' && p.kind !== 'event').slice(0, 6);
    case 'review':  return byKind('review').slice(0, 3);
    case 'event':   return byKind('event').slice(0, 2);
    case 'concept':
    case 'shootConcept': return byKind('concept').slice(0, 2);
    case 'compare':
    case 'beforeAfter': return byKind('compare').slice(0, 2);
    case 'intro':
    case 'feature':
    case 'scene':   return byKind('detail').slice(0, 2);
    default:        return [];
  }
}
