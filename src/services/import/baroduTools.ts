/**
 * BARODU Tools 연결.
 *
 *   BARODU PAGE MAKER  →  BARODU Tools  →  (실제 페이지 읽기)
 *
 * 페이지를 여는 일은 **전부 BARODU Tools 안에서** 일어난다.
 * 제작기에는 페이지를 여는 코드를 두지 않는다. 두 프로그램은 아래 약속으로만 이어져 있다.
 *
 *   GET  /health      → { status:'ok', product:'BARODU Tools', version, port, ready }
 *   POST /v1/collect  → { url }  →  { ok:true, sourceType, title, text, images[] }
 *
 * 자리(포트)를 코드에 박아두지 않는다. BARODU Tools 는 5199 가 차 있으면 5200… 으로 옮겨가므로
 * 설정에 적힌 자리들을 순서대로 찾아본다. (`src/config/baroduTools.ts`)
 *
 * BARODU Tools 가 없어도 제작기는 전부 동작해야 한다.
 * 그래서 이 파일은 **실패를 조용히 삼키지 않고** 어떤 상태인지 그대로 돌려준다.
 */

import { BARODU_TOOLS } from '@/config/baroduTools';

export type SourceType =
  | 'naver-blog' | 'naver-place' | 'naver-store' | 'instagram' | 'website';

export interface FoundImage {
  url: string;
  width: number;
  height: number;
  alt: string;
  /**
   * BARODU Tools 가 **대신 받아주는 주소**.
   *
   * 네이버 같은 곳은 사진을 다른 프로그램이 직접 받아가지 못하게 막아 둔다.
   * 이 주소로 받으면 평범한 사진처럼 쓸 수 있다.
   * 예전 BARODU Tools 에는 이 칸이 없으므로 없을 수도 있다 — 그때는 원래 주소를 쓴다.
   */
  proxyUrl?: string;
}

/** 화면에 보여주거나 받아올 때 쓸 주소 — 대신 받아주는 주소가 있으면 그것을 쓴다 */
export function photoSrc(image: FoundImage): string {
  return image.proxyUrl || image.url;
}

export interface ImportResult {
  ok: true;
  sourceType: SourceType;
  url: string;
  title: string;
  description: string;
  text: string;
  images: FoundImage[];
}

export interface ImportFail {
  ok: false;
  reason: string;
  /** BARODU Tools 에 닿지 못한 경우 */
  offline?: boolean;
}

/** BARODU Tools 가 지금 어떤 상태인지 */
export type ToolsState =
  | 'checking'      // 아직 확인 중
  | 'connected'     // 잘 연결됨
  | 'old-version'   // 연결됐지만 너무 예전 버전
  | 'not-ready'     // 연결됐지만 읽기 도구가 준비되지 않음
  | 'stopped'       // 설치된 적은 있는데 지금 꺼져 있음
  | 'not-installed'; // 이 컴퓨터에서 본 적이 없음

export interface ToolsStatus {
  state: ToolsState;
  version: string;
  port: number;
  /** 화면에 그대로 보여줄 수 있는 짧은 말 */
  label: string;
}

export const SOURCE_LABEL: Record<SourceType, string> = {
  'naver-blog': '네이버 블로그',
  'naver-place': '네이버 스마트플레이스',
  'naver-store': '네이버 스마트스토어',
  instagram: '인스타그램',
  website: '홈페이지',
};

/**
 * 지금 **얼마나 잘 읽어오는지**.
 *
 * 되는 척하지 않는다. 아직 전용으로 읽는 방법을 만들지 않은 곳은 그대로 알린다.
 */
export const SOURCE_READINESS: Record<SourceType, { level: 'good' | 'partial'; note: string }> = {
  'naver-blog': { level: 'good', note: '글과 사진을 잘 가져옵니다.' },
  'naver-place': { level: 'good', note: '업체정보를 가져옵니다. 화면이 자주 바뀌어 못 읽을 때도 있습니다.' },
  'naver-store': {
    level: 'partial',
    note: '스마트스토어 전용으로 읽는 방법은 아직 준비 중입니다. 지금은 일반 방식으로 읽어 일부만 들어올 수 있어요.',
  },
  instagram: {
    level: 'partial',
    note: '인스타그램은 로그인해야 볼 수 있는 글이 많아 지금은 대부분 읽지 못합니다. 사진은 직접 올려주세요.',
  },
  website: { level: 'good', note: '글과 사진을 가져옵니다.' },
};

