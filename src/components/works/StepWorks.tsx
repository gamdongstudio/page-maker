import { useEffect, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import {
  deleteWork, duplicateWork, listWorks, openWork, renameWork, saveWork, whenText,
  type WorkSummary,
} from '@/services/storage/works';
import { downloadProjectFile, readProjectFile } from '@/services/storage/local';
import { useEdition } from '@/store/EditionContext';

/**
 * 💾 내 작업
 *
 * 자동저장과는 다르다.
 *  - 자동저장: 지금 하던 것을 잃지 않게 계속 덮어쓴다
 *  - 내 작업: 이름을 붙여 남겨두고 나중에 다시 열어 **계속 고칠 수 있다**
 *
 * 사진관은 비슷한 상세페이지를 여러 번 만들기 때문에 '복제'가 특히 쓸모 있다.
 */
export function StepWorks() {
  const { project, replace } = useProject();
  const { isPro } = useEdition();
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = () => { void listWorks().then(setWorks); };
  useEffect(refresh, []);
  useEffect(() => { setName(project.title); }, [project.title]);

  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 3000); };

  const doSave = async () => {
    const title = name.trim() || '이름 없는 작업';
    const id = await saveWork(project, title);
    if (!id) { say('저장하지 못했습니다. 사진이 많으면 공간이 부족할 수 있어요.'); return; }
    refresh();
    say(`'${title}' 로 보관했습니다.`);
  };

  const doOpen = async (w: WorkSummary) => {
    const data = await openWork(w.id);
    if (!data) { say('작업을 열지 못했습니다.'); return; }
    replace(data);
    say(`'${w.name}' 을(를) 열었습니다. 계속 고치실 수 있어요.`);
  };

  const doDuplicate = async (w: WorkSummary) => {
    const id = await duplicateWork(w.id);
    if (!id) { say('복제하지 못했습니다.'); return; }
    refresh();
    say(`'${w.name} 복사본' 을 만들었습니다.`);
  };

  const doRename = async (w: WorkSummary) => {
    const next = prompt('새 이름을 적어주세요.', w.name);
    if (next === null) return;
    const title = next.trim();
    if (!title) return;
    await renameWork(w.id, title);
    refresh();
    say('이름을 바꿨습니다.');
  };

  const doDelete = async (w: WorkSummary) => {
    /* 실수로 지우지 않도록 반드시 한 번 물어본다 */
    if (!confirm(`'${w.name}' 을(를) 지울까요?\n지운 작업은 되돌릴 수 없습니다.`)) return;
    await deleteWork(w.id);
    refresh();
    say('지웠습니다.');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = await readProjectFile(f);
      replace(data);
      say('작업파일을 불러왔습니다.');
    } catch (e) {
      say(e instanceof Error ? e.message : '작업파일을 읽지 못했습니다.');
    }
  };

  return (
    <div className="stack">
      <p className="note">
        지금 하시는 작업은 <b>자동으로 저장</b>되고 있습니다.
        여기서는 이름을 붙여 <b>따로 보관</b>해두고 나중에 다시 열 수 있습니다.
      </p>

      <label className="field">
        <span className="field__label">작업 이름</span>
        <div className="works__saverow">
          <input
            className="field__input"
            value={name}
            placeholder="예) 가족사진 상세페이지"
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn--main" onClick={() => void doSave()}>작업 저장</button>
        </div>
      </label>

      <hr className="sep" />

      <span className="field__label">보관한 작업 {works.length > 0 && `(${works.length})`}</span>
      {works.length === 0 ? (
        <p className="menu__hint">아직 보관한 작업이 없습니다. 위에서 이름을 적고 저장해보세요.</p>
      ) : (
        <div className="works">
          {works.map((w) => (
            <div key={w.id} className={'workcard' + (openId === w.id ? ' is-open' : '')}>
              <div className="workcard__body">
                <b>{w.name}</b>
                <span>
                  마지막 수정 {whenText(w.updatedAt)}
                  {w.photoCount > 0 && ` · 사진 ${w.photoCount}장`}
                  {w.productName && ` · ${w.productName}`}
                </span>
              </div>
              <div className="workcard__acts">
                <button className="btn btn--line" onClick={() => void doOpen(w)}>열기</button>
                <button className="tiny" onClick={() => void doDuplicate(w)}>복제</button>
                <button className="tiny" onClick={() => void doRename(w)}>이름 변경</button>
                <button className="tiny tiny--danger" onClick={() => void doDelete(w)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {msg && <p className="note note--ok">{msg}</p>}

      {isPro && (
        <>
          <hr className="sep" />
          <span className="field__label">파일로 주고받기</span>
          <div className="works__saverow">
            <button className="btn btn--line" onClick={() => downloadProjectFile(project)}>
              작업파일 저장
            </button>
            <label className="btn btn--line works__open">
              작업파일 불러오기
              <input
                type="file" accept=".json,application/json" hidden
                onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </label>
          </div>
          <p className="field__hint">
            다른 컴퓨터로 옮기거나 따로 보관하실 때 쓰세요.
          </p>
        </>
      )}

      {openId && null}
      <button className="linkbtn" hidden onClick={() => setOpenId(null)} />
    </div>
  );
}
