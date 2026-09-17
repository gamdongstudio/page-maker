import { useMemo, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { saveWork } from '@/services/storage/works';
import { examples, projectFromExample } from '@/examples';
import { PageViewer } from '@/components/save/PageViewer';
import { isEmptyProject } from '@/components/flow/steps';

/**
 * 완성 예시 보기.
 *
 * 작은 썸네일이 아니라 **긴 상세페이지 전체**를 보여준다.
 * [이 구성으로 시작하기] 는 예시의 영역 구성과 디자인만 가져온다. 글·사진은 내 것으로 채운다.
 */
export function ExampleViewer({ onClose, onStarted }: { onClose: () => void; onStarted: () => void }) {
  const { project, replace } = useProject();
  const list = useMemo(() => examples(), []);
  const [key, setKey] = useState(list[0].key);
  const ex = list.find((e) => e.key === key) ?? list[0];

  const start = async () => {
    if (!isEmptyProject(project)) {
      if (!confirm('지금 작업은 [내 작업]에 보관하고, 이 구성으로 새 상세페이지를 시작할까요?')) return;
      await saveWork(project, project.title || '이름 없는 작업');
    }
    replace(projectFromExample(ex));
    onStarted();
  };

  return (
    <PageViewer
      project={ex.project}
      title="완성 예시"
      onClose={onClose}
      top={(
        <div className="extabs" role="tablist">
          {list.map((e) => (
            <button
              key={e.key}
              role="tab"
              aria-selected={e.key === key}
              className={'extab' + (e.key === key ? ' is-on' : '')}
              onClick={() => setKey(e.key)}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
      footer={(
        <>
          <span className="field__hint">가게 이름·연락처는 지어낸 예시이고, 사진 자리는 그림으로 대신했습니다.</span>
          <button className="btn btn--main" onClick={() => void start()}>이 구성으로 시작하기</button>
        </>
      )}
    />
  );
}
