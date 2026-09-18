import { Icon } from '@/components/ui/Icon';
import { HELP_VIDEO_URL } from '@/config/help';
import { stepInfo, type FlowStep } from './steps';

const STEPS4 = ['자료 가져오기', '자동으로 만들기', '미리보며 수정하기', '저장하기'];

/** 상단 [사용방법] — 화면 위 작은 팝업. 지금 단계의 도움말도 여기로 모았다 */
export function HowToUse({ step, onClose }: { step: FlowStep; onClose: () => void }) {
  const info = stepInfo(step);
  return (
    <>
      <div className="moremenu__mask" onClick={onClose} />
      <div className="howto" role="dialog" aria-label="사용방법">
        <p className="howto__title">처음 사용하시나요?</p>
        <ol className="howto__steps">
          {STEPS4.map((s, i) => <li key={s}><span className="howto__no">{i + 1}</span>{s}</li>)}
        </ol>
        {info.help.length > 0 && (
          <div className="howto__tips">
            <b>지금 단계 · {info.label}</b>
            <ul>{info.help.map((h, i) => <li key={i}>{h}</li>)}</ul>
          </div>
        )}
        {HELP_VIDEO_URL ? (
          <a className="howto__video" href={HELP_VIDEO_URL} target="_blank" rel="noreferrer">▶ 동영상으로 보기</a>
        ) : (
          <span className="howto__video is-off">▶ 동영상 안내는 준비 중입니다</span>
        )}
        <button className="howto__close" onClick={onClose} aria-label="닫기"><Icon name="close" size={16} /></button>
      </div>
    </>
  );
}
