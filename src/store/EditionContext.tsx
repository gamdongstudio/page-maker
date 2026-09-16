import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { EditionMode } from '@/config/smartstore';

/**
 * LITE / PRO.
 *
 * 프로그램을 두 개로 나누지 않는다.
 * 같은 구조에서 **보여주는 범위만** 다르게 한다.
 * LITE 도 실제 업무에 쓸 수 있어야 하므로 핵심 기능은 LITE 에도 남긴다.
 */

const KEY = 'saypagemaker.edition';

interface Ctx {
  edition: EditionMode;
  isPro: boolean;
  setEdition: (m: EditionMode) => void;
}

const EditionCtx = createContext<Ctx | null>(null);

export function EditionProvider({ children }: { children: ReactNode }) {
  const [edition, setEdition] = useState<EditionMode>(() => {
    try {
      return localStorage.getItem(KEY) === 'lite' ? 'lite' : 'pro';
    } catch {
      return 'pro';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, edition);
    } catch {
      /* 저장소를 못 써도 앱은 그대로 동작한다 */
    }
  }, [edition]);

  return (
    <EditionCtx.Provider value={{ edition, isPro: edition === 'pro', setEdition }}>
      {children}
    </EditionCtx.Provider>
  );
}

export function useEdition(): Ctx {
  const v = useContext(EditionCtx);
  if (!v) throw new Error('EditionProvider 안에서만 쓸 수 있습니다.');
  return v;
}
