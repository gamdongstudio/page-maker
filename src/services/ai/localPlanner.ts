import type { MenuKind, ProjectData } from '@/types/project';
import { stripBanned, type AiPlan, type AiProvider } from './types';

/**
 * AI 연결 전에 쓰는 기본 추천기.
 *
 * ★ 이것은 AI 가 아니다. ★
 * 입력한 상품정보를 규칙대로 정리해 구성안을 만들어 줄 뿐이다.
 * 화면에도 "AI 연결 전 기본 추천" 이라고 그대로 밝힌다.
 */

function lines(s: string): string[] {
  return s.split('\n').map((x) => x.trim()).filter(Boolean);
}

function won(v: string): number {
  return Number(String(v).replace(/[^\d]/g, '')) || 0;
}

export const localPlanner: AiProvider = {
  id: 'local',
  label: 'AI 연결 전 기본 추천',
  isReady: () => true,

  async plan(p: ProjectData): Promise<AiPlan> {
    const prod = p.product;
    const name = prod.name.trim() || '상품';
    const brand = prod.brand.trim();
    const cat = prod.category.split('>').pop()?.trim() || '';
    const benefitLines = lines(prod.benefits);
    const list = won(prod.listPrice);
    const sale = won(prod.salePrice);
    const percent = list && sale && list > sale ? Math.round((1 - sale / list) * 100) : 0;

    /* 상품 분석 */
    const analysis = stripBanned(
      [
        `${brand ? brand + '의 ' : ''}${name}${cat ? ` (${cat})` : ''} 입니다.`,
        prod.tagline ? `한 줄 소개: ${prod.tagline}` : '',
        percent ? `정상가 대비 ${percent}% 할인된 가격으로 판매합니다.` : '',
        `사진 ${p.photos.length}장, 메뉴 ${p.menus.filter((m) => !m.hidden).length}개로 구성되어 있습니다.`,
      ].filter(Boolean).join(' '),
    );

    /* 주요 고객 */
    const audience = stripBanned(
      prod.target.trim() ||
      `${cat || name} 을(를) 찾는 분, 그리고 ${prod.tagline || '합리적인 가격'} 을 중요하게 보는 분`,
    );

    /* 핵심 장점 */
    const benefits = (benefitLines.length ? benefitLines : [
      prod.tagline || `${name} 의 장점을 적어주세요`,
      percent ? `정상가보다 ${percent}% 저렴한 가격` : '합리적인 가격',
      prod.shipping ? prod.shipping.split('\n')[0] : '빠른 배송',
    ]).slice(0, 5).map(stripBanned);

    /* 검색용 상품 제목 — 대문 카피와 분명히 나눈다 */
    const keyword = [brand, cat, name].filter(Boolean);
    const searchTitles = [
      [brand, name].filter(Boolean).join(' '),
      [name, cat].filter(Boolean).join(' '),
      [brand, name, benefitLines[0]?.slice(0, 12)].filter(Boolean).join(' '),
    ]
      .map((t) => stripBanned(t).slice(0, 90))
      .filter((t, i, arr) => t && arr.indexOf(t) === i);

    /* 대문 카피 — 검색용 제목과 역할이 다르다 */
    const heroCopy = [
      prod.tagline || `${name}, 이렇게 다릅니다`,
      benefitLines[0] ? `${benefitLines[0]}` : `${name} 를 고르는 이유`,
      percent ? `지금 ${percent}% 할인 중` : `${brand || name} 가 제안하는 하루`,
    ].map(stripBanned).filter(Boolean);

    /* 추천 메뉴와 순서 */
    const menus: { kind: MenuKind; title: string; body: string }[] = [
      { kind: 'main', title: '메인', body: '' },
      ...(percent ? [{ kind: 'discount' as MenuKind, title: '할인 혜택', body: `정상가 대비 ${percent}% 할인된 가격으로 준비했습니다.` }] : []),
      { kind: 'intro', title: '상품소개', body: prod.description || `${name} 를 소개합니다.` },
      { kind: 'recommend', title: '이런 분께 추천', body: audience },
      { kind: 'benefit', title: '핵심 장점', body: benefits.join('\n') },
      ...(p.photos.some((x) => x.kind === 'detail') ? [{ kind: 'feature' as MenuKind, title: '상세 특징', body: '' }] : []),
      ...(p.photos.length >= 3 ? [{ kind: 'gallery' as MenuKind, title: '갤러리', body: '' }] : []),
      { kind: 'price', title: '가격·구성', body: '' },
      ...(prod.shipping ? [{ kind: 'shipping' as MenuKind, title: '배송안내', body: prod.shipping }] : []),
      ...(prod.howToUse ? [{ kind: 'howto' as MenuKind, title: '이용방법', body: prod.howToUse }] : []),
      ...(prod.caution ? [{ kind: 'caution' as MenuKind, title: '주의사항', body: prod.caution }] : []),
      { kind: 'cta', title: '마지막 구매·문의', body: `${name} 가 궁금하시면 지금 확인해보세요.` },
    ];

    const cta = stripBanned(prod.contact ? `${prod.contact} 로 편하게 문의해주세요.` : '지금 구매하러 가기');

    /* 계산이 빨라도 즉시 끝나면 눌린 느낌이 없어 아주 짧게 기다린다 */
    await new Promise((r) => setTimeout(r, 150));

    return {
      source: 'local',
      sourceLabel: '입력한 상품정보를 규칙대로 정리한 결과입니다. (AI 연결 전)',
      analysis,
      audience,
      benefits,
      searchTitles: searchTitles.length ? searchTitles : [name],
      heroCopy,
      menus,
      cta,
      ...(keyword.length ? {} : {}),
    };
  },
};
