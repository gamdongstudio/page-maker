/**
 * BARODU Tools 연결 설정.
 *
 * BARODU PAGE MAKER 는 링크에서 정보를 읽는 일을 직접 하지 않는다.
 * 그 일은 따로 설치하는 공통 도구인 **BARODU Tools** 가 맡는다.
 *
 *   BARODU PAGE MAKER  →  BARODU Tools  →  (실제 페이지 읽기)
 *
 * 두 프로그램은 이 파일에 적힌 약속으로만 이어져 있다.
 * BARODU Tools 가 바뀌어도 여기만 고치면 되고, 제작기 화면을 고쳐도 BARODU Tools 는 그대로다.
 *
 * ⚠ 자리 번호(포트)를 다른 파일에 적지 마세요. 찾는 자리는 여기 한 곳에서만 관리합니다.
 */

export const BARODU_TOOLS = {
  /** 이 이름으로 답해야 진짜 BARODU Tools 로 본다 */
  productName: 'BARODU Tools',

  /**
   * 찾아볼 자리.
   * BARODU Tools 는 맨 앞 번호를 먼저 쓰고, 이미 쓰는 중이면 다음 번호로 옮겨간다.
   * 그래서 한 번호만 보지 않고 순서대로 찾는다.
   */
  ports: [5199, 5200, 5201, 5202, 5203],

  /**
   * 제작기가 요구하는 최소 버전.
   * BARODU Tools 쪽에 새 기능이 필요해지면 이 값을 올린다.
   */
  minVersion: '1.0.0',

  /**
   * 설치파일을 내려받을 주소.
   * 배포를 시작하면 이 값 하나만 채우면 [설치] 버튼이 바로 동작한다.
   * 비어 있으면 파일 위치를 안내하는 방식으로 바뀐다.
   */
  installerUrl: 'https://github.com/gamdongstudio/barodu-tools/releases/download/v1.0.7/PM-Connect-Setup-1.0.7.exe',

  /** 설치파일 이름 — 주소가 없을 때 어디를 찾으면 되는지 알려주기 위해 */
  installerFileName: 'PM-Connect-Setup-1.0.7.exe',

  /** 한 번 찾은 자리를 기억해 두는 곳 (다음에 더 빨리 찾는다) */
  rememberKey: 'barodu.tools.port',

  /**
   * 이 컴퓨터에서 BARODU Tools 를 본 적이 있는지 기록하는 곳.
   * 화면에서는 브라우저가 프로그램 설치 여부를 직접 알 수 없다.
   * 그래서 **본 적이 있는지**로 "설치 안 됨" 과 "꺼져 있음" 을 갈라 안내한다.
   */
  seenKey: 'barodu.tools.seen',
} as const;

/** 지원하는 주소 종류 — 화면 안내에 그대로 쓴다 */
export const SUPPORTED_SOURCES = ['네이버 블로그', '네이버 스마트플레이스', '일반 홈페이지'] as const;
