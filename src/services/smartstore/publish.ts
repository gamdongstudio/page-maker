import { BARODU_TOOLS } from '@/config/baroduTools';
import { onPublicAddress, toolsStatus } from '@/services/import/baroduTools';
import type { SmartStorePayload } from './payload';
import { plannedNames, photoToBlob } from './pack';
import { copyBlocks } from './text';

/**
 * 스마트스토어 자동입력 — BARODU Tools 에 일을 넘기는 쪽.
 *
 * PAGE MAKER 는 **스마트스토어 화면을 직접 만지지 않는다.**
 * 어떤 칸이 어디 있는지(화면 구조)는 전부 BARODU Tools 쪽에 있다.
 * 네이버 화면이 바뀌면 BARODU Tools 만 고치면 된다.
 *
 * 그리고 이 기능은 **마지막 등록 단추를 절대 누르지 않는다.**
 * 값을 채워 두는 데까지만 하고 멈춘다. 등록은 사장님이 확인하고 직접 누르신다.
 */

/** 자동입력이 어디까지 갔는지 — 화면에 그대로 보여준다 */
export interface PublishStep {
  label: string;
  state: 'wait' | 'doing' | 'done' | 'fail';
  note?: string;
}

export interface PublishResult {
  ok: boolean;
  /** 사람이 읽는 말 */
  reason?: string;
  steps: PublishStep[];
  /** 다시 할 때 여기부터 하면 되는 자리 */
  resumeFrom?: number;
}

/** 자동입력을 다시 돌릴 때 이미 들어 있는 값을 어떻게 할지 */
export type FillMode = 'empty-only' | 'overwrite';

/* ------------------------------------------------------------------ */

/** 사진 한 장을 보낼 수 있는 모양으로 (이름 + 내용) */
async function toSendable(blob: Blob, name: string): Promise<{ name: string; type: string; base64: string }> {
  const buf = await blob.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { name, type: blob.type || 'image/jpeg', base64: btoa(bin) };
}

/**
 * BARODU Tools 에 보낼 한 벌을 만든다.
 * **화면에서 보여준 값·ZIP 에 담는 값과 완전히 같은 것**을 쓴다.
 */
export async function toRequest(v: SmartStorePayload, mode: FillMode) {
  const names = plannedNames(v);
  const blocks = copyBlocks(v);

  const images: { slot: 'main' | 'extra' | 'detail'; name: string; type: string; base64: string }[] = [];

  if (v.representativeImage && names.main) {
    images.push({ slot: 'main', ...(await toSendable(photoToBlob(v.representativeImage), names.main)) });
  }
  for (let i = 0; i < v.additionalImages.length; i += 1) {
    images.push({ slot: 'extra', ...(await toSendable(photoToBlob(v.additionalImages[i]), names.extra[i])) });
  }
  for (let i = 0; i < v.detailImages.length; i += 1) {
    images.push({ slot: 'detail', ...(await toSendable(v.detailImages[i], names.detail[i])) });
  }

  return {
    mode,
    /* 글은 항목 이름을 붙여 보낸다 — 어느 칸에 넣을지는 Tools 가 정한다 */
    fields: Object.fromEntries(blocks.map((b) => [b.key, b.text])),
    images,
    /* 마지막 등록 단추는 절대 누르지 않는다 — 여기서도 못 박아 보낸다 */
    stopBeforeSubmit: true,
  };
}

/* ------------------------------------------------------------------ */

/** 지금 자동입력을 쓸 수 있는지 */
export async function canAutoFill(): Promise<{ ok: boolean; reason: string }> {
  if (onPublicAddress()) {
    return {
      ok: false,
      reason: '이 주소에서는 자동입력을 쓸 수 없습니다. '
        + 'PM Connect는 컴퓨터에 설치된 제작기에서만 답합니다. '
        + '아래 등록자료 받기와 항목별 복사는 그대로 쓰실 수 있어요.',
    };
  }
  const s = await toolsStatus();
  if (s.state === 'connected') return { ok: true, reason: '' };
  if (s.state === 'stopped') {
    return { ok: false, reason: 'PM Connect가 꺼져 있습니다. 시작 메뉴에서 실행한 뒤 다시 확인을 눌러주세요.' };
  }
  if (s.state === 'not-installed') {
    return { ok: false, reason: 'PM Connect가 필요합니다. 설치한 뒤에 쓸 수 있어요.' };
  }
  if (s.state === 'old-version') {
    return { ok: false, reason: 'PM Connect를 새 버전으로 올려주세요.' };
  }
  return { ok: false, reason: 'PM Connect가 아직 준비되지 않았습니다.' };
}

/**
 * 자동입력 실행.
 *
 * 실패해도 **지금 작업 내용은 하나도 건드리지 않는다.** 여기서는 보내기만 한다.
 */
export async function autoFill(v: SmartStorePayload, mode: FillMode): Promise<PublishResult> {
  const s = await toolsStatus();
  if (s.state !== 'connected') {
    const why = await canAutoFill();
    return { ok: false, reason: why.reason, steps: [] };
  }

  const body = await toRequest(v, mode);

  try {
    const res = await fetch(`http://127.0.0.1:${s.port}/v1/publish/smartstore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 404) {
      return {
        ok: false,
        steps: [],
        reason: '지금 설치된 PM Connect는 스마트스토어 자동입력을 아직 못 합니다. 새 버전으로 올려주세요.',
      };
    }

    const got = (await res.json()) as PublishResult;
    return got && typeof got === 'object'
      ? got
      : { ok: false, steps: [], reason: 'PM Connect의 답을 읽지 못했습니다.' };
  } catch {
    return {
      ok: false,
      steps: [],
      reason: 'PM Connect와 연결하지 못했습니다. 켜져 있는지 확인해 주세요.',
    };
  }
}

/** 설치 안내에 쓰는 파일 이름 */
export const TOOLS_FILE = BARODU_TOOLS.installerFileName;
