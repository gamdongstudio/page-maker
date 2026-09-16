import type { ProjectData } from '@/types/project';
import { formatWon } from '@/utils/format';

/**
 * 네이버 스마트플레이스에 넣을 내용 한 벌.
 *
 * ⚠ 이것이 **유일한 기준**이다.
 *   화면 표시 · 항목별 복사 · 전체 복사 · 메모장 파일이 전부 이 값만 쓴다.
 *
 * ⚠ 없는 값을 지어내지 않는다.
 *   특히 주소·전화·영업시간·가격은 적혀 있지 않으면 **`확인 필요`** 로 둔다.
 *
 * ⚠ 네이버에 접속하지 않는다. 여기서 하는 일은 **글을 정리해 주는 것뿐**이다.
 */

/** 스마트플레이스에 넣는 순서대로 */
export type PlaceKey =
  | 'businessName' | 'category' | 'shortIntroduction' | 'introduction'
  | 'phone' | 'address' | 'businessHours' | 'holidays'
  | 'reservationInfo' | 'services' | 'priceInfo' | 'benefits'
  | 'notice' | 'keywords' | 'photoDescriptions';

export interface PlaceItem {
  key: PlaceKey;
  /** 01, 02 … */
  no: string;
  /** 화면과 파일에 똑같이 쓰는 항목 이름 */
  label: string;
  /** 실제로 넣을 값 (복사 단추는 **이것만** 복사한다) */
  value: string;
  /** 여러 줄로 적는 칸인지 */
  long: boolean;
  /** 비어 있으면 안 되는 중요한 칸인지 — 비면 `확인 필요` 로 보여준다 */
  important: boolean;
}

export type SmartPlacePayload = PlaceItem[];

/* ------------------------------------------------------------------ */

const lines = (v: string) =>
  (v ?? '').split('\n').map((s) => s.trim()).filter(Boolean);

const join = (arr: string[]) => [...new Set(arr.filter(Boolean))].join('\n');

/** 업체 소개 — 적어두신 글에서만 모은다 */
function introOf(p: ProjectData): string {
  const out: string[] = [];
  if (p.studio?.intro) out.push(p.studio.intro);
  const brand = p.menus.find((m) => !m.hidden && m.kind === 'brand');
  if (brand?.body) out.push(brand.body);
  const intro = p.menus.find((m) => !m.hidden && m.kind === 'intro');
  if (intro?.body) out.push(intro.body);
  if (p.product.description) out.push(p.product.description);
  return join(out);
}

/** 촬영·서비스 안내 */
function servicesOf(p: ProjectData): string {
  const out = [...lines(p.product.benefits), ...lines(p.pricing?.includes ?? '')];
  const benefit = p.menus.find((m) => !m.hidden && m.kind === 'benefit');
  if (benefit) benefit.lines.forEach((l) => { if (l.trim()) out.push(l.trim()); });
  if (p.product.shipping) out.push(p.product.shipping);
  return join(out);
}

/** 가격 안내 */
function priceOf(p: ProjectData): string {
  const out: string[] = [];
  const sale = p.product.salePrice || p.pricing?.eventPrice || '';
  const list = p.product.listPrice || p.pricing?.listPrice || '';
  const name = p.product.category || p.product.name;

  if (sale) out.push(`${name || '촬영'} ${formatWon(sale)}`);
  if (list && list !== sale) out.push(`정상가 ${formatWon(list)}`);
  if (p.pricing?.people) out.push(`기준 인원 ${p.pricing.people}`);
  lines(p.pricing?.etcExtra ?? '').forEach((l) => out.push(l));
  (p.packages ?? []).forEach((k) => {
    if (k.name && k.price) out.push(`${k.name} ${formatWon(k.price) || k.price}`);
  });
  return join(out);
}

/** 이벤트·혜택 */
function benefitsOf(p: ProjectData): string {
  const out: string[] = [];
  const ev = p.event;
  if (ev?.title) out.push(ev.title);
  if (ev?.period) out.push(ev.period);
  if (ev?.body) out.push(ev.body);
  p.menus
    .filter((m) => !m.hidden && (m.kind === 'event' || m.kind === 'perks' || m.kind === 'discount'))
    .forEach((m) => {
      if (m.body) out.push(m.body);
      m.lines.forEach((l) => { if (l.trim()) out.push(l.trim().replace(/\s*\|\s*/, ' — ')); });
    });
  return join(out);
}

