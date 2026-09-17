import { IMAGE_POLICY } from '@/config/smartstore';
import type { HeroShape, Photo, PhotoFit, PhotoSource } from '@/types/project';
import { uid } from '@/types/defaults';

/**
 * 사진 자동 맞춤 — 이 프로그램의 핵심 중 하나.
 *
 * 어떤 비율의 사진을 넣어도 이상하게 보이지 않게 한다.
 *  - 원본 비율 유지 (찌그러짐 금지)
 *  - 비정상 확대 금지
 *  - 과도한 잘림 방지
 *  - 주요 피사체 보호 (가운데 위쪽을 우선으로 본다)
 *
 * 사용자 화면에는 개발 용어를 쓰지 않는다.
 */

export type PhotoShape = 'portrait' | 'landscape' | 'square';

export function shapeOf(p: { width: number; height: number }): PhotoShape {
  if (!p.width || !p.height) return 'square';
  const r = p.width / p.height;
  if (r > 1.15) return 'landscape';
  if (r < 0.87) return 'portrait';
  return 'square';
}

/** 저해상도인지 — 스마트스토어에 올리기엔 흐릴 수 있다 */
export function isLowResolution(p: { width: number }): boolean {
  return p.width > 0 && p.width < IMAGE_POLICY.lowResolutionWidth;
}

/**
 * 자동 맞춤일 때 이 사진을 어떤 높이로 보여줄지 정한다.
 * 세로로 아주 긴 사진을 원본 비율 그대로 두면 화면을 다 잡아먹으므로
 * 보기 좋은 범위 안으로만 담는다. (잘라내지 않고 높이만 제한)
 */
export function autoBoxHeight(photo: Photo, boxWidth: number): number {
  const ratio = photo.height / Math.max(1, photo.width);
  const natural = boxWidth * ratio;
  const shape = shapeOf(photo);

  /* 너무 긴 세로 사진은 과하게 길어지지 않게, 너무 납작한 가로 사진은 너무 얇지 않게 */
  const maxH = shape === 'portrait' ? boxWidth * 1.45 : boxWidth * 0.95;
  const minH = boxWidth * 0.42;

  return Math.round(Math.max(minH, Math.min(maxH, natural)));
}

/**
 * 실제로 화면에 적용할 값.
 * 여기서만 object-fit 같은 값을 다루고, 화면 문구에는 절대 쓰지 않는다.
 */
export function photoStyle(photo: Photo, boxWidth: number): React.CSSProperties {
  const common: React.CSSProperties = {
    width: '100%',
    display: 'block',
    objectPosition: `${photo.focusX}% ${photo.focusY}%`,
  };

  if (photo.fit === 'whole') {
    /* 사진 전체 보기 — 잘리는 부분 없이 다 보여준다 */
    return { ...common, height: 'auto', objectFit: 'contain' };
  }

  if (photo.fit === 'fill') {
    /* 화면 꽉 채우기 — 가로를 가득 채우고 위아래만 조금 잘린다 */
    return { ...common, height: Math.round(boxWidth * 0.75), objectFit: 'cover' };
  }

  /* 자동 맞춤 (기본) */
  const natural = (photo.height / Math.max(1, photo.width)) * boxWidth;
  const target = autoBoxHeight(photo, boxWidth);
  /* 원본 비율과 거의 같으면 잘라내지 않는다 */
  const almostNatural = Math.abs(natural - target) / Math.max(1, natural) < 0.06;

  return {
    ...common,
    height: almostNatural ? 'auto' : target,
    objectFit: almostNatural ? 'contain' : 'cover',
  };
}

/**
 * 대문(대표) 사진 칸의 높이.
 * '자동 추천'이면 원본 비율을 보고 알아서 정한다.
 */
export function heroBoxHeight(shape: HeroShape, boxWidth: number): number | null {
  if (shape === 'landscape') return Math.round(boxWidth * 0.75);   // 4:3
  if (shape === 'square') return Math.round(boxWidth);
  if (shape === 'portrait') return Math.round(boxWidth * 1.25);    // 4:5
  return null;                                                      // 자동 추천 = 원래 규칙을 따른다
}

/** 이 사진에는 어떤 대문 모양이 어울리는지 쉬운 말로 */
export function recommendHeroShape(photo: Photo): string {
  const s = shapeOf(photo);
  return s === 'landscape' ? '가로형' : s === 'portrait' ? '세로형' : '정사각형';
}

