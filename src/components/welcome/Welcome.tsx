import { STEPS } from '@/components/flow/steps';

/**
 * 처음 온 사람에게 보여주는 시작 화면.
 *
 * 편집 도구부터 보여주지 않는다. 사용법을 공부하게 하지 않는다.
 * 결과(완성 예시)를 먼저 볼지, 바로 만들지 두 가지만 고르게 한다.
 * 설치 이야기는 여기서 하지 않는다.
 */
export function Welcome({ onExamples, onStart }: { onExamples: () => void; onStart: () => void }) {
  return (
    <div className="welcome" role="dialog" aria-label="시작하기">
      <div className="welcome__card">
        <p className="welcome__brand">BARODU <b>PAGE MAKER</b></p>
        <h1 className="welcome__title">가지고 있는 글과 사진으로<br />상세페이지를 만들어보세요.</h1>
        <p className="welcome__text">
          자료를 불러오거나 직접 입력하면 BARODU가 기본 구성을 먼저 만들어드립니다.
        </p>

        <div className="welcome__acts">
          <button className="btn btn--line welcome__btn" onClick={onExamples}>완성 예시 보기</button>
          <button className="btn btn--main welcome__btn" onClick={onStart}>내 상세페이지 만들기</button>
        </div>

        <ol className="welcome__flow">
          {STEPS.map((s) => (
            <li key={s.key}>
              <span className="welcome__no">{s.no}</span>
              <b>{s.label}</b>
            </li>
          ))}
        </ol>
        <p className="welcome__foot">
          순서대로 따라가면 상세페이지가 완성됩니다.<br />
          상세페이지 제작은 웹에서 바로 시작할 수 있어요.
        </p>
      </div>
    </div>
  );
}
