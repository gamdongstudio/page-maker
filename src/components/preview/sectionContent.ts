import type { MenuItem, ProjectData } from '@/types/project';
import { photosOf } from '@/utils/menuPhotos';
import { youtubeOf } from '@/utils/youtube';

/**
 * 이 영역에 **보여줄 내용이 있는지.**
 *
 * 내용이 없는 영역은 저장 이미지에서 뺀다.
 * 빈 영역을 그대로 저장하면 제목만 덩그러니 남거나 안내 문구가 찍힌다.
 *
 * ⚠ 영역을 지우는 것이 아니다. 작업 내용은 그대로이고, 내용을 넣으면 바로 다시 나온다.
 * ⚠ 기준은 각 영역 모양(sections.tsx)이 "비어 있음" 안내를 띄우는 조건과 같다.
 */
/**
 * 미리보기에 보여줄 영역.
 *
 * 내용이 없는 영역은 **미리보기에서도** 숨긴다. (저장 이미지와 같은 모습)
 * 입력 안내는 오른쪽 편집 칸에만 둔다.
 * ⚠ 데이터는 지우지 않는다. 내용을 넣으면 곧바로 다시 나타난다.
 */
export function shownMenus(project: ProjectData): MenuItem[] {
  return project.menus.filter((m) => !m.hidden && hasContent(m, project));
}

export function hasContent(menu: MenuItem, project: ProjectData): boolean {
  const has = (s?: string) => !!(s && s.trim());
  const lines = menu.lines.some((l) => l.trim());
  const photos = photosOf(menu, project).length > 0;
  const p = project.product;

  switch (menu.kind) {
    case 'main':
      return has(p.name) || has(p.brand) || has(p.tagline) || has(p.listPrice) || has(p.salePrice) || photos;

    case 'cta': {
      const s = project.studio;
      return has(menu.body) || has(p.contact) || has(p.buyLink)
        || has(s?.bookingUrl) || has(s?.phone) || has(s?.sns)
        || has(s?.talkUrl) || has(s?.placeUrl) || !!youtubeOf(s?.videoUrl);
    }

    case 'event': {
      const ev = project.event;
      return has(ev?.body) || has(menu.body) || has(ev?.eventPrice) || has(ev?.listPrice)
        || has(ev?.period) || photos;
    }

    case 'perks':
      return lines || (project.perks ?? []).some((x) => has(x.title));

    case 'price': {
      if ((menu.template ?? 'A') === 'E') return (project.packages ?? []).length > 0;
      const pr = project.pricing;
      return has(pr?.listPrice) || has(pr?.eventPrice) || has(p.listPrice) || has(p.salePrice)
        || has(pr?.includes) || has(pr?.frame) || has(pr?.retouch) || has(pr?.rawFiles)
        || has(pr?.costume) || has(pr?.hairMakeup) || has(pr?.extraPerson)
        || has(pr?.weekendExtra) || has(pr?.etcExtra);
    }

    case 'compare':
      return (project.packages ?? []).length > 0;

    case 'shootConcept':
      return lines || has(menu.body) || (project.concepts ?? []).length > 0 || photos;

    case 'benefit':
      return has(menu.body) || has(p.benefits) || photos;

    case 'recommend':
      return lines || has(menu.body) || has(p.target);

    case 'gallery':
      return photos;

    case 'process':
    case 'prepare':
      return lines;

    case 'free':
      return has(menu.body) || has(menu.button) || photos;

    case 'intro':
      return has(menu.body) || has(p.description) || photos;

    case 'shipping':
      return has(menu.body) || has(p.shipping) || photos;
    case 'howto':
      return has(menu.body) || has(p.howToUse) || photos;
    case 'caution':
      return has(menu.body) || has(p.caution) || photos;

    default:
      return has(menu.body) || lines || photos;
  }
}
