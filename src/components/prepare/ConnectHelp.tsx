import { BARODU_TOOLS } from '@/config/baroduTools';
import { onPublicAddress, type ToolsStatus } from '@/services/import/baroduTools';

/**
 * 네이버 자료 가져오기 연결 안내.
 *
 * ⚠ 첫 화면에서 보여주지 않는다.
 *   사용자가 [글과 사진 가져오기] 를 실제로 눌렀는데 연결이 안 돼 있을 때만 이 자리에 나온다.
 *   연결이 안 돼도 내용 붙여넣기와 직접 입력은 그대로 쓸 수 있다고 함께 알린다.
 */
export function ConnectHelp({ status, onRecheck, onPaste, checking }: {
  status: ToolsStatus;
  onRecheck: () => void;
  onPaste: () => void;
  checking: boolean;
}) {
  const installed = status.state === 'stopped';

  return (
    <div className="connect">
      <b className="connect__title">네이버 글과 사진을 자동으로 가져오기 위해 처음 한 번 연결이 필요합니다.</b>

      {status.state === 'old-version' ? (
        <p>연결 프로그램(PM Connect)을 새 버전으로 올려주세요. 프로그램 아이콘 → 업데이트 확인을 누르면 됩니다.</p>
      ) : status.state === 'not-ready' ? (
        <p>연결 프로그램이 켜져 있지만 아직 준비가 덜 됐습니다. 프로그램을 다시 설치하면 해결됩니다.</p>
      ) : installed ? (
        <p>
          연결 프로그램(PM Connect)이 꺼져 있거나 브라우저가 연결을 막았습니다.
          시작 메뉴에서 <b>PM Connect</b>를 켠 뒤 <b>연결 확인</b>을 눌러주세요.
        </p>
      ) : (
        <>
          <p>
            연결 프로그램(<b>PM Connect</b>)을 한 번만 설치하면 됩니다.
            네이버 비밀번호는 저장하지 않습니다.
          </p>
          <ol className="connect__steps">
            <li>
              {BARODU_TOOLS.installerUrl ? (
                <a className="btn btn--line" href={BARODU_TOOLS.installerUrl} rel="noreferrer">연결 프로그램 받기</a>
              ) : (
                <>설치파일 <b>{BARODU_TOOLS.installerFileName}</b> 을 실행합니다.</>
              )}
            </li>
            <li>받은 파일을 실행합니다. Windows 보안 안내가 나오면 <b>추가 정보 → 실행</b>을 누르세요.</li>
            <li>설치가 끝나면 아래 <b>연결 확인</b>을 누르세요.</li>
          </ol>
        </>
      )}

      {onPublicAddress() && (
        <details className="lnahelp">
          <summary>브라우저가 연결을 물어보면</summary>
          <ol>
            <li>Chrome이 <b>로컬 네트워크 접근</b>을 허용할지 물으면 <b>허용</b>을 누릅니다.</li>
            <li>이미 차단했다면 주소창 왼쪽 아이콘 → <b>사이트 설정</b>에서 <b>로컬 네트워크 접근</b>을 <b>허용</b>으로 바꿉니다.</li>
            <li>이 페이지를 새로고침한 뒤 <b>연결 확인</b>을 누릅니다.</li>
          </ol>
        </details>
      )}

      <div className="connect__acts">
        <button className="btn btn--main" onClick={onRecheck} disabled={checking}>
          {checking ? '확인 중…' : '연결 확인'}
        </button>
        <button className="btn btn--line" onClick={onPaste}>내용 붙여넣기로 계속</button>
      </div>
      <p className="field__hint">연결하지 않아도 아래 칸에 직접 입력하거나 사진을 올려 계속 만들 수 있습니다.</p>
    </div>
  );
}
