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
