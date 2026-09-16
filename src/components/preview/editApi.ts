import type { ProductInfo } from '@/types/project';

/**
 * 미리보기에서 바로 고칠 때 쓰는 연결 고리.
 *
 * 미리보기는 **화면만 그린다.** 실제로 값을 바꾸는 일은 App 쪽에서 한다.
 * 그래서 저장 이미지를 만들 때는 이 고리를 넘기지 않기만 하면
 * 편집용 표시가 한 개도 그려지지 않는다.
 */

/** 오른쪽 패널에서 열어야 할 곳 */
export type JumpTool = 'product' | 'media' | 'menus' | 'design' | 'check' | 'ai';

export interface PreviewEdit {
  /** 촬영상품 정보를 고쳤다 (상품명·사진관명·한 줄 소개·가격) */
  onProduct: (key: keyof ProductInfo, value: string) => void;
  /** 섹션의 제목·본문·버튼 문구를 고쳤다 */
  onMenuText: (menuId: string, key: 'title' | 'body' | 'button', value: string) => void;
  /** 가격표 상품의 이름·가격을 고쳤다 */
  onPackage: (packageId: string, key: 'name' | 'price' | 'note', value: string) => void;
  /** 오른쪽 패널의 해당 자리로 옮겨간다 */
  onJump: (tool: JumpTool, menuId?: string) => void;
  /** 섹션 다루기 */
  onSection: (action: 'up' | 'down' | 'dup' | 'hide' | 'del', menuId: string) => void;
  /** 이 자리에 새 섹션을 넣는다 (index 번째 앞) */
  onAddAt: (index: number) => void;
  /** 섹션 순서를 끌어서 바꾼다 */
  onReorder: (fromId: string, toId: string) => void;
  /** 사진 바꾸기 — photoId 가 없으면 이 섹션에 새로 넣는다 */
  onPhotoFiles: (menuId: string, photoId: string | null, files: File[]) => void;
  /** 사진 하나 다루기 */
  onPhoto: (action: 'main' | 'remove' | 'pick', menuId: string, photoId: string) => void;
}
