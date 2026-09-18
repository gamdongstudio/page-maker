import type { SmartStorePayload } from './payload';
import { formatWon } from '@/utils/format';

/**
 * 스마트스토어에 손으로 옮겨 적을 때 쓰는 글.
 *
 * 개발용 자료가 아니다. **메모장으로 열어 그대로 복사**할 수 있는 모양이어야 한다.
 * 비어 있는 항목은 아예 넣지 않는다 (빈 칸만 잔뜩 있는 글은 오히려 헷갈린다).
 */

export interface CopyBlock {
  key: string;
  label: string;
  text: string;
}

/** 항목별로 나눠 둔 글 — 화면의 [복사] 단추와 TXT 가 **같은 것**을 쓴다 */
export function copyBlocks(v: SmartStorePayload): CopyBlock[] {
  const out: CopyBlock[] = [
    { key: 'productName', label: '상품명', text: v.productName },
    { key: 'salePrice', label: '판매가', text: v.salePrice ? formatWon(v.salePrice) : '' },
    { key: 'description', label: '상품 설명', text: v.description },
    { key: 'composition', label: '촬영 구성', text: bullets(v.composition) },
    { key: 'benefits', label: '이벤트·혜택', text: v.benefits },
    { key: 'reservationInfo', label: '예약·이용 안내', text: v.reservationInfo },
  ];
  if (v.normalPrice && v.normalPrice !== v.salePrice) {
    out.splice(2, 0, { key: 'normalPrice', label: '정상가', text: formatWon(v.normalPrice) });
  }
  return out.filter((b) => b.text.trim().length > 0);
}

/** 줄마다 `- ` 를 붙인다 (구성 항목처럼 목록으로 읽히게) */
function bullets(v: string): string {
  return (v ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('-') ? s : '- ' + s))
    .join('\n');
}

/** 전체 문구 — ZIP 안의 `스마트스토어_입력내용.txt` 와 [전체 문구 복사] 가 같은 글이다 */
export function fullText(v: SmartStorePayload): string {
  const head = [
    'PageMaker — 스마트스토어 입력내용',
    '',
    '아래 [   ] 아래의 글을 그대로 복사해서 스마트스토어의 같은 칸에 붙여넣으세요.',
    '',
    '───────────────────────────────',
    '',
  ];

  const body = copyBlocks(v).map((b) => `[${b.label}]\n\n${b.text}\n`);

  const tail = [
    '───────────────────────────────',
    '',
    '사진은 같은 ZIP 안의 폴더에 들어 있습니다.',
    '  01_대표사진    → 스마트스토어 대표 이미지',
    '  02_추가사진    → 추가 이미지',
    '  03_상세페이지  → 상세설명 이미지 (번호 순서대로 올려주세요)',
    '',
    '카테고리·배송·반품 설정은 스마트스토어에서 직접 골라주세요.',
    'PageMaker 는 그 값을 대신 정하지 않습니다.',
  ];

  return [...head, ...body, ...tail].join('\n');
}