/** 쉬운 말 안내 */
export function photoWarning(photo: Photo): string | null {
  if (isLowResolution(photo)) {
    return '사진이 작아서 흐리게 보일 수 있어요. 더 큰 사진을 쓰면 좋습니다.';
  }
  if (photo.bytes > IMAGE_POLICY.maxFileSize) {
    return '사진 용량이 큽니다. 업로드가 느려질 수 있어요.';
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* 파일 읽기                                                            */
/* ------------------------------------------------------------------ */

export function readPhotoFiles(files: FileList | File[], source: PhotoSource = 'upload'): Promise<Photo[]> {
  const list = Array.from(files).filter((f) => /^image\//.test(f.type));
  if (!list.length) return Promise.resolve([]);

  return Promise.all(list.map(readOne))
    .then((all) => (all.filter(Boolean) as Photo[]).map((p) => ({ ...p, source })));
}

function readOne(file: File): Promise<Photo | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const probe = new Image();
      probe.onload = () => {
        const fitted = fitForPage(probe, file, dataUrl);
        resolve({
          id: uid('photo'),
          name: file.name || '사진',
          dataUrl: fitted.dataUrl,
          width: fitted.width,
          height: fitted.height,
          bytes: fitted.bytes,
          kind: 'product',
          fit: 'auto',
          focusX: 50,
          focusY: 42,          // 인물 사진에서 얼굴이 잘리지 않도록 조금 위를 본다
          caption: '',
          ...(fitted.resized ? { resized: fitted.resized } : {}),
        });
      };
      probe.onerror = () => resolve(null);
      probe.src = dataUrl;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------ */
/* 올린 사진을 상세페이지에 알맞은 크기로 줄이기                          */
/* ------------------------------------------------------------------ */

interface Fitted {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  resized?: { fromWidth: number; fromHeight: number; fromBytes: number };
}

/**
 * 요즘 휴대폰 사진은 4000px 이 넘는다.
 * 상세페이지는 860px 로 만들고 2배로 뽑으므로 그보다 큰 부분은 아무 데도 쓰이지 않는다.
 * 저장 공간만 차지하고 이미지 만들기도 느려지므로 올릴 때 알맞은 크기로 줄인다.
 *
 * 지키는 것:
 *  - 가로·세로를 **같은 비율로** 줄인다. 찌그러지지 않는다.
 *  - **잘라내지 않는다.** 사람 얼굴이나 상품이 임의로 잘릴 일이 없다.
 *  - 이미 작은 사진은 **절대 키우지 않는다.** (억지로 키우면 흐려진다)
 *  - 줄여도 용량이 줄지 않으면 원본을 그대로 쓴다.
 *  - 투명한 부분이 있는 사진은 투명도를 잃지 않게 그대로 둔다.
 *  - 실패하면 원본을 쓴다. 사진을 잃지 않는다.
 */
function fitForPage(img: HTMLImageElement, file: File, originalUrl: string): Fitted {
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  const asIs: Fitted = { dataUrl: originalUrl, width: w0, height: h0, bytes: file.size };
  if (!w0 || !h0) return asIs;

  /* 가로·세로 중 더 많이 넘치는 쪽에 맞춰 같은 비율로 줄인다 (1 보다 크면 키우지 않는다) */
  const ratio = Math.min(
    1,
    IMAGE_POLICY.maxStoredWidth / w0,
    IMAGE_POLICY.maxStoredHeight / h0,
  );
  const needsSmaller = ratio < 1;
  const heavy = file.size > IMAGE_POLICY.recompressOver;
  if (!needsSmaller && !heavy) return asIs;

  try {
    const tw = Math.max(1, Math.round(w0 * ratio));
    const th = Math.max(1, Math.round(h0 * ratio));

    /* 한 번에 확 줄이면 계단처럼 거칠어지므로 절반씩 여러 번 줄인다 */
    let src: CanvasImageSource = img;
    let cw = w0;
    let ch = h0;
    const temps: HTMLCanvasElement[] = [];
    while (cw > tw * 2 && ch > th * 2) {
      cw = Math.max(tw, Math.round(cw / 2));
      ch = Math.max(th, Math.round(ch / 2));
      const step = drawTo(src, cw, ch);
      if (!step) return asIs;
      temps.push(step);
      src = step;
    }

    const out = drawTo(src, tw, th);
    temps.forEach((c) => { c.width = 0; c.height = 0; });
    if (!out) return asIs;

    /* 투명한 부분이 있으면 JPG 로 바꾸지 않는다 (배경이 까맣게 변한다) */
    const keepAlpha = mayHaveAlpha(file) && hasTransparency(out);
    const mime = keepAlpha ? 'image/png' : 'image/jpeg';
    const url = keepAlpha
      ? out.toDataURL('image/png')
      : out.toDataURL(mime, IMAGE_POLICY.storeQuality);
    const bytes = dataUrlBytes(url);
    out.width = 0;
    out.height = 0;

    /* 줄였는데 오히려 커지면 의미가 없다 — 원본을 쓴다 */
    if (!url || bytes >= file.size) return asIs;

    return {
      dataUrl: url,
      width: tw,
      height: th,
      bytes,
      resized: { fromWidth: w0, fromHeight: h0, fromBytes: file.size },
    };
  } catch {
    /* 무슨 일이 있어도 사진을 잃지 않는다 */
    return asIs;
  }
}

function drawTo(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return canvas;
}

/** 이 형식이 투명도를 가질 수 있는지 (JPG 는 가질 수 없다) */
function mayHaveAlpha(file: File): boolean {
  return /png|webp|gif|avif/i.test(file.type);
}

function hasTransparency(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;   // 알 수 없으면 안전하게 그대로 둔다
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** data 주소에 실제로 담긴 용량 */
function dataUrlBytes(url: string): number {
  const comma = url.indexOf(',');
  if (comma < 0) return 0;
  const body = url.length - comma - 1;
  const pad = url.endsWith('==') ? 2 : url.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((body * 3) / 4) - pad);
}

/** 사진 배치 제안 — 비율만 보고 안전하게 (과도한 자동 레이아웃 엔진은 만들지 않는다) */
export function suggestLayout(photos: Photo[]): string {
  if (photos.length === 0) return '';
  if (photos.length === 1) {
    return shapeOf(photos[0]) === 'landscape' ? '가로사진 넓게' : '세로 1장 크게';
  }
  if (photos.length === 2 && photos.every((p) => shapeOf(p) === 'portrait')) {
    return '세로 2장 나란히';
  }
  return '갤러리';
}

export const FIT_HINT: Record<PhotoFit, string> = {
  auto: '사진 비율에 맞춰 자연스럽게 보여줍니다',
  whole: '잘리는 곳 없이 사진 전체를 보여줍니다',
  fill: '가로를 가득 채웁니다. 위아래가 조금 잘릴 수 있어요',
};
