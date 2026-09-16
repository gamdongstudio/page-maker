import { dbGet, dbSet } from './db';
import {
  DEFAULT_SHOOT_PRODUCTS, EMPTY_STUDIO,
  type ShootProduct, type StudioInfo,
} from '@/types/studio';
import { uid } from '@/types/defaults';

/**
 * 사진관 공통정보와 촬영상품 목록.
 *
 * 이것은 **작업 하나에 딸린 값이 아니라 사진관 전체에서 다시 쓰는 값**이다.
 * 가족사진·프로필·증명사진마다 상호와 전화번호를 다시 적게 하지 않는다.
 * 그래서 프로젝트 파일과 따로 저장한다.
 */

const STUDIO_KEY = 'studio.info';
const PRODUCTS_KEY = 'studio.products';

/* ------------------------------------------------------------------ */
/* 사진관 공통정보                                                      */
/* ------------------------------------------------------------------ */

export async function loadStudio(): Promise<StudioInfo> {
  const got = await dbGet<StudioInfo>(STUDIO_KEY);
  return got && typeof got === 'object' ? { ...EMPTY_STUDIO, ...got } : { ...EMPTY_STUDIO };
}

export async function saveStudio(info: StudioInfo): Promise<boolean> {
  return dbSet(STUDIO_KEY, info);
}

/* ------------------------------------------------------------------ */
/* 촬영상품 목록 — 고정 카테고리가 아니다                                */
/* ------------------------------------------------------------------ */

export function makeShootProduct(name: string, builtin = false): ShootProduct {
  return { id: uid('sp'), name, builtin, hidden: false };
}

export function defaultShootProducts(): ShootProduct[] {
  return DEFAULT_SHOOT_PRODUCTS.map((n) => makeShootProduct(n, true));
}

export async function loadShootProducts(): Promise<ShootProduct[]> {
  const got = await dbGet<ShootProduct[]>(PRODUCTS_KEY);
  if (Array.isArray(got) && got.length > 0) return got;
  return defaultShootProducts();
}

export async function saveShootProducts(list: ShootProduct[]): Promise<boolean> {
  return dbSet(PRODUCTS_KEY, list);
}

/**
 * 기본 촬영상품 되살리기.
 * 사용자가 직접 추가한 상품은 그대로 두고, 빠진 기본 상품만 다시 넣는다.
 */
export function restoreDefaults(list: ShootProduct[]): ShootProduct[] {
  const out = list.map((p) => (p.builtin ? { ...p, hidden: false } : p));
  DEFAULT_SHOOT_PRODUCTS.forEach((name) => {
    if (!out.some((p) => p.name === name)) out.push(makeShootProduct(name, true));
  });
  return out;
}