/* ------------------------------------------------------------------ */
/* 찾기                                                                */
/* ------------------------------------------------------------------ */

interface Found {
  base: string;
  version: string;
  port: number;
  ready: boolean;
}

/** 한 번 찾은 자리는 기억해 둔다 — 매번 다섯 자리를 두드리지 않기 위해 */
let cached: Found | null = null;

/** 이 컴퓨터에서 BARODU Tools 를 본 적이 있는지 (미설치와 꺼짐을 가르는 근거) */
function markSeen(): void {
  try { localStorage.setItem(BARODU_TOOLS.seenKey, '1'); } catch { /* 저장 못 해도 괜찮다 */ }
}
export function wasSeenBefore(): boolean {
  try { return localStorage.getItem(BARODU_TOOLS.seenKey) === '1'; } catch { return false; }
}

function rememberPort(port: number): void {
  try { localStorage.setItem(BARODU_TOOLS.rememberKey, String(port)); } catch { /* 무시 */ }
}
function rememberedPort(): number | null {
  try {
    const v = Number(localStorage.getItem(BARODU_TOOLS.rememberKey));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * 한 자리를 두드려 본다.
 *
 * 답이 온다고 다 BARODU Tools 는 아니다. 같은 자리를 다른 프로그램이 쓸 수 있으므로
 * **제품 이름까지 확인한다.** 이름이 다르면 없는 것으로 본다. (되는 척하지 않기 위해)
 */
async function ping(port: number): Promise<Found | null> {
  const base = `http://127.0.0.1:${port}`;
  const stop = new AbortController();
  const timer = window.setTimeout(() => stop.abort(), 1500);

  try {
    const res = await fetch(`${base}/health`, { signal: stop.signal });
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) return null;

    const data = await res.json() as {
      status?: string; product?: string; version?: string; port?: number; ready?: boolean;
    };
    if (data?.product !== BARODU_TOOLS.productName) return null;

    return {
      base,
      version: String(data.version ?? ''),
      port: Number(data.port ?? port),
      ready: data.ready !== false,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** BARODU Tools 를 찾는다. 기억해 둔 자리를 먼저 본다. */
async function find(): Promise<Found | null> {
  if (cached && await ping(cached.port)) return cached;

  const order: number[] = [...BARODU_TOOLS.ports];
  const remembered = rememberedPort();
  if (remembered && !order.includes(remembered)) order.unshift(remembered);
  else if (remembered) order.sort((a, b) => (a === remembered ? -1 : b === remembered ? 1 : 0));

  for (const port of order) {
    const found = await ping(port);
    if (found) {
      cached = found;
      rememberPort(found.port);
      markSeen();
      return found;
    }
  }

  cached = null;
  return null;
}

/** 다음 확인 때 자리를 처음부터 다시 찾게 한다 (Tools 를 다시 켠 경우) */
export function forgetTools(): void {
  cached = null;
}

/* ------------------------------------------------------------------ */
/* 상태                                                                */
/* ------------------------------------------------------------------ */

/** '1.2.3' 을 견주기 좋은 숫자로 */
function versionAtLeast(have: string, want: string): boolean {
  const a = have.split('.').map((n) => Number(n) || 0);
  const b = want.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

/**
 * BARODU Tools 가 지금 쓸 수 있는 상태인지.
 * 못 쓰는 경우에도 **왜 못 쓰는지** 갈라서 돌려준다 — 화면 안내가 달라야 하기 때문이다.
 */
export async function toolsStatus(): Promise<ToolsStatus> {
  const found = await find();

  if (!found) {
    return wasSeenBefore()
      ? { state: 'stopped', version: '', port: 0, label: 'PM Connect 꺼짐' }
      : { state: 'not-installed', version: '', port: 0, label: 'PM Connect 필요' };
  }

  if (!versionAtLeast(found.version, BARODU_TOOLS.minVersion)) {
    return { state: 'old-version', version: found.version, port: found.port, label: 'PM Connect 업데이트 필요' };
  }

  if (!found.ready) {
    return { state: 'not-ready', version: found.version, port: found.port, label: 'PM Connect 준비 안 됨' };
  }

  return { state: 'connected', version: found.version, port: found.port, label: 'PM Connect 연결됨' };
}

/* ------------------------------------------------------------------ */
/* 읽기                                                                */
/* ------------------------------------------------------------------ */

/** 주소가 쓸 만한 모양인지 — 누르기 전에 미리 본다 */
export function checkUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  const url = (raw ?? '').trim();
  if (!url) return { ok: false, reason: '주소를 넣어주세요.' };

  if (!/^https?:\/\//i.test(url)) {
    /* 'blog.naver.com/...' 처럼 앞을 빼고 붙여넣는 일이 흔하다 — 붙여서 다시 본다 */
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) return { ok: true, url: `https://${url}` };
    return { ok: false, reason: '주소를 다시 확인해주세요. (http:// 또는 https:// 로 시작해야 합니다)' };
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('.')) return { ok: false, reason: '주소를 다시 확인해주세요.' };
    return { ok: true, url };
  } catch {
    return { ok: false, reason: '주소를 다시 확인해주세요.' };
  }
}

/** 주소만 보고 어디인지 미리 알려준다 (화면 안내용) */
export function guessSource(url: string): SourceType {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (/blog\.naver\.com$/.test(host)) return 'naver-blog';
    if (/place\.naver\.com|map\.naver\.com|naver\.me/.test(host)) return 'naver-place';
    if (/smartstore\.naver\.com$|brand\.naver\.com$|shopping\.naver\.com$/.test(host)) return 'naver-store';
    if (/instagram\.com$/.test(host)) return 'instagram';
    return 'website';
  } catch {
    return 'website';
  }
}

/**
 * 이 화면이 **공개 주소(인터넷)** 에서 열렸는지.
 *
 * BARODU Tools 는 이 컴퓨터 안에서 열린 제작기에게만 답하도록 만들어져 있다.
 * 그래서 인터넷 주소로 열었을 때는 설치를 해도 이어지지 않는다.
 * "설치하면 된다" 고 알리면 안 되므로, 이 값을 보고 **안 된다고 그대로** 알린다.
 */
export function onPublicAddress(): boolean {
  if (typeof window === 'undefined') return false;
  return !/^(localhost|127.0.0.1)$/.test(window.location.hostname);
}

/**
 * 주소 하나를 읽어온다.
 *
 * 실패해도 **지금 작업은 절대 건드리지 않는다.** 이유만 돌려준다.
 */
export async function collectFromUrl(raw: string): Promise<ImportResult | ImportFail> {
  const checked = checkUrl(raw);
  if (!checked.ok) return { ok: false, reason: checked.reason };

  const found = await find();
  if (!found) {
    return {
      ok: false,
      offline: true,
      reason: wasSeenBefore()
        ? 'PM Connect가 꺼져 있습니다. 시작 메뉴에서 PM Connect를 실행한 뒤 다시 해주세요.'
        : '링크에서 정보를 가져오려면 PM Connect가 필요합니다.',
    };
  }

  try {
    const res = await fetch(`${found.base}/v1/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: checked.url }),
    });

    if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
      cached = null;
      return { ok: false, offline: true, reason: 'PM Connect와 연결이 끊어졌습니다. 다시 시도해주세요.' };
    }

    const data = await res.json() as ImportResult | ImportFail;

    /* 돌아온 답이 약속한 모양인지 본다 — 아니면 읽어온 척하지 않는다 */
    const looksRight = (data?.ok === true && typeof (data as ImportResult).text === 'string')
      || (data?.ok === false && typeof (data as ImportFail).reason === 'string');
    if (!looksRight) {
      return { ok: false, reason: '페이지 정보를 가져오지 못했습니다.' };
    }

    return data;
  } catch {
    /* 읽는 중에 BARODU Tools 가 꺼졌거나 자리를 옮겼을 수 있다 */
    cached = null;
    return {
      ok: false,
      offline: true,
      reason: 'PM Connect와 연결이 끊어졌습니다. 켜져 있는지 확인한 뒤 다시 시도해주세요.',
    };
  }
}
