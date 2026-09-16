import { CHECK_RULES, IMAGE_POLICY, SMARTSTORE_DETAIL_WIDTH } from '@/config/smartstore';
import type { ProjectData } from '@/types/project';
import { isLowResolution, shapeOf } from '@/utils/image';

/**
 * 스마트스토어 체크 — 초보자가 이해하기 쉬운 말로 알려준다.
 * 개발 용어를 쓰지 않는다.
 */

export interface CheckItem {
  level: 'warn' | 'info';
  where: string;    // 어디 문제인지
  text: string;     // 무엇을 고치면 되는지
}

export function checkProject(p: ProjectData): CheckItem[] {
  const out: CheckItem[] = [];
  const d = p.design;
  const prod = p.product;

  /* 상세페이지 폭 */
  if (SMARTSTORE_DETAIL_WIDTH !== 860) {
    out.push({ level: 'info', where: '상세페이지 폭', text: `지금 폭은 ${SMARTSTORE_DETAIL_WIDTH}px 입니다.` });
  }

  /* 상품명 */
  if (!prod.name.trim()) {
    out.push({ level: 'warn', where: '상품정보', text: '상품명이 비어 있습니다.' });
  } else if (prod.name.length > 100) {
    out.push({ level: 'warn', where: '상품정보', text: '상품명이 너무 깁니다. 100자 안으로 줄여주세요.' });
  }

  /* 가격 */
  const list = Number(prod.listPrice.replace(/[^\d]/g, ''));
  const sale = Number(prod.salePrice.replace(/[^\d]/g, ''));
  if (!sale && !list) {
    out.push({ level: 'warn', where: '상품정보', text: '가격이 비어 있습니다.' });
  } else if (list && sale && sale > list) {
    out.push({ level: 'warn', where: '상품정보', text: '판매가격이 정상가격보다 높습니다. 다시 확인해주세요.' });
  }

  /* 사진 */
  if (p.photos.length === 0) {
    out.push({ level: 'warn', where: '사진', text: '사진이 한 장도 없습니다. 사진을 올려주세요.' });
  }
  if (p.photos.length > 0 && !p.photos.some((x) => x.kind === 'main')) {
    out.push({ level: 'warn', where: '사진', text: '대표사진이 정해지지 않았습니다.' });
  }
  p.photos.forEach((photo, i) => {
    if (isLowResolution(photo)) {
      out.push({ level: 'warn', where: `사진 ${i + 1}`, text: '사진이 작아서 흐리게 보일 수 있습니다.' });
    }
    if (photo.bytes > IMAGE_POLICY.maxFileSize) {
      out.push({ level: 'info', where: `사진 ${i + 1}`, text: '사진 용량이 큽니다. 업로드가 느려질 수 있어요.' });
    }
    /* 가로로 아주 긴 사진을 꽉 채우면 많이 잘린다 */
    if (photo.fit === 'fill' && shapeOf(photo) === 'landscape' && photo.width / photo.height > 2.2) {
      out.push({ level: 'info', where: `사진 ${i + 1}`, text: '가로로 긴 사진이라 위아래가 많이 잘릴 수 있습니다. 사진 전체 보기로 바꿔보세요.' });
    }
  });

  /* 메뉴 */
  const visible = p.menus.filter((m) => !m.hidden);
  if (visible.length === 0) {
    out.push({ level: 'warn', where: '메뉴', text: '보이는 메뉴가 없습니다.' });
  }
  visible.forEach((m) => {
    const auto = ['main', 'price', 'cta', 'benefit', 'intro', 'gallery', 'shipping', 'howto', 'caution', 'recommend'];
    /* 촬영 과정·준비사항·FAQ 처럼 줄 목록으로 채우는 메뉴도 '내용 있음'으로 본다.
       이벤트·가격·혜택은 글이 아니라 따로 저장된 값으로 채워지므로 그 값도 함께 본다. */
    const fromData =
      (m.kind === 'event' && !!(p.event?.title || p.event?.eventPrice || p.event?.period))
      || (m.kind === 'perks' && !!p.perks?.length)
      || (m.kind === 'price' && !!(p.pricing?.eventPrice || p.pricing?.listPrice || p.pricing?.includes))
      || (m.kind === 'shootConcept' && !!p.concepts?.length);
    const hasOwn = m.body.trim() || m.photoIds.length > 0 || m.lines.some((l) => l.trim()) || fromData;
    if (!hasOwn && !auto.includes(m.kind)) {
      out.push({ level: 'warn', where: `메뉴 · ${m.title}`, text: '내용이 비어 있습니다.' });
    }
  });

  /* 마지막 구매·문의 */
  if (!visible.some((m) => m.kind === 'cta')) {
    out.push({ level: 'info', where: '메뉴', text: '마지막에 구매·문의 안내가 없습니다. 추가하면 좋습니다.' });
  }

  /* 링크 */
  if (prod.buyLink.trim() && !/^https?:\/\//i.test(prod.buyLink.trim())) {
    out.push({ level: 'warn', where: '구매 링크', text: '주소가 http:// 또는 https:// 로 시작하지 않습니다.' });
  }

  /* 상품명과 내용 어울림 */
  if (prod.name.trim() && prod.description.trim()) {
    const key = prod.name.split(/\s+/).filter((w) => w.length >= 2)[0];
    if (key && !prod.description.includes(key) && !prod.tagline.includes(key)) {
      out.push({ level: 'info', where: '상품정보', text: `상세 설명에 "${key}" 가 나오지 않습니다. 상품명과 내용이 어울리는지 확인해보세요.` });
    }
  }

  /* 같은 낱말 반복 */
  const all = [prod.name, prod.tagline, prod.description, ...visible.map((m) => m.title + ' ' + m.body)].join(' ');
  const counts = new Map<string, number>();
  all.split(/[\s,.\n]+/).forEach((w) => {
    if (w.length < 2) return;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  });
  counts.forEach((n, w) => {
    if (n > CHECK_RULES.keywordRepeat) {
      out.push({ level: 'info', where: '글', text: `"${w}" 가 ${n}번 나옵니다. 너무 자주 반복하지 않는 편이 좋습니다.` });
    }
  });

  /* 모바일 가독성 */
  if (d.bodySize < CHECK_RULES.minMobileFontSize) {
    out.push({ level: 'warn', where: '디자인', text: '본문 글씨가 작아 모바일에서 읽기 어려울 수 있습니다.' });
  }

  /* 너무 큰 여백 */
  if (d.menuGap > CHECK_RULES.hugeGap) {
    out.push({ level: 'info', where: '디자인', text: '메뉴 사이 간격이 매우 넓습니다. 상세페이지가 불필요하게 길어질 수 있어요.' });
  }

  return out;
}

/** 결과 요약 문구 */
export function summarize(items: CheckItem[]): string {
  const warn = items.filter((i) => i.level === 'warn').length;
  if (items.length === 0) return '✓ 문제없음';
  if (warn === 0) return `✓ 큰 문제 없음 · 참고 ${items.length}개`;
  return `⚠ 수정 권장 ${warn}개`;
}
