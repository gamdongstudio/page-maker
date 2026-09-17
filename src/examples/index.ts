import type { MenuItem, MenuKind, ProjectData, StylePreset } from '@/types/project';
import { EMPTY_BRIEF } from '@/types/project';
import { EMPTY_EVENT, EMPTY_PRICING, EMPTY_STUDIO } from '@/types/studio';
import { createProject, DESIGN_PRESETS, makeMenu, uid } from '@/types/defaults';
import { applyStyle } from '@/services/design/style';
import { artPhoto, boardArt, familyArt, portraitArt } from './art';

/**
 * 완성 예시 — 처음 온 사람이 **결과부터** 볼 수 있게.
 *
 * 가게 이름·전화번호·주소는 모두 **지어낸 예시**이고 화면에도 그렇게 적는다.
 * 사진 대신 그림을 쓴다. (실제 사람처럼 보이는 가짜 사진은 쓰지 않는다)
 */

export interface Example {
  key: string;
  label: string;
  /** '이 구성으로 시작하기' 를 누르면 상품 종류로 넣는 말 */
  productKind: string;
  project: ProjectData;
}

function menu(kind: MenuKind, title: string, part: Partial<MenuItem> = {}): MenuItem {
  return { ...makeMenu(kind, title), ...part };
}

function withStyle(p: ProjectData, style: StylePreset): ProjectData {
  p.design = { ...DESIGN_PRESETS[style] };
  applyStyle(p, style, { chosen: true, templates: false });
  return p;
}

/* ------------------------------------------------------------------ */

function family(): Example {
  const hero = artPhoto(familyArt(['#f1e7dc', '#dccbb9'], ['#8a6d4b', '#6f5a47', '#b89878', '#c9a98a']), 1200, 800, 'main', '가족 대표');
  const c1 = artPhoto(portraitArt(['#f4ece3', '#d9c7b4'], '#9b7b5b'), 900, 1200, 'concept', '캐주얼');
  const c2 = artPhoto(portraitArt(['#efe3e3', '#cdb4b4'], '#8e4f4f', '#ead3c0'), 900, 1200, 'concept', '한복');
  const g = [
    artPhoto(familyArt(['#eef0ea', '#d3d8cb'], ['#5f6f57', '#7c8a70', '#a4b196', '#bcc7ae']), 1200, 800, 'product', '갤러리 1'),
    artPhoto(familyArt(['#f3eee6', '#ddd2c2'], ['#7a6552', '#5c4c3e', '#a58c74', '#c2a98f']), 1200, 800, 'product', '갤러리 2'),
    artPhoto(familyArt(['#ebeff3', '#cdd6df'], ['#4f6275', '#6b7f92', '#91a4b5', '#aebfcd']), 1200, 800, 'product', '갤러리 3'),
    artPhoto(familyArt(['#f5ece6', '#e2cfc3'], ['#8f5e4b', '#6f4a3b', '#b98a74', '#d0a891']), 1200, 800, 'product', '갤러리 4'),
  ];

  const p = createProject();
  p.id = 'example_family';
  p.title = '가족사진 상세페이지 (예시)';
  p.shoot = { ...EMPTY_BRIEF, productName: '가족사진', area: '광명' };
  p.studio = {
    ...EMPTY_STUDIO, name: '봄날사진관', area: '광명', phone: '02-000-0000',
    hours: '10:00 ~ 19:00', offDays: '매주 월요일', address: '경기도 광명시 (예시 주소)',
  };
  p.product = {
    ...p.product,
    name: '광명 가족사진 촬영',
    brand: '봄날사진관',
    category: '가족사진',
    tagline: '우리 가족의 오늘을 오래도록 간직하세요',
    listPrice: '250000',
    salePrice: '189000',
    description: '온 가족이 편안하게 웃을 수 있도록 천천히 진행합니다.\n아이와 어르신의 속도에 맞춰 쉬어 가며 촬영하고, 고른 사진은 오래 걸어둘 수 있게 정성껏 보정해 드립니다.',
    benefits: '아이와 어르신 속도에 맞춘 여유로운 촬영\n창가 자연광이 드는 넓은 스튜디오\n오래 걸어둘 수 있는 보정과 액자',
    target: '부모님 환갑·칠순을 기념하고 싶은 분',
    contact: '전화 02-000-0000',
  };
  p.pricing = {
    ...EMPTY_PRICING, listPrice: '250000', eventPrice: '189000', people: '4인 기준',
    includes: '원본 전체 제공\n보정본 3장\n11x14 액자 1개', etcExtra: '추가 1인 20,000원',
  };
  p.event = {
    ...EMPTY_EVENT, title: '가정의 달 가족사진 이벤트', period: '5월 한 달',
    listPrice: '250000', eventPrice: '189000',
    body: '가족 모두 함께 오시면 액자를 한 단계 크게 만들어 드립니다.',
  };
  p.perks = [
    { id: uid('perk'), title: '헤어 손질 무료', body: '촬영 전 간단한 헤어 정돈', photoId: '', icon: '' },
    { id: uid('perk'), title: '액자 업그레이드', body: '11x14에서 16x20으로', photoId: '', icon: '' },
    { id: uid('perk'), title: '보정본 1장 추가', body: '이벤트 기간 예약 시', photoId: '', icon: '' },
  ];
  p.photos = [hero, c1, c2, ...g];
  p.menus = [
    menu('main', '메인', { photoIds: [hero.id] }),
    menu('benefit', '봄날사진관의 장점', { body: p.product.benefits, template: 'A' }),
    menu('event', '가정의 달 가족사진 이벤트', { template: 'D' }),
    menu('perks', '특별한 혜택', { lines: p.perks.map((x) => `${x.title} | ${x.body}`), template: 'B' }),
    menu('price', '가격 안내', { template: 'B' }),
    menu('intro', '가족사진 소개', { body: p.product.description }),
    menu('shootConcept', '가족사진 콘셉트', { body: '원하시는 분위기로 골라보세요.', lines: ['캐주얼', '한복', '리마인드'], photoIds: [c1.id, c2.id], template: 'A' }),
    menu('gallery', '촬영 사례', { photoIds: g.map((x) => x.id), template: 'C' }),
    menu('recommend', '이런 분께 추천합니다', { lines: ['부모님 환갑·칠순을 기념하고 싶은 분', '아이가 크기 전에 가족사진을 남기고 싶은 분', '오래 걸어둘 가족 액자가 필요한 분'] }),
    menu('process', '촬영 과정', { lines: ['예약 문의', '촬영일 상담', '촬영', '사진 고르기', '보정', '액자·파일 전달'], template: 'A' }),
    menu('prepare', '촬영 전 준비사항', { lines: ['가족끼리 색을 맞춘 옷차림', '촬영 30분 전 도착', '아이가 있다면 여벌 옷과 간식'], template: 'B' }),
    menu('cta', '예약·문의', { body: '봄날사진관에서 편안하게 남겨보세요. 궁금한 점은 편하게 문의해주세요.\n\n전화 02-000-0000\n영업시간 10:00 ~ 19:00\n휴무 매주 월요일' }),
  ];
  p.flow = { recommendedAt: 1 };
  return { key: 'family', label: '가족사진 상세페이지', productKind: '가족사진', project: withStyle(p, 'luxury') };
}

