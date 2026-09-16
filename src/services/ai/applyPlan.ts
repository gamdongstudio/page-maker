import type { MenuItem, ProjectData } from '@/types/project';
import { makeMenu } from '@/types/defaults';
import type { PlannedMenu, StudioPlan } from './studioPlanner';
import { nextTemplateFor } from '@/components/preview/templates';

/**
 * 만들어진 구성을 실제 작업에 반영한다.
 *
 * ⚠ 가장 중요한 규칙
 *   사용자가 직접 쓴 내용은 **허락 없이 지우지 않는다.**
 *   한 섹션만 다시 만들 때 다른 섹션은 **절대 건드리지 않는다.**
 */

export type WholeMode =
  /** 내용은 그대로 두고 구성·디자인만 새로 */
  | 'designOnly'
  /** 사진은 그대로 두고 구성과 글을 새로 */
  | 'keepPhotos'
  /** 처음부터 완전히 새로 */
  | 'fresh';

export interface ApplyOptions {
  mode: WholeMode;
  titleIndex?: number;
  heroIndex?: number;
}

/* ------------------------------------------------------------------ */
/* 전체 만들기                                                          */
/* ------------------------------------------------------------------ */

export function applyStudioPlan(d: ProjectData, plan: StudioPlan, opts: ApplyOptions): void {
  const { mode } = opts;

  /* 제목과 카피 — 'designOnly' 는 글을 바꾸지 않는다 */
  if (mode !== 'designOnly') {
    const title = plan.searchTitles[opts.titleIndex ?? 0];
    const hero = plan.heroCopy[opts.heroIndex ?? 0];
    if (title) d.product.name = title;
    if (hero) d.product.tagline = hero;
    if (!d.product.target) d.product.target = plan.audience;
    if (!d.product.category && plan.productName) d.product.category = plan.productName;
  }

  /* 대표사진 — 사용자가 이미 정해뒀으면 그대로 둔다 */
  if (plan.mainPhotoId && !d.photos.some((p) => p.kind === 'main')) {
    const target = d.photos.find((p) => p.id === plan.mainPhotoId);
    if (target) target.kind = 'main';
  }

  /* 메뉴 구성 */
  const previous = new Map<string, MenuItem>();
  d.menus.forEach((m) => { if (!previous.has(m.kind)) previous.set(m.kind, m); });

  const next: MenuItem[] = plan.menus.map((planned) => {
    const old = previous.get(planned.kind);
    if (old) previous.delete(planned.kind);
    return mergeMenu(old, planned, mode);
  });

  /* 추천에 없던 기존 메뉴는 지우지 않고 뒤에 남긴다.
     다만 내용이 하나도 없으면 숨겨둔다 — 빈 칸이 결과 이미지에 남으면 안 된다. */
  previous.forEach((m) => {
    const hasOwn = !!(m.body.trim() || m.lines.some((l) => l.trim()) || m.photoIds.length);
    next.push(hasOwn ? m : { ...m, hidden: true });
  });
  d.menus = next;
}

/** 기존 메뉴와 새 구성을 합친다 — 사람이 쓴 글이 우선이다 */
function mergeMenu(old: MenuItem | undefined, planned: PlannedMenu, mode: WholeMode): MenuItem {
  if (!old) {
    const created = makeMenu(planned.kind, planned.title);
    created.body = planned.body;
    created.lines = [...planned.lines];
    created.photoIds = [...planned.photoIds];
    created.template = planned.template;
    /* 확인된 내용이 없는 섹션은 숨겨둔다 — 빈 칸이나 샘플 글이 결과에 남지 않게 */
    created.hidden = !!planned.hidden;
    return created;
  }

  const kept: MenuItem = { ...old };

  if (mode === 'designOnly') {
    /* 모양만 바꾼다. 글·사진은 손대지 않는다 */
    kept.template = planned.template;
    return kept;
  }

  /*
   * 'keepPhotos' 와 'fresh' 는 사용자가 확인 화면에서 새 구성을 보고 누른 것이므로
   * 제목과 글을 새로 채운다. (마음에 안 들면 실행취소로 바로 되돌아간다)
   * 사진 배치와 추천에 없던 메뉴는 그대로 지킨다.
   */
  kept.title = planned.title || kept.title;
  kept.body = planned.body || kept.body;
  kept.lines = planned.lines.length ? [...planned.lines] : kept.lines;
  /* 내용이 생겼으면 다시 보이게, 여전히 없으면 숨긴 채로 */
  const hasOwn = !!(kept.body.trim() || kept.lines.some((l) => l.trim()) || kept.photoIds.length);
  kept.hidden = planned.hidden ? !hasOwn : false;

  /* 사진은 사용자가 고른 것이 있으면 그대로 */
  if (kept.photoIds.length === 0 && planned.photoIds.length) {
    kept.photoIds = [...planned.photoIds];
  }
  kept.template = planned.template || kept.template || 'A';
  return kept;
}

