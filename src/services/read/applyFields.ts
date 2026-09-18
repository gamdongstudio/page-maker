import type { ProjectData } from '@/types/project';
import { EMPTY_BRIEF } from '@/types/project';
import {
  EMPTY_EVENT, EMPTY_PRICING, EMPTY_STUDIO,
  type StudioInfo,
} from '@/types/studio';
import { uid } from '@/types/defaults';
import type { ReadField } from './parseInfo';

/**
 * 사용자가 확인한 값을 실제 작업에 넣는다.
 *
 * 사용자가 [확인하고 적용] 을 누른 뒤에만 불린다.
 * 비어 있는 값은 넣지 않는다 — 빈 값으로 기존 내용을 지우지 않기 위해서다.
 */
export function applyReadFields(d: ProjectData, fields: ReadField[]): StudioInfo {
  const get = (key: string) => (fields.find((f) => f.key === key)?.value ?? '').trim();
  const lines = (key: string) =>
    get(key).split('\n').map((s) => s.trim()).filter(Boolean);

  /* --- 사진관 공통정보 --- */
  const studio: StudioInfo = { ...EMPTY_STUDIO, ...(d.studio ?? {}) };
  const setIf = (key: keyof StudioInfo, v: string) => { if (v) studio[key] = v; };
  setIf('name', get('shopName'));
  setIf('area', get('area'));
  setIf('address', get('address'));
  setIf('phone', get('phone'));
  setIf('hours', get('hours'));
  setIf('offDays', get('offDays'));
  setIf('bookingUrl', get('bookingUrl'));
  setIf('placeUrl', get('placeUrl'));
  setIf('talkUrl', get('talkUrl'));
  setIf('intro', get('intro'));
  d.studio = studio;

  /* --- 무엇을 만들지 --- */
  d.shoot = { ...(d.shoot ?? EMPTY_BRIEF) };
  if (get('productName')) d.shoot.productName = get('productName');
  if (get('area')) d.shoot.area = get('area');
  if (get('philosophy')) d.shoot.emphasis = get('philosophy');
  if (get('shootingFields')) d.product.category = get('shootingFields');
  if (get('features')) d.product.benefits = get('features');
  if (get('intro') && !d.product.description.trim()) d.product.description = get('intro');

  /* --- 가격 --- */
  const listPrice = get('listPrice');
  const eventPrice = get('eventPrice');
  const includes = lines('includes');
  const extras = lines('extras');
  /* 정상가·이벤트가로 가르지 못한 금액 — 넘겨짚지 않고 적힌 그대로 받아둔다 */
  const otherPrices = lines('otherPrices');
  if (listPrice || eventPrice || includes.length || extras.length || otherPrices.length || get('people')) {
    d.pricing = { ...EMPTY_PRICING, ...(d.pricing ?? {}) };
    if (listPrice) d.pricing.listPrice = listPrice;
    if (eventPrice) d.pricing.eventPrice = eventPrice;
    if (get('people')) d.pricing.people = get('people');
    if (includes.length) d.pricing.includes = includes.join('\n');

    /* 추가비용과 '그 밖에 찾은 가격' 은 같은 칸에 모은다.
       이미 적어두신 내용이 있으면 **지우지 말고 뒤에 잇는다.** */
    const addLines = [...extras, ...otherPrices];
    if (addLines.length) {
      const before = (d.pricing.etcExtra ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
      d.pricing.etcExtra = [...new Set([...before, ...addLines])].join('\n');
    }

    /* 상품정보의 가격도 같이 맞춰둔다 (미리보기·검수가 함께 본다) */
    if (listPrice) d.product.listPrice = listPrice;
    if (eventPrice) d.product.salePrice = eventPrice;
  }

  /* --- 이벤트 --- */
  const period = get('eventPeriod');
  const eventTitle = get('eventTitle');
  const eventBody = get('eventBody');
  if (period || eventTitle || eventBody || (eventPrice && listPrice)) {
    d.event = { ...EMPTY_EVENT, ...(d.event ?? {}) };
    if (eventTitle) d.event.title = eventTitle;
    if (eventBody) d.event.body = eventBody;
    if (period) d.event.period = period;
    if (listPrice) d.event.listPrice = listPrice;
    if (eventPrice) d.event.eventPrice = eventPrice;
    if (!d.event.title) d.event.title = '이벤트';
  }

  /* --- 혜택 --- */
  const perks = lines('perks');
  if (perks.length) {
    d.perks = perks.map((line) => {
      const [title, ...rest] = line.split('|');
      return { id: uid('perk'), title: title.trim(), body: rest.join('|').trim(), photoId: '', icon: '' };
    });
  }

  /* --- 촬영 콘셉트 --- */
  const concepts = lines('concepts');
  if (concepts.length) {
    d.concepts = concepts.map((name) => ({
      id: uid('cc'), name, summary: '', body: '', mainPhotoId: '', photoIds: [],
    }));
  }

  /* --- 문의 정보 (마지막 예약·문의에서 쓴다) --- */
  const contact = [studio.phone, studio.bookingUrl, studio.talkUrl].filter(Boolean).join(' · ');
  if (contact) d.product.contact = contact;
  if (studio.name) d.product.brand = studio.name;

  return studio;
}
