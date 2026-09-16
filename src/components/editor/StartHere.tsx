import { useEffect, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { listWorks, openWork, whenText, type WorkSummary } from '@/services/storage/works';
import type { StepKey } from './EditorPanel';

/**
 * 처음 들어왔을 때 오른쪽에 보이는 화면.
 *
 * AI 를 가장 먼저 권하되 **강요하지 않는다.**
 * 어느 쪽으로 시작하든 같은 편집 데이터와 같은 화면을 쓴다. 다른 페이지로 가지 않는다.
 */
export function StartHere({ onPick }: { onPick: (s: StepKey) => void }) {
  const { project, replace } = useProject();
  const [works, setWorks] = useState<WorkSummary[]>([]);

  useEffect(() => { void listWorks().then((list) => setWorks(list.slice(0, 3))); }, []);

  /* 자동저장으로 이어지던 작업이 이미 있는지 */
  const hasCurrent = !!project.product.name.trim() || project.photos.length > 0;

  const resume = async (w: WorkSummary) => {
    const data = await openWork(w.id);
    if (data) {
      replace(data);
      onPick('product');
    }
  };

  return (
    <div className="starthere">
      <h2 className="starthere__title">어떻게 시작할까요?</h2>
      <p className="starthere__sub">
        어느 쪽으로 시작하셔도 같은 화면에서 계속 고치실 수 있습니다.
      </p>

      <button className="startopt startopt--ai" onClick={() => onPick('ai')}>
        <b>✨ AI로 빠르게 만들기</b>
        <span>사진과 촬영정보를 넣으면 상세페이지 초안을 만들어드립니다.</span>
      </button>

      <button className="startopt" onClick={() => onPick('product')}>
        <b>📋 직접 입력해서 만들기</b>
        <span>원하는 내용을 직접 입력하면서 상세페이지를 만들 수 있습니다.</span>
      </button>

      {hasCurrent && (
        <button className="startopt startopt--resume" onClick={() => onPick('product')}>
          <b>↩ 하던 작업 이어서 하기</b>
          <span>
            {project.title}
            {project.photos.length > 0 && ` · 사진 ${project.photos.length}장`}
          </span>
        </button>
      )}

      {works.length > 0 && (
        <>
          <p className="starthere__label">최근 보관한 작업</p>
          {works.map((w) => (
            <button key={w.id} className="startopt startopt--small" onClick={() => void resume(w)}>
              <b>{w.name}</b>
              <span>마지막 수정 {whenText(w.updatedAt)}</span>
            </button>
          ))}
          <button className="linkbtn starthere__more" onClick={() => onPick('works')}>
            보관한 작업 모두 보기
          </button>
        </>
      )}
    </div>
  );
}