function profile(): Example {
  const hero = artPhoto(portraitArt(['#eceef1', '#c9ced6'], '#2f3640', '#e6d0bd'), 900, 1200, 'main', '프로필 대표');
  const g = [
    artPhoto(portraitArt(['#f2f2f2', '#d4d4d4'], '#3b3b3b'), 900, 1200, 'product', '내추럴'),
    artPhoto(portraitArt(['#e9e9e9', '#bdbdbd'], '#1f1f1f', '#d9d9d9'), 900, 1200, 'product', '흑백'),
    artPhoto(portraitArt(['#eef3f2', '#c9d6d3'], '#40615b'), 900, 1200, 'product', '밝은 톤'),
    artPhoto(portraitArt(['#f1eeea', '#d6cdc3'], '#5a4b3f'), 900, 1200, 'product', '시크'),
  ];

  const p = createProject();
  p.id = 'example_profile';
  p.title = '프로필 상세페이지 (예시)';
  p.shoot = { ...EMPTY_BRIEF, productName: '프로필사진', area: '성수' };
  p.studio = { ...EMPTY_STUDIO, name: '라인스튜디오', area: '성수', phone: '02-000-0000', hours: '11:00 ~ 20:00', offDays: '매주 화요일' };
  p.product = {
    ...p.product,
    name: '성수 프로필 사진 촬영',
    brand: '라인스튜디오',
    category: '프로필사진',
    tagline: '나를 가장 나답게 보여주는 한 장',
    salePrice: '120000',
    description: '용도를 먼저 듣고 어울리는 표정과 각도를 함께 찾습니다.\n취업·오디션·SNS 어디에 써도 자연스러운 사진을 목표로 합니다.',
    benefits: '표정과 각도를 함께 찾아가는 촬영\n용도에 맞춘 다양한 컷\n과하지 않은 자연스러운 보정',
    target: '이력서·포트폴리오용 사진이 필요한 분',
    contact: '전화 02-000-0000',
  };
  p.pricing = { ...EMPTY_PRICING, eventPrice: '120000', people: '1인 기준', includes: '촬영 40분\n보정본 2장\n원본 전체 제공', etcExtra: '의상 추가 1벌 10,000원' };
  p.photos = [hero, ...g];
  p.menus = [
    menu('main', '메인', { photoIds: [hero.id] }),
    menu('benefit', '라인스튜디오의 장점', { body: p.product.benefits, template: 'B' }),
    menu('price', '가격 안내', { template: 'D' }),
    menu('intro', '프로필 촬영 소개', { body: p.product.description }),
    menu('gallery', '촬영 사례', { photoIds: g.map((x) => x.id), template: 'C' }),
    menu('recommend', '이런 분께 추천합니다', { lines: ['이력서·포트폴리오용 사진이 필요한 분', '오디션·지원서에 낼 사진이 필요한 분', 'SNS 프로필을 새로 바꾸고 싶은 분'] }),
    menu('process', '촬영 과정', { lines: ['상담', '의상·헤어 점검', '촬영', '사진 고르기', '보정 전달'], template: 'B' }),
    menu('prepare', '준비하면 좋은 것', { lines: ['원하는 느낌의 참고 사진', '의상 2~3벌', '촬영 전날 충분한 휴식'], template: 'A' }),
    menu('cta', '예약·문의', { body: '궁금한 점은 편하게 문의해주세요.\n\n전화 02-000-0000\n영업시간 11:00 ~ 20:00\n휴무 매주 화요일' }),
  ];
  p.flow = { recommendedAt: 1 };
  return { key: 'profile', label: '프로필 상세페이지', productKind: '프로필사진', project: withStyle(p, 'minimal') };
}

