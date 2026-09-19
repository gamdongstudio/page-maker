import type { ProjectData } from '@/types/project';
import { placeIdOf } from '@/services/import/baroduTools';
import type { ReadField } from './parseInfo';

/**
 * 같은 업체인지 가르기.
 *
 * 새 주소에서 가져온 자료는 바로 작업에 넣지 않는다.
 * 먼저 지금 작업의 업체와 같은지 보고, 다른 업체라면 새 작업으로 시작하게 한다.
 * (사랑이야기 작업에 감동사진관 자료가 섞이는 일을 막기 위해서)
 */

export interface PlaceCard {
  placeId: string;
  name: string;
  area: string;
  address: string;
  phone: string;
}

export type SameResult = 'same' | 'different' | 'unknown';

/** 새로 가져온 자료의 업체 */
export function cardFromFields(fields: ReadField[], url = ''): PlaceCard {
  const get = (k: string) => (fields.find((f) => f.key === k)?.value ?? '').trim();
  return {
    placeId: placeIdOf(get('placeUrl')) || placeIdOf(url),
    name: get('shopName'),
    area: get('area'),
    address: get('address'),
    phone: get('phone'),
  };
}

/** 지금 작업의 업체 */
export function cardFromProject(p: ProjectData): PlaceCard {
  const s = p.studio;
  /* 가져오기에 성공한 주소만 본다 — 실패한 다른 업체 주소가 기준이 되면 안 된다 */
  const fromSources = (p.sources ?? []).filter((x) => x.state === 'ok').map((x) => placeIdOf(x.url)).find(Boolean) ?? '';
  return {
    placeId: placeIdOf(s?.placeUrl ?? '') || fromSources,
    name: (s?.name ?? '').trim(),
    area: (s?.area ?? '').trim(),
    address: (s?.address ?? '').trim(),
    phone: (s?.phone ?? '').trim(),
  };
}

export function hasBusiness(c: PlaceCard): boolean {
  return !!(c.placeId || c.name || c.address);
}

/** 화면에 보여줄 한 줄 — '감동사진관 · 광명' */
export function cardLabel(c: PlaceCard): string {
  return [c.name || '이름 모름', c.area].filter(Boolean).join(' · ');
}

const bareName = (s: string) => s.replace(/\s+/g, '').replace(/(스튜디오|사진관|studio)/gi, '').toLowerCase();
const digits = (s: string) => s.replace(/\D/g, '');
const addrKey = (s: string) => s.replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');

/**
 * 1) 업체 번호가 둘 다 있으면 그것으로 끝낸다
 * 2) 이름 + (주소 또는 전화) 가 같으면 같은 업체
 * 3) 지역이 다르거나, 이름·주소가 모두 다르면 다른 업체
 * 4) 그 밖에는 모른다 — 모를 때는 합치지 않는다
 */
export function samePlace(a: PlaceCard, b: PlaceCard): SameResult {
  if (a.placeId && b.placeId) return a.placeId === b.placeId ? 'same' : 'different';

  const na = bareName(a.name);
  const nb = bareName(b.name);
  const nameSame = !!na && !!nb && (na === nb || na.includes(nb) || nb.includes(na));
  const phoneSame = digits(a.phone).length >= 9 && digits(a.phone) === digits(b.phone);
  const addrSame = !!a.address && !!b.address && addrKey(a.address) === addrKey(b.address);

  if (nameSame && (addrSame || phoneSame)) return 'same';
  if (addrSame && phoneSame) return 'same';
  if (a.area && b.area && a.area !== b.area) return 'different';
  if (na && nb && !nameSame && a.address && b.address && !addrSame) return 'different';
  return 'unknown';
}