/* ------------------------------------------------------------------ */
/* 섹션 하나만 다시 만들기                                               */
/* ------------------------------------------------------------------ */

export type RegenPart = 'all' | 'title' | 'body' | 'photos' | 'template';

/**
 * 고른 섹션 하나만 새로 만든다.
 * 다른 섹션은 이 함수가 아예 건드리지 않는다.
 */
export function regenerateMenu(
  d: ProjectData,
  menuId: string,
  plan: StudioPlan,
  part: RegenPart,
): boolean {
  const target = d.menus.find((m) => m.id === menuId);
  if (!target) return false;
  const planned = plan.menus.find((p) => p.kind === target.kind);
  if (!planned) return false;

  if (part === 'all' || part === 'title') target.title = planned.title || target.title;
  if (part === 'all' || part === 'body') {
    target.body = planned.body;
    target.lines = [...planned.lines];
  }
  if (part === 'all' || part === 'photos') target.photoIds = [...planned.photoIds];
  /* 섹션마다 고를 수 있는 모양 수가 다르므로 그 섹션의 목록 안에서만 돈다 */
  if (part === 'template') target.template = nextTemplateFor(target.kind, target.template);
  return true;
}


/* ------------------------------------------------------------------ */
/* 만들 범위 고르기                                                      */
/* ------------------------------------------------------------------ */

/**
 * 어디까지 AI 가 손댈지.
 * 기본은 가장 안전한 'fillEmpty' — 비어 있는 곳만 채운다.
 */
export type AiScope = 'fillEmpty' | 'copy' | 'structure' | 'photos' | 'design' | 'all';

/**
 * 화면에 보여줄 말.
 *   short — 카드에 크게 (한두 낱말)
 *   hint  — 그 아래 작게 (무엇이 바뀌는지)
 *   title·desc — 자세한 설명 (마우스를 올렸을 때, 요약글)
 */
export const SCOPE_LABEL: Record<AiScope, {
  short: string; hint: string; title: string; desc: string;
}> = {
  fillEmpty: {
    short: '빈칸 채우기', hint: '기존 내용 유지',
    title: '비어 있는 내용만 채우기', desc: '이미 적어두신 내용은 건드리지 않습니다.',
  },
  copy: {
    short: '문구 작성', hint: '제목·소개글',
    title: '제목과 문구만 작성', desc: '구성·사진·디자인은 그대로 두고 글만 새로 씁니다.',
  },
  structure: {
    short: '구성 추천', hint: '필요한 메뉴',
    title: '상세페이지 구성만 추천', desc: '어떤 메뉴를 어떤 순서로 둘지만 정합니다.',
  },
  photos: {
    short: '사진 배치', hint: '사진 위치',
    title: '사진 배치만 추천', desc: '어느 사진을 어디에 놓을지만 정합니다.',
  },
  design: {
    short: '디자인 추천', hint: '색상·스타일',
    title: '디자인만 추천', desc: '섹션 모양만 바꿉니다. 글과 사진은 그대로입니다.',
  },
  all: {
    short: '전체 만들기', hint: '전체 초안',
    title: '전체 상세페이지 만들기', desc: '구성·글·사진배치·디자인을 모두 새로 만듭니다.',
  },
};

/**
 * 고른 범위만큼만 반영한다.
 *
 * ⚠ 'all' 을 빼면 어떤 범위도 사용자가 적어둔 글을 지우지 않는다.
 *   사진 자체는 어느 범위에서도 지우지 않는다.
 */
