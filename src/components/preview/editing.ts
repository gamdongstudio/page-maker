import { createContext } from 'react';

/**
 * 지금 **미리보기에서 고치는 중**인지.
 *
 * 비어 있는 칸의 안내("여기에 보입니다")는 고칠 때만 필요하다.
 * 저장 이미지에는 한 글자도 들어가면 안 되므로, 이 값이 false 면 안내를 그리지 않는다.
 *
 * 컴포넌트 파일이 아닌 곳에 둔다.
 * (컴포넌트 파일이 컴포넌트가 아닌 것을 내보내면 화면이 통째로 깨진 적이 있다)
 */
export const EditingContext = createContext(false);