/** 예약 안내 */
function reservationOf(p: ProjectData): string {
  const out: string[] = [];
  const cta = p.menus.find((m) => !m.hidden && m.kind === 'cta');
  if (cta?.body) out.push(cta.body);
  if (p.studio?.bookingUrl) out.push(p.studio.bookingUrl);
  else if (p.product.buyLink) out.push(p.product.buyLink);
  if (p.product.contact) out.push(p.product.contact);
  return join(out);
}

/**
 * 대표 키워드.
 *
 * ⚠ 같은 말을 여러 번 늘어놓지 않는다. 적어두신 말에서만 뽑는다.
 */
function keywordsOf(p: ProjectData): string {
  const area = (p.studio?.area ?? '').trim();
  const kind = (p.product.category || '').trim();
  const out: string[] = [];
  if (area && kind) out.push(area + kind);
  if (kind) out.push(kind);
  if (p.studio?.name) out.push(p.studio.name);
  if (area) out.push(area + '사진관');
  return [...new Set(out.filter(Boolean))].join(', ');
}

/** 사진 설명 — 사장님이 사진마다 적어두신 설명만 */
function photoNotesOf(p: ProjectData): string {
  return join(p.photos.map((x) => (x.caption ?? '').trim()).filter(Boolean));
}

/* ------------------------------------------------------------------ */

/** 화면·복사·파일이 모두 쓰는 한 벌을 만든다 */
export function buildPlacePayload(p: ProjectData): SmartPlacePayload {
  const s = p.studio;

  const raw: Omit<PlaceItem, 'no'>[] = [
    { key: 'businessName', label: '업체명', value: (s?.name || p.product.brand || '').trim(), long: false, important: true },
    { key: 'category', label: '업종 / 카테고리', value: (p.product.category || '').trim(), long: false, important: true },
    { key: 'shortIntroduction', label: '한 줄 소개', value: (p.product.tagline || '').trim(), long: false, important: false },
    { key: 'introduction', label: '업체 소개', value: introOf(p), long: true, important: false },
    { key: 'phone', label: '전화번호', value: (s?.phone || '').trim(), long: false, important: true },
    { key: 'address', label: '주소', value: (s?.address || '').trim(), long: false, important: true },
    { key: 'businessHours', label: '영업시간', value: (s?.hours || '').trim(), long: false, important: true },
    { key: 'holidays', label: '휴무일', value: (s?.offDays || '').trim(), long: false, important: true },
    { key: 'reservationInfo', label: '예약 안내', value: reservationOf(p), long: true, important: false },
    { key: 'services', label: '촬영 / 서비스 안내', value: servicesOf(p), long: true, important: false },
    { key: 'priceInfo', label: '가격 안내', value: priceOf(p), long: true, important: true },
    { key: 'benefits', label: '이벤트·혜택', value: benefitsOf(p), long: true, important: false },
    { key: 'notice', label: '이용 안내 / 유의사항', value: join([p.product.caution, p.product.howToUse, p.product.etc]), long: true, important: false },
    { key: 'keywords', label: '대표 키워드', value: keywordsOf(p), long: false, important: false },
    { key: 'photoDescriptions', label: '사진 설명', value: photoNotesOf(p), long: true, important: false },
  ];

  return raw.map((it, i) => ({ ...it, no: String(i + 1).padStart(2, '0') }));
}

/**
 * 사장님이 스마트플레이스용으로만 고쳐 둔 글을 덮어씌운다.
 *
 * ⚠ 원본 상세페이지는 **건드리지 않는다.** 여기서 고친 것은 여기서만 쓴다.
 */
export function applyEdits(
  items: SmartPlacePayload,
  edits: Partial<Record<PlaceKey, string>> | undefined,
): SmartPlacePayload {
  if (!edits) return items;
  return items.map((it) =>
    (typeof edits[it.key] === 'string' ? { ...it, value: edits[it.key] as string } : it));
}

/** 화면에 보여줄 값 — 비었으면 무엇이라고 할지 */
export function shownValue(it: PlaceItem): { text: string; missing: boolean } {
  const v = (it.value ?? '').trim();
  if (v) return { text: v, missing: false };
  return { text: it.important ? '확인 필요' : '입력할 내용 없음', missing: true };
}