export function applyScoped(
  d: ProjectData,
  plan: StudioPlan,
  scope: AiScope,
  titleIndex = 0,
  heroIndex = 0,
): void {
  if (scope === 'all') {
    applyStudioPlan(d, plan, { mode: 'keepPhotos', titleIndex, heroIndex });
    return;
  }

  if (scope === 'design') {
    d.menus.forEach((m) => {
      const planned = plan.menus.find((p) => p.kind === m.kind);
      if (planned) m.template = planned.template;
    });
    return;
  }

  if (scope === 'photos') {
    if (plan.mainPhotoId && !d.photos.some((p) => p.kind === 'main')) {
      const t = d.photos.find((p) => p.id === plan.mainPhotoId);
      if (t) t.kind = 'main';
    }
    d.menus.forEach((m) => {
      const planned = plan.menus.find((p) => p.kind === m.kind);
      if (planned && planned.photoIds.length) m.photoIds = [...planned.photoIds];
    });
    return;
  }

  if (scope === 'structure') {
    /* 메뉴 종류와 순서만 맞춘다. 글·사진은 있던 것을 그대로 옮겨온다. */
    const have = new Map(d.menus.map((m) => [m.kind, m]));
    const next: MenuItem[] = plan.menus.map((planned) => {
      const old = have.get(planned.kind);
      if (old) { have.delete(planned.kind); return old; }
      const created = makeMenu(planned.kind, planned.title);
      created.body = planned.body;
      created.lines = [...planned.lines];
      created.photoIds = [...planned.photoIds];
      created.template = planned.template;
      created.hidden = !!planned.hidden;
      return created;
    });
    have.forEach((m) => next.push(m));
    d.menus = next;
    return;
  }

  if (scope === 'copy') {
    const title = plan.searchTitles[titleIndex];
    const hero = plan.heroCopy[heroIndex];
    if (title) d.product.name = title;
    if (hero) d.product.tagline = hero;
    d.menus.forEach((m) => {
      const planned = plan.menus.find((p) => p.kind === m.kind);
      if (!planned) return;
      if (planned.title) m.title = planned.title;
      if (planned.body) m.body = planned.body;
      if (planned.lines.length) m.lines = [...planned.lines];
    });
    return;
  }

  /* fillEmpty — 빈 곳만 채운다 */
  const title = plan.searchTitles[titleIndex];
  const hero = plan.heroCopy[heroIndex];
  if (!d.product.name.trim() && title) d.product.name = title;
  if (!d.product.tagline.trim() && hero) d.product.tagline = hero;
  if (!d.product.target.trim()) d.product.target = plan.audience;
  if (!d.product.category.trim() && plan.productName) d.product.category = plan.productName;

  if (plan.mainPhotoId && !d.photos.some((p) => p.kind === 'main')) {
    const t = d.photos.find((p) => p.id === plan.mainPhotoId);
    if (t) t.kind = 'main';
  }

  const have = new Map(d.menus.map((m) => [m.kind, m]));
  plan.menus.forEach((planned) => {
    const old = have.get(planned.kind);
    if (!old) {
      /* 없던 메뉴는 새로 넣는다 */
      const created = makeMenu(planned.kind, planned.title);
      created.body = planned.body;
      created.lines = [...planned.lines];
      created.photoIds = [...planned.photoIds];
      created.template = planned.template;
      created.hidden = !!planned.hidden;
      d.menus.push(created);
      return;
    }
    /* 있던 메뉴는 비어 있는 칸만 채운다 */
    if (!old.title.trim() && planned.title) old.title = planned.title;
    if (!old.body.trim() && planned.body) old.body = planned.body;
    if (old.lines.every((l) => !l.trim()) && planned.lines.length) old.lines = [...planned.lines];
    if (old.photoIds.length === 0 && planned.photoIds.length) old.photoIds = [...planned.photoIds];
    if (!old.template) old.template = planned.template;
  });

  /*
   * 순서만 추천대로 맞춘다.
   * 순서를 바꾸는 것은 글을 지우는 일이 아니므로 '비어 있는 내용만 채우기'에서도 안전하다.
   * (이렇게 하지 않으면 '예약·문의' 가 한가운데 남는다)
   */
  const rank = new Map(plan.menus.map((m, i) => [m.kind, i]));
  d.menus.sort((a, b) => (rank.get(a.kind) ?? 999) - (rank.get(b.kind) ?? 999));
}
