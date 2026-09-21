import type { Photo, ProjectData } from '@/types/project';
import { formatWon } from '@/utils/format';

/**
 * 네이버 스마트스토어에 올릴 내용 한 벌.
 *
 * ⚠ 이것이 **유일한 기준**이다.
 *   `스마트스토어 자동입력` 과 `등록자료 받기` 는 **같은 이 값**만 쓴다.
 *   같은 내용을 두 군데서 따로 만들지 않는다 — 그래야 둘이 어긋날 일이 없다.
 *
 * ⚠ 없는 값을 지어내지 않는다.
 *   PAGE MAKER 에 적혀 있지 않은 것은 **빈 채로 둔다.**
 *   (카테고리·배송·반품처럼 틀리면 안 되는 것은 아예 손대지 않는다)
 */

export interface SmartStorePayload {
  /** 상품명 */
  productName: string;
  /** 판매가 (숫자만) */
  salePrice: string;
  /** 정상가 (숫자만, 없으면 빈 값) */
  normalPrice: string;
  /** 상품 설명 */
  description: string;
  /** 촬영 구성 (줄바꿈으로 여러 줄) */
  composition: string;
  /** 이벤트·혜택 */
  benefits: string;
  /** 예약·이용 안내 */
  reservationInfo: string;
  /** 사진관명 */
  studioName: string;
  /** 지역 */
  region: string;
  /** 대표사진 */
  representativeImage: Photo | null;
  /** 추가사진 */
  additionalImages: Photo[];
  /**
   * 상세페이지 분할 이미지.
   * 이 값은 **만들 때 그 자리에서** 채운다 (미리보기를 그려야 나오는 그림이라).
   */
  detailImages: Blob[];
  /** 파일 이름을 지을 때 쓰는 앞머리 (예: 광명가족사진) */
  baseName: string;
}

/* ------------------------------------------------------------------ */

