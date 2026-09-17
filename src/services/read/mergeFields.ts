import type { ProjectData } from '@/types/project';
import { EMPTY_BRIEF } from '@/types/project';
import { EMPTY_EVENT, EMPTY_PRICING, EMPTY_STUDIO } from '@/types/studio';
import { uid } from '@/types/defaults';
import { setPrice } from '@/utils/photoOps';
import type { ReadField } from './parseInfo';

/**
 * 가져온 자료를 **지금 작업에 합치기.**
 *
 *  - 비어 있는 칸은 바로 채운다.
 *  - 이미 적힌 칸과 **다르면 덮어쓰지 않는다.** 기존 값과 새 값을 나란히 보여주고
 *    [추가] [기존 내용 바꾸기] [무시] 중에서 사용자가 고르게 한다.
 *  - 같은 값이면 아무것도 하지 않는다.
 *
 * 주소를 여러 개 넣어 자료를 합칠 때, 먼저 고쳐둔 내용이 뒤에 가져온 자료로 사라지지 않게 하는 곳이다.
 */

export interface FieldChange {
  key: string;
  label: string;
  /** 지금 적혀 있는 값 */
  current: string;
  /** 새 자료에서 찾은 값 */
  incoming: string;
  /** 여러 줄 글이라 '추가'로 이어 붙일 수 있는지 */
  text: boolean;
}

/** 여러 줄로 이어 붙일 수 있는 항목 */
const TEXT_KEYS = new Set(['includes', 'extras', 'otherPrices', 'perks', 'concepts']);

/** 화면에 보이는 이름 — ① 입력칸 이름과 맞춘다 */
const LABEL: Record<string, string> = {
  shopName: '상호',
  area: '지역',
  address: '주소',
  phone: '전화번호',
  hours: '영업시간',
  offDays: '휴무일',
  bookingUrl: '예약 링크',
  productName: '상품 종류',
  listPrice: '정상가',
  eventPrice: '판매가',
  otherPrices: '그 밖의 가격',
  people: '기준 인원',
  includes: '상품 구성',
  extras: '추가 비용',
  perks: '혜택',
  eventPeriod: '이벤트 기간',
  concepts: '콘셉트',
};

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 지금 작업에 적혀 있는 값 */
export function currentValue(p: ProjectData, key: string): string {
  const s = p.studio;
  switch (key) {
    case 'shopName': return s?.name || p.product.brand || '';
    case 'area': return s?.area || p.shoot?.area || '';
    case 'address': return s?.address ?? '';
    case 'phone': return s?.phone ?? '';
    case 'hours': return s?.hours ?? '';
    case 'offDays': return s?.offDays ?? '';
    case 'bookingUrl': return s?.bookingUrl ?? '';
    case 'productName': return p.shoot?.productName ?? '';
    case 'listPrice': return p.product.listPrice;
    case 'eventPrice': return p.product.salePrice;
    case 'people': return p.pricing?.people ?? '';
    case 'includes': return p.pricing?.includes ?? '';
    case 'extras':
    case 'otherPrices': return p.pricing?.etcExtra ?? '';
    case 'perks': return (p.perks ?? []).map((x) => (x.body ? `${x.title} | ${x.body}` : x.title)).join('\n');
    case 'eventPeriod': return p.event?.period ?? '';
    case 'concepts': return (p.concepts ?? []).map((c) => c.name).join('\n');
    default: return '';
  }
}

/** 새 자료를 살펴 '바로 채울 것' 과 '물어볼 것' 으로 나눈다 */
export function reviewFields(fields: ReadField[], p: ProjectData): { fill: FieldChange[]; conflicts: FieldChange[] } {
  const fill: FieldChange[] = [];
  const conflicts: FieldChange[] = [];

  fields.forEach((f) => {
    const incoming = f.value.trim();
    if (!incoming || !(f.key in LABEL)) return;
    const current = currentValue(p, f.key).trim();
    const text = TEXT_KEYS.has(f.key);
    const change: FieldChange = { key: f.key, label: LABEL[f.key], current, incoming, text };

    if (!current) { fill.push(change); return; }
    if (norm(current) === norm(incoming)) return;
    /* 여러 줄 글에서 새 줄이 전부 이미 들어 있으면 물어볼 것도 없다 */
    if (text) {
      const have = new Set(lines(current).map(norm));
      if (lines(incoming).every((l) => have.has(norm(l)))) return;
    }
    if (f.key === 'listPrice' || f.key === 'eventPrice') {
      if (current.replace(/[^\d]/g, '') === incoming.replace(/[^\d]/g, '')) return;
    }
    conflicts.push(change);
  });

  return { fill, conflicts };
}

