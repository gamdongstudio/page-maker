import { useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { searchTitles } from '@/services/ai/studioPlanner';
import { copyText } from '@/utils/copyText';

/**
 * 스마트스토어 상품명 추천.
 *
 * 새 입력칸을 만들지 않는다 — 이미 가지고 있는 지역·촬영분야·상품명·특징·구성만 쓴다.
 * 제목을 만드는 규칙은 ② 에서 쓰는 것과 **같은 함수**(searchTitles)를 그대로 쓴다.
 * (검색 낱말을 억지로 반복하지 않는 규칙도 그 안에 들어 있다)
 */
export function StoreTitle() {
  const { project } = useProject();
  const [msg, setMsg] = useState('');

  const p = project.product;
  const area = (project.studio?.area ?? '').trim();
  const product = (project.shoot?.productName || p.name || '').trim();
  /* 제목을 고를 때 참고하는 글 — 이미 적혀 있는 것만 본다 */
  const evidence = [p.benefits, p.description, project.pricing?.includes, p.target].filter(Boolean).join(' ');

  /* ③ 에서 이미 고른 제목이 있으면 그것을 먼저 보여준다 */
  const picked = (p.storeTitle ?? '').trim();
  const best = picked || searchTitles(product, area, evidence)[0] || '';

  const copy = async () => {
    const ok = await copyText(best);
    setMsg(ok ? '상품명을 복사했습니다.' : '복사하지 못했습니다. 글자를 직접 선택해 복사해 주세요.');
  };

  return (
    <section className="box">
      <h3 className="box__title">스마트스토어 상품명 추천</h3>
      {best ? (
        <>
          <p className="field__label">추천 상품명</p>
          <p className="storetitle">{best}</p>
          <button className="btn btn--line wide" onClick={() => void copy()}>상품명 복사</button>
          {msg && <p className="note note--ok" aria-live="polite">{msg}</p>}
        </>
      ) : (
        <p className="field__hint">
          {area
            ? '상품명을 먼저 넣어주세요. ① 자료 준비에서 상품명을 적으면 추천해 드립니다.'
            : '지역을 먼저 넣어주세요. ① 자료 준비 → 사진관·매장 정보에서 지역을 적으면 추천해 드립니다.'}
        </p>
      )}
    </section>
  );
}