/** 여러 줄 글에서 빈 줄을 걷어낸다 */
function lines(v: string): string[] {
  return (v ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
}

/** 이 상세페이지에서 '이벤트·혜택' 으로 읽을 내용을 모은다 */
function benefitsOf(p: ProjectData): string {
  const out: string[] = [];

  const ev = p.event;
  if (ev?.title) out.push(ev.title);
  if (ev?.period) out.push(ev.period);
  if (ev?.body) out.push(ev.body);

  /* 상세페이지에 '이벤트·혜택' 메뉴를 따로 적어두셨으면 그 글도 함께 */
  p.menus
    .filter((m) => !m.hidden && (m.kind === 'event' || m.kind === 'perks' || m.kind === 'discount'))
    .forEach((m) => {
      if (m.body) out.push(m.body);
      m.lines.forEach((l) => {
        const t = l.trim();
        if (t) out.push(t.replace(/\s*\|\s*/, ' — '));
      });
    });

  return [...new Set(out.filter(Boolean))].join('\n');
}

/** 촬영 구성 — 상품정보의 구성 + 가격표의 포함사항 */
function compositionOf(p: ProjectData): string {
  const out = [...lines(p.product.benefits), ...lines(p.pricing?.includes ?? '')];
  const benefitMenu = p.menus.find((m) => !m.hidden && m.kind === 'benefit');
  if (benefitMenu) benefitMenu.lines.forEach((l) => { if (l.trim()) out.push(l.trim()); });
  return [...new Set(out)].join('\n');
}

/** 예약·이용 안내 */
function reservationOf(p: ProjectData): string {
  const s = p.studio;
  const out: string[] = [];
  const cta = p.menus.find((m) => !m.hidden && m.kind === 'cta');
  if (cta?.body) out.push(cta.body);
  if (p.product.shipping) out.push(p.product.shipping);
  if (p.product.contact) out.push(p.product.contact);
  if (s?.phone) out.push('전화 ' + s.phone);
  if (s?.bookingUrl) out.push('예약 ' + s.bookingUrl);
  else if (p.product.buyLink) out.push('예약 ' + p.product.buyLink);
  if (s?.hours) out.push('영업시간 ' + s.hours);
  if (s?.offDays) out.push('휴무 ' + s.offDays);
  if (p.product.caution) out.push(p.product.caution);
  return [...new Set(out.filter(Boolean))].join('\n');
}

/** 상품 설명 */
function descriptionOf(p: ProjectData): string {
  const out: string[] = [];
  if (p.product.tagline) out.push(p.product.tagline);
  /*
   * 숨긴 영역의 글은 상세페이지에 나오지 않으므로 등록 글에도 넣지 않는다.
   * (예전에는 소개 영역을 숨겨도 상품 설명이 그대로 따라 들어갔다)
   */
  const intro = p.menus.find((m) => m.kind === 'intro');
  const body = intro ? (intro.hidden ? '' : (intro.body || p.product.description)) : p.product.description;
  if (body) out.push(body);
  if (p.product.target) out.push('이런 분께 추천 — ' + p.product.target);
  return [...new Set(out.filter(Boolean))].join('\n\n');
}

/** 파일 이름 앞머리 — {지역}{촬영상품} (예: 광명가족사진) */
export function baseNameOf(p: ProjectData): string {
  const region = (p.studio?.area ?? '').trim();
  const kind = (p.product.category || p.product.name || '촬영').trim();
  const joined = (region + kind).replace(/\s+/g, '');
  return joined || '촬영상품';
}

/* ------------------------------------------------------------------ */

/**
 * 지금 작업에서 스마트스토어에 올릴 내용을 뽑는다.
 *
 * 상세페이지 분할 이미지는 화면을 그려야 나오므로 여기서는 비워 두고,
 * 실제로 만들 때(`pack.ts`) 채운다.
 */
export function buildPayload(p: ProjectData): SmartStorePayload {
  const photos = p.photos.filter((x) => x.kind !== 'unused');
  const main = photos.find((x) => x.kind === 'main') ?? photos[0] ?? null;

  return {
    productName: (p.product.storeTitle || p.product.name).trim(),
    salePrice: (p.product.salePrice || p.pricing?.eventPrice || '').replace(/[^\d]/g, ''),
    normalPrice: (p.product.listPrice || p.pricing?.listPrice || '').replace(/[^\d]/g, ''),
    description: descriptionOf(p),
    composition: compositionOf(p),
    benefits: benefitsOf(p),
    reservationInfo: reservationOf(p),
    studioName: (p.studio?.name || p.product.brand || '').trim(),
    region: (p.studio?.area ?? '').trim(),
    representativeImage: main,
    additionalImages: photos.filter((x) => x.id !== main?.id),
    detailImages: [],
    baseName: baseNameOf(p),
  };
}

/* ------------------------------------------------------------------ */
/* 등록 전 확인                                                         */
/* ------------------------------------------------------------------ */

export interface ReadyItem {
  label: string;
  /** 'ok' 채워짐 · 'todo' 비어 있음 · 'check' 우리가 알 수 없어 사장님이 봐야 하는 것 */
  state: 'ok' | 'todo' | 'check';
  note: string;
}

/**
 * 올릴 준비가 됐는지.
 * **모르는 것을 아는 척하지 않는다.** 카테고리처럼 우리가 알 수 없는 것은 `확인 필요` 로 둔다.
 */
export function checkReady(v: SmartStorePayload, detailCount: number): ReadyItem[] {
  const n = (x: string) => x.trim().length > 0;
  return [
    !n(v.region)
      ? { label: '상품명', state: 'todo', note: '지역을 넣어주세요 — 스마트스토어 제목 맨 앞에 들어갑니다' }
      : !v.productName.startsWith(v.region)
        ? { label: '상품명', state: 'check', note: `제목 맨 앞에 지역(${v.region})을 넣어주세요 — ${v.productName || '비어 있음'}` }
        : { label: '상품명', state: 'ok', note: v.productName },
    { label: '판매가', state: n(v.salePrice) ? 'ok' : 'todo', note: v.salePrice ? formatWon(v.salePrice) : '상품정보에서 넣어주세요' },
    { label: '상품 설명', state: n(v.description) ? 'ok' : 'todo', note: n(v.description) ? '준비됨' : '한 줄 소개나 상세 설명을 넣어주세요' },
    { label: '대표사진', state: v.representativeImage ? 'ok' : 'todo', note: v.representativeImage ? '1장' : '사진을 올려주세요' },
    { label: '추가사진', state: v.additionalImages.length > 0 ? 'ok' : 'todo', note: v.additionalImages.length + '장' },
    { label: '상세페이지', state: detailCount > 0 ? 'ok' : 'todo', note: detailCount > 0 ? '분할 이미지 ' + detailCount + '장' : '만들 때 함께 생성됩니다' },
    { label: '이벤트·혜택', state: n(v.benefits) ? 'ok' : 'todo', note: n(v.benefits) ? '준비됨' : '없으면 비워두셔도 됩니다' },
    /* 우리가 정할 수 없는 것 — 넘겨짚지 않는다 */
    { label: '카테고리', state: 'check', note: '스마트스토어에서 직접 골라주세요' },
    { label: '배송·반품 정보', state: 'check', note: '스마트스토어에 저장된 설정을 그대로 씁니다' },
  ];
}
