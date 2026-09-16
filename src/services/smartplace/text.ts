import type { SmartPlacePayload } from './payload';

/**
 * 메모장으로 열어 **위에서부터 그대로 옮겨 적는** 글.
 *
 * 지키는 것
 *  - 항목 이름을 **두 번 쓰지 않는다.** (`01. 업체명` 아래에 다시 `업체명:` 을 쓰지 않는다)
 *  - 값은 항목 이름 **바로 아랫줄**에 둔다.
 *  - 개발용 자료(JSON·변수 이름·HTML)는 한 글자도 넣지 않는다.
 */

/** 값이 비어 있을 때 파일에 적을 말 */
function blankText(important: boolean): string {
  return important ? '확인 필요' : '입력할 내용 없음';
}

/**
 * 전체 글.
 * `[전체 내용 복사]` 와 메모장 파일이 **같은 글**을 쓴다.
 */
export function placeFullText(items: SmartPlacePayload): string {
  return items
    .map((it) => {
      const v = (it.value ?? '').trim() || blankText(it.important);
      return `${it.no}. ${it.label}\n${v}`;
    })
    .join('\n\n\n');
}

/** 메모장 파일 이름 */
export const PLACE_FILE_NAME = '스마트플레이스_입력내용.txt';

/** 메모장에서 한글이 깨지지 않도록 앞에 표시를 붙인다 */
export function placeFileBody(items: SmartPlacePayload): string {
  return '﻿' + placeFullText(items);
}
