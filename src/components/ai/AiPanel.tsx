import { useEffect, useRef, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { readPhotoFiles } from '@/utils/image';
import {
  loadShootProducts, loadStudio, saveShootProducts, saveStudio,
} from '@/services/storage/studio';
import { EMPTY_STUDIO, type ShootProduct, type StudioInfo } from '@/types/studio';
import { EMPTY_BRIEF, type ProjectData } from '@/types/project';
import { studioDraft } from '@/types/defaults';
import { planStudioPage, type StudioPlan } from '@/services/ai/studioPlanner';
import { applyScoped, SCOPE_LABEL, type AiScope } from '@/services/ai/applyPlan';
import { Icon, type IconName } from '@/components/ui/Icon';
import { classifyPhotos } from '@/services/ai/classifyPhotos';
import { parseStudioText, type ReadField } from '@/services/read/parseInfo';
import { applyReadFields } from '@/services/read/applyFields';
import { ShootProducts } from '@/components/studio/ShootProducts';
import { ReadCheck } from '@/components/studio/ReadCheck';
import { StudioForm } from '@/components/studio/StudioForm';
import { RebuildAll } from './RebuildAll';
import { ImportUrl } from './ImportUrl';

/**
 * ⑤ AI 자동 작성.
 *
 * AI 는 **따로 결과물을 만드는 기능이 아니라** ①~④ 편집 항목을 자동으로 채워주는 기능이다.
 * 그래서 별도 화면으로 나가지 않고 이 패널 안에서 전부 끝난다.
 * 만드는 동안에도 왼쪽 미리보기는 그대로 보인다.
 */

/**
 * 만드는 동안 보여주는 단계.
 *
 * ⚠ 이것은 **실제로 프로그램이 하는 일**이다. 보여주기용 가짜 단계가 아니다.
 *   지금은 이 컴퓨터 안에서 규칙대로 계산하므로 순식간에 끝난다.
 *   나중에 진짜 AI 서버에 연결하면 이 자리에 실제 왕복 시간이 들어간다.
 */
const STEPS = [
  { key: 'read', label: '적어주신 정보 정리' },
  { key: 'plan', label: '구성과 문구 만들기' },
  { key: 'apply', label: '편집 항목에 넣기' },
];

/** 범위 카드에 쓰는 선 아이콘. 색은 쓰지 않는다 — 고른 것만 파란색이 된다 */
const SCOPE_ICON: Record<AiScope, IconName> = {
  fillEmpty: 'wand',
  copy: 'text',
  structure: 'grid',
  photos: 'image',
  design: 'palette',
  all: 'sparkle',
};

export function AiPanel() {
  const { project, update } = useProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const firstInputRef = useRef<HTMLTextAreaElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [products, setProducts] = useState<ShootProduct[]>([]);
  const [studio, setStudio] = useState<StudioInfo>(EMPTY_STUDIO);
  const [openStudio, setOpenStudio] = useState(false);
  const [openMore, setOpenMore] = useState(false);
  const [paste, setPaste] = useState('');
  const [getWay, setGetWay] = useState<'url' | 'paste'>('url');
  const [scope, setScope] = useState<AiScope>('fillEmpty');
  const [step, setStep] = useState(-1);
  const [plan, setPlan] = useState<StudioPlan | null>(null);
  const [fields, setFields] = useState<ReadField[]>([]);
  const [msg, setMsg] = useState('');
  const [failed, setFailed] = useState('');

  const brief = project.shoot ?? EMPTY_BRIEF;
  const photos = project.photos;

  useEffect(() => {
    void loadShootProducts().then(setProducts);
    void loadStudio().then(setStudio);
  }, []);

  const setBrief = (part: Partial<typeof brief>) =>
    update((d) => { d.shoot = { ...(d.shoot ?? EMPTY_BRIEF), ...part }; }, { label: 'shoot' });

  /* ---------------- STEP 1 사진 ---------------- */
  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    const added = await readPhotoFiles(files);
    if (!added.length) return;
    update((d) => { d.photos.push(...added); }, { label: 'photos.add', merge: false });

    const list = await classifyPhotos([...project.photos, ...added]);
    update((d) => {
      const userMain = d.photos.find((p) => p.kind === 'main');
      const pickedMain = userMain?.id ?? list.find((h) => h.suggested === 'main')?.id ?? d.photos[0]?.id;
      d.photos.forEach((p) => {
        const h = list.find((x) => x.id === p.id);
        if (p.id === pickedMain) { p.kind = 'main'; return; }
        if (p.kind === 'main') p.kind = 'product';
        if (h && p.kind === 'product') p.kind = h.suggested === 'main' ? 'product' : h.suggested;
      });
    }, { label: 'photos.classify', merge: false });
  };

  /**
   * ---------------- STEP 2 촬영상품 ----------------
   * 고른 촬영상품은 **바로 ① 촬영상품 정보로 들어간다.**
   * 이미 적어두신 값은 건드리지 않고 빈 칸만 채운다.
   */
  const pickProduct = (name: string) => {
    update((d) => {
      d.shoot = { ...(d.shoot ?? EMPTY_BRIEF), productName: name };
      const draft = studioDraft(name);
      (Object.keys(draft) as (keyof typeof draft)[]).forEach((k) => {
        const now = (d.product[k] ?? '').toString().trim();
        if (!now && draft[k]) d.product[k] = draft[k] as string;
      });
      if (!d.title || d.title === '새 상세페이지') d.title = `${name} 상세페이지`;
    }, { label: 'shoot.product', merge: false });
    setMsg(`① 촬영상품 정보에 '${name}' 을(를) 넣었습니다.`);
    window.setTimeout(() => setMsg(''), 3000);
  };

  const changeProducts = (next: ShootProduct[]) => {
    setProducts(next);
    void saveShootProducts(next);
  };

  const saveStudioInfo = (next: StudioInfo) => {
    setStudio(next);
    void saveStudio(next);
  };

  /* ---------------- STEP 6 만들기 ---------------- */
  const run = () => {
    const read = parseStudioText(paste);
    const filled = read.map((f) => {
      if (f.value) return f;
      const fromStudio = studioValue(studio, f.key);
      if (fromStudio) return { ...f, value: fromStudio, confident: true, from: '사진관 정보에 적어두신 값입니다' };
      if (f.key === 'productName' && brief.productName) {
        return { ...f, value: brief.productName, confident: true, from: '고르신 촬영상품입니다' };
      }
      return f;
    });
    setFields(filled);

    const trial: ProjectData = JSON.parse(JSON.stringify({ ...project, studio, shoot: { ...brief } }));
    applyReadFields(trial, filled);
    setPlan(planStudioPage(trial));
  };

  /** 확인한 값을 넣고 고른 범위만큼 만든다 */
  const applyAll = (confirmed: ReadField[], titleIndex: number, heroIndex: number) => {
    setPlan(null);
    runSteps(confirmed, titleIndex, heroIndex);
  };

  /**
   * 만들기 — 실패해도 지금 작업은 그대로 둔다.
   *
   * 전체를 **한 번의 실행취소**로 되돌릴 수 있도록 상태를 한 덩어리로만 바꾼다.
   * (중간에 여러 번 나눠 바꾸면 실행취소를 여러 번 눌러야 한다)
   */
  const runOnce = (confirmed: ReadField[], titleIndex: number, heroIndex: number): string => {
    try {
      update((d) => {
        const nextStudio = applyReadFields(d, confirmed);
        saveStudioInfo(nextStudio);
        const fresh = planStudioPage(d);
        applyScoped(d, fresh, scope, titleIndex, heroIndex);
        if (d.shoot?.productName) d.title = `${d.shoot.productName} 상세페이지`;
      }, { label: 'ai.build', merge: false });
      return '';
    } catch (e) {
      return e instanceof Error ? e.message : '알 수 없는 문제';
    }
  };

  const runSteps = (confirmed: ReadField[], titleIndex: number, heroIndex: number) => {
    setStep(0);
    setFailed('');

    window.setTimeout(() => {
      setStep(1);
      window.setTimeout(() => {
        const err = runOnce(confirmed, titleIndex, heroIndex);
        setStep(2);

        if (err) {
          setFailed('만들지 못했습니다. 지금 작업 내용은 그대로 있습니다. (' + err + ')');
          setStep(-1);
          return;
        }
        setMsg('다 만들었습니다. ①~⑦ 에서 바로 고치실 수 있어요. 실행취소(Ctrl+Z) 한 번이면 이전으로 돌아갑니다.');
        window.setTimeout(() => setStep(-1), 700);
        window.setTimeout(() => setMsg(''), 7000);
      }, 60);
    }, 60);
  };

  /* ---------------- 요약 ---------------- */
  const summary = [
    brief.productName ? `${brief.productName} 상세페이지` : '촬영상품을 고르면 더 정확해집니다',
    [
      photos.length ? `등록 사진 ${photos.length}장` : '사진 없음',
      paste.trim() ? '가격정보 있음' : '가격정보 없음',
      brief.wish.trim() ? `요청: ${brief.wish.trim().slice(0, 18)}` : '요청 없음',
    ].join(' · '),
    SCOPE_LABEL[scope].title,
  ];

  return (
    <div className="stack aipanel">
      {/* ---------------- STEP 3 ---------------- */}
      <section className="astep">
        <h3 className="astep__t"><b>STEP 1</b> 기존 정보 가져오기 <em>(선택)</em></h3>
        <div className="seg seg--wide">
          <button
            className={'seg__btn' + (getWay === 'url' ? ' is-on' : '')}
            onClick={() => setGetWay('url')}
          >
            {getWay === 'url' ? '✓ ' : ''}링크로 가져오기
          </button>
          <button
            className={'seg__btn' + (getWay === 'paste' ? ' is-on' : '')}
            onClick={() => setGetWay('paste')}
          >
            {getWay === 'paste' ? '✓ ' : ''}내용 붙여넣기
          </button>
        </div>

        {getWay === 'url' && (
          <>
            <p className="astep__h">
              네이버 블로그·스마트플레이스나 홈페이지 주소를 넣으면
              <b> 쓸 수 있는 정보를 찾아드립니다.</b> 다시 타이핑하지 않으셔도 됩니다.
            </p>
            <ImportUrl onPaste={(t) => { setPaste(t); }} />
          </>
        )}
      </section>

      {getWay === 'paste' && (
      <section className="astep">
        <h3 className="astep__t"><b>STEP 1-1</b> 가격·상품정보 붙여넣기</h3>
        <p className="astep__h">
          스마트플레이스·가격표·메모에 적어둔 내용을 <b>그대로 붙여넣으세요.</b>
          구분하지 못한 내용도 지우지 않고 그대로 남겨둡니다.
        </p>
        <textarea
          ref={firstInputRef}
          className="field__input"
          rows={5}
          value={paste}
          placeholder={'예)\n오늘사진관 / 경기도 광명시 오리로 000\n전화 02-000-0000\n10:00~19:00 매주 월요일 휴무\n\n가족사진 4인 기준\n정상가 250,000원 → 이벤트가 189,000원\n포함: 원본 전체, 보정본 2장, 11x14 액자\n추가 1인 20,000원 / 혜택: 헤어 손질 무료'}
          onChange={(e) => setPaste(e.target.value)}
        />
        <p className="field__hint">
          캡처 <b>사진</b> 속 글자를 읽는 기능은 아직 연결하지 않았습니다. 글로 붙여넣어 주세요.
        </p>
      </section>
      )}

      {/* ---------------- STEP 1 ---------------- */}
      <section className="astep">
        <h3 className="astep__t"><b>STEP 2</b> 사진 등록</h3>
        {/* 사진 넣기는 이 프로그램에서 가장 자주 하는 일이라 작게 두지 않는다 */}
        <div
          className={'drop' + (dragOver ? ' is-over' : '')}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(Array.from(e.dataTransfer.files)); }}
        >
          <Icon name="image" size={26} />
          <b>사진을 끌어오거나 눌러서 추가하세요</b>
          <span>JPG · PNG · 여러 장 한 번에</span>
          <i className="drop__btn">사진 추가</i>
        </div>
        <input
          ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = '';
            void addFiles(picked);
          }}
        />
        {photos.length > 0 && (
          <p className="field__hint">
            사진 {photos.length}장 · 대표사진·순서·사용 위치는 <b>직접입력 → 사진</b>에서 관리합니다.
          </p>
        )}
        {/* 긴 약속문은 접어둔다 — 읽고 싶은 분만 펼치도록 */}
        <details className="foldnote">
          <summary>사진은 원본 그대로 씁니다</summary>
          올려주신 사진 속 인물은 <b>원본 그대로</b> 씁니다. 얼굴·표정·머리·옷을 바꾸거나 새로 만들지 않습니다.
          크기와 위치만 맞춥니다. 사람이나 얼굴을 알아보는 기능은 넣지 않았습니다. 비율·밝기·색만 봅니다.
        </details>
      </section>

      {/* ---------------- STEP 2 ---------------- */}
      <section className="astep">
        <h3 className="astep__t"><b>STEP 3</b> 촬영상품 선택</h3>
        <ShootProducts
          list={products}
          onChange={changeProducts}
          picked={brief.productName}
          onPick={pickProduct}
        />
      </section>

      {/* ---------------- STEP 4 ---------------- */}
      <section className="astep">
        <h3 className="astep__t"><b>STEP 4</b> 원하는 분위기와 요청 <em>(선택)</em></h3>
        <input
          className="field__input"
          value={brief.wish}
          placeholder="예) 따뜻하고 고급스럽게 / 가격과 혜택이 잘 보이게"
          onChange={(e) => setBrief({ wish: e.target.value })}
        />
        <button className="more__btn" onClick={() => { setOpenMore((v) => !v); setOpenStudio(false); }}>
          {openMore ? '간단히 보기' : '자세히 적기'}
        </button>
        {openMore && (
          <div className="stack">
            <div className="row2">
              <label className="field">
                <span className="field__label">지역</span>
                <input className="field__input" value={brief.area} placeholder="예) 광명"
                  onChange={(e) => setBrief({ area: e.target.value })} />
              </label>
              <label className="field">
                <span className="field__label">원하는 분위기</span>
                <input className="field__input" value={brief.mood} placeholder="예) 따뜻한"
                  onChange={(e) => setBrief({ mood: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span className="field__label">강조할 내용</span>
              <input className="field__input" value={brief.emphasis} placeholder="예) 부모님 환갑 기념"
                onChange={(e) => setBrief({ emphasis: e.target.value })} />
            </label>

            <button className="more__btn" onClick={() => setOpenStudio((v) => !v)}>
              {openStudio ? '사진관 정보 닫기' : '사진관 정보 (한 번만 적으면 계속 다시 씁니다)'}
            </button>
            {openStudio && <StudioForm value={studio} onChange={saveStudioInfo} />}
          </div>
        )}
      </section>

      {/* ---------------- STEP 5 ---------------- */}
      <section className="astep">
        <h3 className="astep__t"><b>STEP 5</b> 어디까지 자동으로 채울까요?</h3>
        <div className="scopegrid">
          {(Object.keys(SCOPE_LABEL) as AiScope[]).map((k) => (
            <button
              key={k}
              type="button"
              className={'scopecard' + (scope === k ? ' is-on' : '')}
              onClick={() => setScope(k)}
              aria-pressed={scope === k}
              title={SCOPE_LABEL[k].desc}
            >
              <Icon name={SCOPE_ICON[k]} size={17} />
              <b>{SCOPE_LABEL[k].short}</b>
              <em>{SCOPE_LABEL[k].hint}</em>
              {k === 'fillEmpty' && <i className="scopecard__tag">추천</i>}
            </button>
          ))}
        </div>
      </section>

      {/* ---------------- STEP 6 ---------------- */}
      <section className="astep astep--make">
        <div className="aisum">
          {summary.map((line, i) => <span key={i}>{line}</span>)}
        </div>
        {scope === 'all' && (
          <p className="note note--warn">
            <b>전체 상세페이지 만들기</b>는 이미 고쳐두신 내용이 바뀔 수 있습니다.
            (실행취소로 되돌릴 수 있어요)
          </p>
        )}
        <button className="btn btn--make" onClick={run} disabled={step >= 0}>
          AI로 상세페이지 만들기
        </button>

        {step >= 0 && (
          <ol className="progress">
            {STEPS.map((s, i) => (
              <li key={s.key} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}>
                {i < step ? '✓ ' : i === step ? '› ' : ''}{s.label}
              </li>
            ))}
          </ol>
        )}
        {failed && <p className="note note--warn">{failed}</p>}
        {msg && <p className="note note--ok">{msg}</p>}

        <p className="field__hint">
          지금은 이 컴퓨터 안에서 <b>규칙대로</b> 만듭니다. 진짜 AI 서버에는 아직 연결되어 있지 않습니다.
          연결하면 문구가 훨씬 자연스러워집니다.
        </p>
      </section>

      <hr className="sep" />
      <RebuildAll />

      {plan && (
        <ReadCheck
          plan={plan}
          fields={fields}
          onCancel={() => setPlan(null)}
          onApply={applyAll}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function studioValue(s: StudioInfo, key: string): string {
  const map: Record<string, string> = {
    shopName: s.name, area: s.area, address: s.address, phone: s.phone,
    hours: s.hours, offDays: s.offDays, bookingUrl: s.bookingUrl,
  };
  return map[key] ?? '';
}
