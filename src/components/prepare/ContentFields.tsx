import { useEffect, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { EMPTY_BRIEF, type ProductInfo } from '@/types/project';
import { EMPTY_PRICING, EMPTY_STUDIO, type ShootProduct, type StudioInfo } from '@/types/studio';
import { loadShootProducts, saveShootProducts } from '@/services/storage/studio';
import { setPrice } from '@/utils/photoOps';
import { isLinked, linkedValue, revealWhenFilled, setLinked } from './sectionText';
import { Field } from '@/components/editor/Fields';
import { StudioForm } from '@/components/studio/StudioForm';
import { ShootProducts } from '@/components/studio/ShootProducts';

/**
 * 상세페이지에 들어갈 글 — **늘 보이는 입력칸.**
 *
 * 주소에서 자료를 가져오면 여기가 채워지고, 없으면 여기에 직접 적는다.
 * '자동 입력' 과 '직접 입력' 을 나누지 않는다. 같은 칸이다.
 *
 * ① 자료 준비와 ③ 보면서 고치기의 [내용] 이 **같은 칸**을 쓴다.
 * (한쪽에서 고치면 다른 쪽에도 그대로 보인다)
 */
export function ContentFields({ mode }: { mode: 'prepare' | 'edit' }) {
  const { project, update } = useProject();
  const p = project.product;
  const [studioOpen, setStudioOpen] = useState(false);
  const [gptPrompt, setGptPrompt] = useState('');
  const [gptCopied, setGptCopied] = useState(false);

  const set = (key: keyof ProductInfo, label = key) => (v: string) =>
    update((d) => {
      if (isLinked(key)) setLinked(d, key, v);
      else d.product[key] = v;
    }, { label: 'product.' + label });

  /* 영역과 묶인 칸은 영역에 실제로 들어 있는 글을 보여준다 */
  const val = (key: keyof ProductInfo) => (isLinked(key) ? linkedValue(project, key) : p[key]);

  const setIncludes = (v: string) =>
    update((d) => {
      revealWhenFilled(d, ['price'], () => {
        d.pricing = { ...EMPTY_PRICING, ...(d.pricing ?? {}), includes: v };
      });
    }, { label: 'pricing.includes' });

  const setEmphasis = (v: string) =>
    update((d) => { d.shoot = { ...(d.shoot ?? EMPTY_BRIEF), emphasis: v }; }, { label: 'shoot.emphasis' });

  /** 예약·문의 링크 한 칸 — 다른 매장 정보는 그대로 둔다 */
  const setStudioKey = (k: 'talkUrl' | 'placeUrl' | 'videoUrl') => (v: string) =>
    update((d) => { d.studio = { ...EMPTY_STUDIO, ...(d.studio ?? {}), [k]: v.trim() }; }, { label: 'studio.' + k });

  const setStudio = (next: StudioInfo) =>
    update((d) => {
      d.studio = { ...EMPTY_STUDIO, ...next };
      /* 상호는 상세페이지 맨 위 작은 글씨(사진관명)에도 같이 쓴다 */
      d.product.brand = next.name;
    }, { label: 'studio.info' });

  return (
    <div className="stack fields">
      {mode === 'prepare' && <ProductKind />}

      <Field label="상품명" value={p.name} onChange={set('name')} placeholder="예) 광명 가족사진 촬영" />

      {mode === 'edit' && (
        <Field label="한 줄 소개" value={p.tagline} onChange={set('tagline')}
          placeholder="예) 우리 가족의 오늘을 오래도록 간직하세요" />
      )}

      <div className="row2">
        <Field
          label="정상가 (선택)" value={p.listPrice}
          onChange={(v) => update((d) => { revealWhenFilled(d, ['price'], () => setPrice(d, 'list', v)); }, { label: 'price.list' })}
          placeholder="예) 250000" hint="숫자만 적어주세요"
        />
        <Field
          label="판매가" value={p.salePrice}
          onChange={(v) => update((d) => { revealWhenFilled(d, ['price'], () => setPrice(d, 'sale', v)); }, { label: 'price.sale' })}
          placeholder="예) 189000"
        />
      </div>

      <Field
        label="상품 구성" value={project.pricing?.includes ?? ''} onChange={setIncludes} multiline rows={3}
        placeholder={'한 줄에 하나씩\n예) 원본 전체 제공\n보정본 2장\n11x14 액자'}
      />

      {mode === 'edit' && (
        <section className="box">
          <h3 className="box__title">GPT로 홍보 이미지 만들기</h3>
          <p className="box__hint">현재 입력된 가격·이벤트 정보로 프롬프트만 만들어드립니다. PageMaker가 이미지를 임의로 만들거나 갤러리에 넣지는 않습니다.</p>
          <div className="srcacts">
            <button className="btn btn--line" onClick={() => { setGptPrompt(pricePrompt(project)); setGptCopied(false); }}>
              GPT로 가격표 만들기
            </button>
            <button className="btn btn--line" onClick={() => { setGptPrompt(eventPrompt(project)); setGptCopied(false); }}>
              GPT로 이벤트 이미지 만들기
            </button>
          </div>
          {gptPrompt && (
            <div className="stack">
              <textarea className="field__input" rows={8} readOnly value={gptPrompt} aria-label="GPT 이미지 제작 프롬프트" />
              <div className="srcacts">
                <button className="btn btn--line" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(gptPrompt);
                    setGptCopied(true);
                  } catch {
                    setGptCopied(false);
                  }
                }}>{gptCopied ? '복사됨' : '프롬프트 복사'}</button>
                <button className="btn btn--main" onClick={() => window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer')}>
                  ChatGPT 열기
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      <Field
        label="상품 설명" value={val('description')} onChange={set('description')} multiline rows={3}
        placeholder="상품을 자세히 소개해주세요"
      />
      <Field
        label="주요 특징" value={val('benefits')} onChange={set('benefits')} multiline rows={3}
        placeholder={'한 줄에 하나씩\n예) 아이 속도에 맞춘 촬영\n오래 걸어둘 수 있는 액자'}
      />
      <Field
        label="추천 대상" value={val('target')} onChange={set('target')} multiline rows={2}
        placeholder="예) 가족의 소중한 순간을 남기고 싶은 분"
      />
      <Field
        label="이용 방법" value={val('howToUse')} onChange={set('howToUse')} multiline rows={2}
        placeholder="예) 예약 후 방문 · 촬영 40분 · 사진 고르기 20분"
      />
      <Field
        label="유의사항 (선택)" value={val('caution')} onChange={set('caution')} multiline rows={2}
        placeholder="예) 예약 변경은 촬영 2일 전까지"
      />
      <Field
        label="예약·구매 안내" value={p.contact} onChange={set('contact')}
        placeholder="예) 전화 02-000-0000 · 네이버 예약"
      />
      <Field
        label="네이버 톡톡 주소" value={project.studio?.talkUrl ?? ''} onChange={setStudioKey('talkUrl')}
        placeholder="예) https://talk.naver.com/..."
      />
      <Field
        label="네이버 지도 · 스마트플레이스 주소" value={project.studio?.placeUrl ?? ''} onChange={setStudioKey('placeUrl')}
        placeholder="예) https://naver.me/... 또는 https://map.naver.com/..."
      />
      <Field
        label="YouTube / Shorts 주소" value={project.studio?.videoUrl ?? ''} onChange={setStudioKey('videoUrl')}
        placeholder="예) https://youtu.be/... 또는 https://youtube.com/shorts/..."
      />
      <Field
        label="추가 강조내용" value={project.shoot?.emphasis ?? ''} onChange={setEmphasis}
        placeholder="예) 부모님 환갑 기념 · 주말 예약 가능"
      />

      <section className={'foldbox' + (studioOpen ? ' is-open' : '')}>
        <button className="foldbox__head" onClick={() => setStudioOpen((v) => !v)} aria-expanded={studioOpen}>
          <span>사진관·매장 정보 {project.studio?.name ? `· ${project.studio.name}` : '(선택)'}</span>
          <span className="foldbox__mark" aria-hidden>{studioOpen ? '접기' : '펼치기'}</span>
        </button>
        {studioOpen && (
          <div className="foldbox__body stack">
            <StudioForm value={{ ...EMPTY_STUDIO, ...(project.studio ?? {}) }} onChange={setStudio} />
          </div>
        )}
      </section>
    </div>
  );
}

function pricePrompt(project: ReturnType<typeof useProject>['project']): string {
  const s = project.studio;
  const pr = project.pricing;
  const name = project.product.name || project.shoot?.productName || '촬영상품';
  return [
    '사진관 상세페이지에 사용할 세련된 가격표 이미지를 만들어줘.',
    '이미지 안의 숫자와 상품명은 아래 내용을 정확히 사용하고 임의로 바꾸지 마.',
    `사진관: ${s?.name || '미입력'}`,
    `상품명: ${name}`,
    `정상가: ${project.product.listPrice || pr?.listPrice || '없음'}`,
    `판매가/이벤트가: ${project.product.salePrice || pr?.eventPrice || '없음'}`,
    `상품 구성:\n${pr?.includes || '미입력'}`,
    pr?.etcExtra ? `추가 안내:\n${pr.etcExtra}` : '',
    '과장 문구는 추가하지 말고, 사진관 분위기의 깔끔하고 읽기 쉬운 한국어 디자인으로 만들어줘.',
  ].filter(Boolean).join('\n');
}

function eventPrompt(project: ReturnType<typeof useProject>['project']): string {
  const s = project.studio;
  const ev = project.event;
  return [
    '사진관 상세페이지와 SNS에 사용할 이벤트 홍보 이미지를 만들어줘.',
    '아래 실제 정보만 사용하고 이벤트명·기간·가격을 임의로 만들거나 바꾸지 마.',
    `사진관: ${s?.name || '미입력'}`,
    `이벤트명: ${ev?.title || '미입력'}`,
    `기간: ${ev?.period || '미입력'}`,
    `정상가: ${ev?.listPrice || project.product.listPrice || '없음'}`,
    `이벤트가: ${ev?.eventPrice || project.product.salePrice || '없음'}`,
    `이벤트 내용:\n${ev?.body || '미입력'}`,
    '일반 공지처럼 보이지 않게 핵심 혜택이 한눈에 보이도록 하되, 없는 혜택은 추가하지 마.',
  ].filter(Boolean).join('\n');
}

/**
 * 어떤 상품인지 — 고르면 알맞은 구성으로 추천해 드린다.
 * 목록은 사장님이 자유롭게 넣고 뺄 수 있다.
 */
function ProductKind() {
  const { project, update } = useProject();
  const [list, setList] = useState<ShootProduct[]>([]);

  useEffect(() => { void loadShootProducts().then(setList); }, []);

  const pick = (name: string) =>
    update((d) => {
      d.shoot = { ...(d.shoot ?? EMPTY_BRIEF), productName: name };
      /*
       * 상품 종류만 정한다. 상품명·한 줄 소개는 채우지 않는다.
       * (예전에는 상품명에 '가족사진' 만 들어가서 자동 추천이 제목을 만들지 못했다)
       */
      if (!d.product.category.trim()) d.product.category = name;
      if (!d.title || d.title === '새 상세페이지') d.title = `${name} 상세페이지`;
    }, { label: 'shoot.product', merge: false });

  return (
    <div className="field">
      <span className="field__label">어떤 상품인가요?</span>
      <ShootProducts
        list={list}
        onChange={(next) => { setList(next); void saveShootProducts(next); }}
        picked={project.shoot?.productName ?? ''}
        onPick={pick}
      />
    </div>
  );
}
