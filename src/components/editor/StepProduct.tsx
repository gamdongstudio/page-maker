import { useEffect, useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import type { ProductInfo } from '@/types/project';
import { EMPTY_STUDIO, type StudioInfo } from '@/types/studio';
import { loadStudio, saveStudio } from '@/services/storage/studio';
import { Field } from './Fields';
import { TextToolbar } from '@/components/design/TextToolbar';
import { StudioForm } from '@/components/studio/StudioForm';
import { Icon } from '@/components/ui/Icon';

/**
 * ① 촬영상품 정보 — 사진관에서 쓰는 말로 적는다.
 *
 * 입력칸을 한 번에 다 펼치지 않는다. 네 묶음으로 접어두고 **기본정보만** 열어 둔다.
 * 자주 쓰는 것이 위, 가끔 쓰는 것은 접힌 안쪽에 둔다.
 *
 * ⚠ 저장하는 값과 방식은 **그대로**다. 자리만 옮겼다.
 *   (`product.*` 는 작업 내용에, 사진관 정보는 예전처럼 따로 보관한다)
 */

type BoxKey = 'basic' | 'price' | 'offer' | 'studio';

export function StepProduct() {
  const { project, update } = useProject();
  const p = project.product;

  /* 처음에는 기본정보만 열어 둔다 */
  const [open, setOpen] = useState<Record<BoxKey, boolean>>({
    basic: true, price: false, offer: false, studio: false,
  });
  const toggle = (k: BoxKey) => setOpen((v) => ({ ...v, [k]: !v[k] }));

  /* 사진관 정보는 작업마다 다시 적지 않도록 따로 보관한다 (기존 방식 그대로) */
  const [studio, setStudio] = useState<StudioInfo>(EMPTY_STUDIO);
  useEffect(() => { void loadStudio().then(setStudio); }, []);
  /**
   * 사진관 정보는 두 곳에 남긴다.
   *  1) 사진관 보관함 — 다음 작업에서도 다시 적지 않아도 되게
   *  2) 지금 작업 — 미리보기의 예약·문의, 스마트스토어 등록자료가 바로 이 값을 본다
   */
  const saveStudioInfo = (next: StudioInfo) => {
    setStudio(next);
    void saveStudio(next);
    update((d) => { d.studio = { ...next }; }, { label: 'studio.info' });
  };

  const set = (key: keyof ProductInfo) => (v: string) =>
    update((d) => { d.product[key] = v; }, { label: 'product.' + key });

  return (
    <div className="stack">
      {/* 글씨체·크기·정렬을 글 쓰는 자리에서 바로 고친다.
          ④ 디자인의 글꼴 기능과 **같은 값**을 쓴다 — 따로 만든 기능이 아니다 */}
      <TextToolbar target="title" />

      {/* 글을 AI 가 대신 다듬어 주는 기능은 **아직 연결되어 있지 않다.**
          되는 척하지 않는다 — 눌리지 않는 표시만 둔다. */}
      <div className="soonchip" aria-disabled="true">
        <Icon name="sparkle" size={15} />
        <b>부분 자동 다듬기</b>
        <em>준비 중 · AI 연결 후 사용 가능</em>
      </div>

      {/* ---------------- 기본정보 ---------------- */}
      <Box k="basic" title="기본정보" open={open.basic} onToggle={toggle}>
        <Field label="상품명" value={p.name} onChange={set('name')} placeholder="예) 광명 가족사진 촬영" />

        <div className="row2">
          <Field label="촬영 종류" value={p.category} onChange={set('category')} placeholder="예) 가족사진" />
          <Field label="사진관명" value={p.brand} onChange={set('brand')} placeholder="예) 오늘사진관" />
        </div>

        <Field
          label="한 줄 소개" value={p.tagline} onChange={set('tagline')}
          placeholder="예) 우리 가족의 오늘을 오래도록 간직하세요"
        />

        <div className="row2">
          <Field
            label="정상가 (선택)" value={p.listPrice} onChange={set('listPrice')}
            placeholder="비워두셔도 됩니다"
          />
          <Field
            label="판매가 · 이벤트가" value={p.salePrice} onChange={set('salePrice')}
            placeholder="189000" hint="숫자만 적어주세요"
          />
        </div>

        <Field
          label="예약·문의" value={p.contact} onChange={set('contact')}
          placeholder="예) 전화 02-000-0000 · 카카오톡 @사진관"
        />
      </Box>

      {/* ---------------- 가격·구성 ---------------- */}
      <Box k="price" title="가격·구성" open={open.price} onToggle={toggle}>
        <Field
          label="촬영 구성·제공 항목" value={p.benefits} onChange={set('benefits')} multiline rows={4}
          placeholder={'한 줄에 하나씩 적어주세요\n예) 원본 전체 제공\n보정본 2장\n11x14 액자'}
          hint="줄을 바꾸면 항목이 하나씩 나뉩니다"
        />
        <Field
          label="촬영 안내 (촬영시간·인원)" value={p.shipping} onChange={set('shipping')} multiline rows={2}
          placeholder="예) 촬영 40분 · 사진 고르기 20분 · 4인 기준"
        />
        <Field label="예약 링크" value={p.buyLink} onChange={set('buyLink')} placeholder="https://" />
      </Box>

      {/* ---------------- 제공항목 ---------------- */}
      <Box k="offer" title="제공항목" open={open.offer} onToggle={toggle}>
        <Field
          label="의상·헤어·메이크업" value={p.howToUse} onChange={set('howToUse')} multiline rows={2}
          placeholder="예) 의상 2벌 · 헤어와 메이크업 포함"
        />
        <Field
          label="추천 대상" value={p.target} onChange={set('target')}
          placeholder="예) 가족의 소중한 순간을 사진으로 남기고 싶은 분"
        />
        <Field
          label="상세 설명" value={p.description} onChange={set('description')} multiline rows={4}
          placeholder="촬영상품을 자세히 소개해주세요"
        />
        <Field
          label="유의사항" value={p.caution} onChange={set('caution')} multiline rows={2}
          placeholder="예) 예약 변경은 촬영 2일 전까지"
        />
        <Field label="기타 설명" value={p.etc} onChange={set('etc')} multiline rows={2} />
      </Box>

      {/* ---------------- 사진관 정보 ---------------- */}
      <Box k="studio" title="사진관 정보" open={open.studio} onToggle={toggle}>
        {/* 이미 있는 입력칸을 그대로 쓴다 (자동입력에서도 같은 것을 쓴다) */}
        <StudioForm value={studio} onChange={saveStudioInfo} />
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** 접었다 펴는 한 묶음 */
function Box({ k, title, open, onToggle, children }: {
  k: BoxKey;
  title: string;
  open: boolean;
  onToggle: (k: BoxKey) => void;
  children: React.ReactNode;
}) {
  return (
    <section className={'foldbox' + (open ? ' is-open' : '')}>
      <button
        className="foldbox__head"
        onClick={() => onToggle(k)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && <div className="foldbox__body stack">{children}</div>}
    </section>
  );
}
