import { forwardRef } from 'react';
import { SMARTSTORE_DETAIL_WIDTH } from '@/config/smartstore';
import { DetailPage } from '@/components/preview/DetailPage';
import { useProject } from '@/store/ProjectStore';

/**
 * 이미지로 뽑을 때 쓰는 자리.
 *
 * 화면에서는 보이지 않지만 실제 크기(860px)로 그려 둔다.
 * 미리보기를 줄여서 보고 있어도 결과물은 항상 선명하게 나온다.
 */
export const ExportStage = forwardRef<HTMLDivElement>(function ExportStage(_props, ref) {
  const { project } = useProject();
  return (
    <div className="exportstage" aria-hidden>
      <div ref={ref} style={{ width: SMARTSTORE_DETAIL_WIDTH }}>
        <DetailPage project={project} />
      </div>
    </div>
  );
});