/**
 * 한 항목 넣기.
 *   fill    — 비어 있던 칸 채우기
 *   replace — 기존 내용 바꾸기
 *   append  — 기존 내용 뒤에 이어 붙이기 (같은 줄은 한 번만)
 */
export function applyChange(d: ProjectData, ch: FieldChange, how: 'fill' | 'replace' | 'append'): void {
  const value = how === 'append'
    ? [...new Set([...lines(currentValue(d, ch.key)), ...lines(ch.incoming)])].join('\n')
    : ch.incoming;

  const studio = () => {
    d.studio = { ...EMPTY_STUDIO, ...(d.studio ?? {}) };
    return d.studio;
  };
  const pricing = () => {
    d.pricing = { ...EMPTY_PRICING, ...(d.pricing ?? {}) };
    return d.pricing;
  };

  switch (ch.key) {
    case 'shopName':
      studio().name = value;
      d.product.brand = value;
      break;
    case 'area':
      studio().area = value;
      d.shoot = { ...(d.shoot ?? EMPTY_BRIEF), area: value };
      break;
    case 'address': studio().address = value; break;
    case 'phone': studio().phone = value; break;
    case 'hours': studio().hours = value; break;
    case 'offDays': studio().offDays = value; break;
    case 'bookingUrl': studio().bookingUrl = value; break;
    case 'productName':
      d.shoot = { ...(d.shoot ?? EMPTY_BRIEF), productName: value };
      break;
    case 'listPrice':
      pricing();
      setPrice(d, 'list', value);
      break;
    case 'eventPrice':
      pricing();
      setPrice(d, 'sale', value);
      break;
    case 'people': pricing().people = value; break;
    case 'includes': pricing().includes = value; break;
    case 'extras':
    case 'otherPrices': {
      /* 추가 비용과 그 밖의 가격은 한 칸에 모은다 — 지우지 않고 잇는다 */
      const pr = pricing();
      pr.etcExtra = how === 'replace'
        ? value
        : [...new Set([...lines(pr.etcExtra), ...lines(ch.incoming)])].join('\n');
      break;
    }
    case 'perks':
      d.perks = lines(value).map((line) => {
        const [title, ...rest] = line.split('|');
        return { id: uid('perk'), title: title.trim(), body: rest.join('|').trim(), photoId: '', icon: '' };
      });
      break;
    case 'eventPeriod':
      d.event = { ...EMPTY_EVENT, ...(d.event ?? {}), period: value };
      if (!d.event.title) d.event.title = '이벤트';
      break;
    case 'concepts':
      d.concepts = lines(value).map((name) => ({
        id: uid('cc'), name, summary: '', body: '', mainPhotoId: '', photoIds: [],
      }));
      break;
    default:
      break;
  }

  /* 정상가·판매가가 둘 다 있으면 이벤트 가격에도 맞춰둔다 (미리보기 이벤트 영역이 본다) */
  if (ch.key === 'listPrice' || ch.key === 'eventPrice') {
    const lp = d.product.listPrice;
    const sp = d.product.salePrice;
    if (lp && sp && Number(lp) > Number(sp)) {
      d.event = { ...EMPTY_EVENT, ...(d.event ?? {}), listPrice: lp, eventPrice: sp };
      if (!d.event.title) d.event.title = '이벤트';
    }
  }

  /* 예약·문의 안내가 비어 있으면 전화·예약 링크로 채운다 */
  if ((ch.key === 'phone' || ch.key === 'bookingUrl') && !d.product.contact.trim()) {
    const s = d.studio;
    d.product.contact = [s?.phone && `전화 ${s.phone}`, s?.bookingUrl].filter(Boolean).join(' · ');
  }
}