function goods(): Example {
  const hero = artPhoto(boardArt(['#f6f1ea', '#e7dccd'], '#c08a57'), 1200, 800, 'main', '도마 대표');
  const g = [
    artPhoto(boardArt(['#eef0ea', '#d7dccd'], '#b07c4b', 1200, 800, 6), 1200, 800, 'product', '도마 2'),
    artPhoto(boardArt(['#f3ece4', '#dfd2c3'], '#9c6b3f', 1200, 800, -14), 1200, 800, 'product', '도마 3'),
  ];

  const p = createProject();
  p.id = 'example_goods';
  p.title = '일반 상품 상세페이지 (예시)';
  p.shoot = { ...EMPTY_BRIEF, productName: '일반 상품' };
  p.studio = { ...EMPTY_STUDIO, name: '나무곳방' };
  p.product = {
    ...p.product,
    name: '통원목 캠핑 도마',
    brand: '나무곳방',
    category: '주방용품',
    tagline: '매일 손이 가는 튼튼한 원목 도마',
    listPrice: '48000',
    salePrice: '39000',
    description: '한 판의 원목을 그대로 깎아 이음새가 없습니다.\n손잡이 구멍이 있어 걸어서 말리기 좋고, 캠핑과 집 어디서나 쓰기 좋은 크기입니다.',
    benefits: '이음새 없는 통원목\n걸어서 말리는 손잡이 구멍\n캠핑·집 어디서나 알맞은 크기',
    target: '오래 쓸 튼튼한 도마를 찾는 분\n캠핑용 도마가 필요한 분',
    howToUse: '처음 쓰기 전 식용유를 얇게 발라 하루 말려주세요.\n쓴 뒤에는 물로 씻어 세워서 말려주세요.',
    caution: '식기세척기·전자레인지 사용은 피해주세요.\n원목 특성상 무늬와 색이 조금씩 다릅니다.',
    contact: '상품 문의는 톡톡으로 남겨주세요.',
  };
  p.pricing = { ...EMPTY_PRICING, listPrice: '48000', eventPrice: '39000', includes: '도마 1개 (40x25cm)\n관리용 오일 5ml\n선물 포장' };
  p.photos = [hero, ...g];
  p.menus = [
    menu('main', '메인', { photoIds: [hero.id] }),
    menu('benefit', '이 상품의 장점', { body: p.product.benefits, template: 'A' }),
    menu('price', '구성과 가격', { template: 'C' }),
    menu('intro', '상품 소개', { body: p.product.description }),
    menu('gallery', '상품 사진', { photoIds: g.map((x) => x.id), template: 'C' }),
    menu('recommend', '이런 분께 추천합니다', { lines: ['오래 쓸 튼튼한 도마를 찾는 분', '캠핑용 도마가 필요한 분', '선물할 주방용품을 찾는 분'], template: 'B' }),
    menu('howto', '사용 방법', { body: p.product.howToUse }),
    menu('caution', '주의사항', { body: p.product.caution }),
    menu('cta', '구매·문의', { body: '궁금한 점은 편하게 문의해주세요.' }),
  ];
  p.flow = { recommendedAt: 1 };
  return { key: 'goods', label: '일반 상품 상세페이지', productKind: '일반 상품', project: withStyle(p, 'warm') };
}

let cache: Example[] | null = null;

export function examples(): Example[] {
  if (!cache) cache = [family(), profile(), goods()];
  return cache;
}

/**
 * 예시의 **구성과 디자인만** 가져와 새 작업을 만든다.
 * 예시의 글·사진·가게 정보는 가져오지 않는다. (내 자료로 채운다)
 */
export function projectFromExample(ex: Example): ProjectData {
  const p = createProject();
  p.title = `${ex.productKind} 상세페이지`;
  p.shoot = { ...EMPTY_BRIEF, productName: ex.productKind };
  p.design = { ...ex.project.design, styleChosen: true };
  p.menus = ex.project.menus.map((m) => ({
    ...makeMenu(m.kind),
    template: m.template,
    /* 가게 이름이 들어간 제목은 일반 이름으로 */
    title: /봄날|라인|나무곳방/.test(m.title) ? makeMenu(m.kind).title : m.title,
  }));
  return p;
}
