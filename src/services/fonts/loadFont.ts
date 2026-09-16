import { FONTS, type FontKey } from '@/config/fonts';

/**
 * 글꼴 불러오기.
 *
 * 쓰는 글꼴만 그때그때 불러온다. 다섯 개를 한꺼번에 받지 않는다.
 * 못 받아와도 앱은 그대로 돌아간다 — 대체 글꼴로 보인다.
 */

const loaded = new Set<FontKey>();

export function loadFont(key: FontKey): void {
  if (loaded.has(key)) return;
  const def = FONTS[key];
  if (!def) { loaded.add(key); return; }

  /* 스타일시트가 없는 글꼴은 직접 적어 넣는다 */
  if (def.face) {
    try {
      if (!document.querySelector(`style[data-font="${key}"]`)) {
        const tag = document.createElement('style');
        tag.dataset.font = key;
        tag.textContent = def.face;
        document.head.appendChild(tag);
      }
    } catch {
      /* 무시 — 대체 글꼴로 보인다 */
    }
    loaded.add(key);
    return;
  }

  if (!def.href) { loaded.add(key); return; }

  try {
    /* 이미 같은 주소를 넣어뒀다면 또 넣지 않는다 */
    if (document.querySelector(`link[data-font="${key}"]`)) {
      loaded.add(key);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = def.href;
    link.dataset.font = key;
    /* 글꼴을 못 받아와도 넘어간다 */
    link.onerror = () => { /* 대체 글꼴로 보인다 */ };
    document.head.appendChild(link);
    loaded.add(key);
  } catch {
    /* 무시 — 대체 글꼴로 보인다 */
  }
}

/** 지금 쓰는 글꼴들을 한 번에 챙긴다 */
export function ensureFonts(keys: (FontKey | undefined)[]): void {
  keys.forEach((k) => { if (k) loadFont(k); });
}

/** 글꼴이 실제로 준비됐는지 (이미지로 뽑기 전에 기다릴 때 쓴다) */
export async function fontsReady(): Promise<void> {
  try {
    if ('fonts' in document) await (document as Document & { fonts: FontFaceSet }).fonts.ready;
  } catch {
    /* 무시 */
  }
}
