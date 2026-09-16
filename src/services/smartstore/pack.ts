import JSZip from 'jszip';
import type { Photo } from '@/types/project';
import type { SmartStorePayload } from './payload';
import { fullText } from './text';
import { safeName } from '@/services/export/exportImage';

/**
 * 스마트스토어에 직접 올리실 때 쓰는 자료 한 묶음.
 *
 * 지키는 것
 *  - **올려주신 원본 사진을 고치지 않는다.** 올릴 때 쓸 복사본만 새로 만든다.
 *  - 사진 내용(화질·크기·비율)을 바꾸지 않는다. **이름만** 알아보기 쉽게 붙인다.
 *  - 폴더 앞에 번호를 붙여 어느 것부터 올릴지 바로 알 수 있게 한다.
 */

/* ------------------------------------------------------------------ */
/* 파일 이름                                                            */
/* ------------------------------------------------------------------ */

const NUM = (i: number) => String(i + 1).padStart(2, '0');

/**
 * 사진 이름을 짓는다.
 *
 *   {지역}{촬영상품}_{사진관명 또는 사진 용도}_{번호}.jpg
 *
 * ⚠ 같은 검색어를 여러 번 반복해 붙이지 않는다.
 *   (`광명가족사진_광명가족사진_…` 같은 이름은 만들지 않는다)
 *   이름을 알아보기 쉽게 정리하는 것일 뿐, 검색에 잘 나오게 해주는 기능이 아니다.
 */
export function photoFileName(
  base: string, middle: string, index: number | '대표', ext = 'jpg',
): string {
  const b = safeName(base) || '촬영상품';
  let m = safeName(middle || '');
  /* 앞머리와 같은 말이면 굳이 한 번 더 넣지 않는다 */
  if (!m || m === b || b.includes(m) || m.includes(b)) m = '';
  const tail = index === '대표' ? '대표' : NUM(index);
  return [b, m, tail].filter(Boolean).join('_') + '.' + ext;
}

/** 사진 용도 — 사장님이 적어두신 설명이 있으면 그것을 쓴다 */
function purposeOf(p: Photo): string {
  const caption = (p.caption ?? '').trim();
  if (caption) return caption.split(/\s+/).slice(0, 2).join('');
  return '';
}

/* ------------------------------------------------------------------ */
/* 사진 복사본                                                          */
/* ------------------------------------------------------------------ */

/**
 * 올릴 때 쓸 복사본을 만든다.
 *
 * 원본(`photo.dataUrl`)은 **그대로 둔다.** 여기서는 읽기만 한다.
 * 화질을 낮추지 않는다 — 들어 있는 그대로를 파일로 옮겨 담을 뿐이다.
 */
export function photoToBlob(p: Photo): Blob {
  const [head, data] = p.dataUrl.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const bin = atob(data ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function extOf(p: Photo): string {
  const m = /data:image\/(\w+)/.exec(p.dataUrl);
  const e = (m?.[1] ?? 'jpeg').toLowerCase();
  return e === 'jpeg' ? 'jpg' : e;
}

/** 이 사진들을 어떤 이름으로 올릴지 — 화면에서 미리 보여줄 때도 쓴다 */
export function plannedNames(v: SmartStorePayload): {
  main: string | null;
  extra: string[];
  detail: string[];
} {
  const studio = v.studioName;
  return {
    /* 대표사진은 번호 대신 '대표' 를 붙여 한눈에 구분되게 한다 */
    main: v.representativeImage
      ? photoFileName(v.baseName, studio, '대표', extOf(v.representativeImage))
      : null,
    extra: v.additionalImages.map((p, i) =>
      photoFileName(v.baseName, purposeOf(p) || studio, i, extOf(p)),
    ),
    detail: v.detailImages.map((_, i) => photoFileName(v.baseName, '상세', i)),
  };
}

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 등록자료 한 묶음을 만든다.
 *
 *   01_대표사진 / 02_추가사진 / 03_상세페이지 / 04_입력문구
 */
export async function buildZip(v: SmartStorePayload): Promise<Blob> {
  const zip = new JSZip();
  const names = plannedNames(v);

  const main = zip.folder('01_대표사진');
  if (v.representativeImage && names.main && main) {
    main.file(names.main, photoToBlob(v.representativeImage));
  } else if (main) {
    main.file('사진이_없습니다.txt', '대표사진을 올린 뒤 다시 받아주세요.');
  }

  const extra = zip.folder('02_추가사진');
  if (extra) {
    v.additionalImages.forEach((p, i) => extra.file(names.extra[i], photoToBlob(p)));
    if (v.additionalImages.length === 0) {
      extra.file('사진이_없습니다.txt', '추가사진이 없어도 등록은 할 수 있습니다.');
    }
  }

  const detail = zip.folder('03_상세페이지');
  if (detail) {
    v.detailImages.forEach((b, i) => detail.file(names.detail[i], b));
    if (v.detailImages.length === 0) {
      detail.file('이미지가_없습니다.txt', '상세페이지 이미지를 만들지 못했습니다.');
    }
  }

  const txt = zip.folder('04_입력문구');
  /* 메모장에서 글자가 깨지지 않도록 앞에 표시를 붙인다 */
  if (txt) txt.file('스마트스토어_입력내용.txt', '﻿' + fullText(v));

  return zip.generateAsync({ type: 'blob' });
}

/** ZIP 파일 이름 */
export function zipFileName(v: SmartStorePayload): string {
  return 'BARODU_스마트스토어_' + (safeName(v.productName || v.baseName) || '상품') + '.zip';
}
