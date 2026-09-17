import { useContext, useRef, useState } from 'react';
import { SMARTSTORE_DETAIL_WIDTH } from '@/config/smartstore';
import { FONT_LABEL, type MenuItem, type ProjectData } from '@/types/project';
import { heroBoxHeight, photoStyle, shapeOf } from '@/utils/image';
import { photosOf } from '@/utils/menuPhotos';
import { ownsPhotos } from './templates';
import {
  BenefitSection, ConceptSection, EventSection, FreeSection, GallerySection,
  PackagesSection, PerksSection, PrepareSection, PriceSection, ProcessSection, RecommendSection,
  type SectionProps,
} from './sections';
import { formatWon, pickReadable } from '@/utils/format';
import { ensureFonts } from '@/services/fonts/loadFont';
import { Editable } from './Editable';
import type { PreviewEdit } from './editApi';
import { EditingContext } from './editing';
import { hasContent } from './sectionContent';
import { cutMarkColor } from '@/services/export/exportImage';

/**
 * 실제 상세페이지 본체.
 *
 * 미리보기와 이미지 내보내기가 **같은 컴포넌트**를 쓴다.
 * (미리보기만 예쁘고 실제 결과가 다른 문제를 막기 위함)
 *
 * 편집용 표시(수정 자리·끌기 손잡이·+ 단추·테두리)는 `edit` 가 넘어올 때만 그린다.
 * 저장 이미지를 만들 때는 `edit` 를 넘기지 않으므로 **한 개도 들어가지 않는다.**
 */

interface Props {
  project: ProjectData;
  /** 모바일 폭으로 볼 때 true — 폭만 바뀌고 구조는 같다 */
  narrow?: boolean;
  /** 미리보기에서 직접 고칠 때 쓰는 고리 (저장 이미지에서는 넘기지 않는다) */
  edit?: PreviewEdit;
  /** 지금 고르고 있는 영역 (미리보기에서만 테두리로 보인다) */
  selectedId?: string | null;
}

export function DetailPage({ project, narrow = false, edit, selectedId }: Props) {
  const d = project.design;
  /* 고른 글꼴만 그때그때 받아온다 (다섯 개를 한꺼번에 받지 않는다) */
  ensureFonts([d.titleFont, d.bodyFont]);
  const width = narrow ? 390 : SMARTSTORE_DETAIL_WIDTH;
  const dragId = useRef<string | null>(null);

  const rootStyle: React.CSSProperties = {
    width,
    background: d.background,
    color: d.text,
    fontFamily: FONT_LABEL[d.bodyFont].stack,
    fontSize: d.bodySize,
    padding: `${d.padding}px ${narrow ? Math.min(d.padding, 20) : d.padding}px`,
    textAlign: d.align,
    lineHeight: 1.7,
    boxSizing: 'border-box',
  };

  /*
   * 저장 이미지(edit 없음)에서는 **내용이 없는 영역을 뺀다.**
   * 미리보기에서는 채울 수 있게 그대로 보여주고, 빠진다는 것을 작게 알린다.
   */
  const visible = project.menus.filter((m) => !m.hidden && (!!edit || hasContent(m, project)));
  const sidePad = narrow ? Math.min(d.padding, 20) : d.padding;
  const contentWidth = width - sidePad * 2;

  return (
    <EditingContext.Provider value={!!edit}>
    <div className={'detail' + (edit ? ' detail--edit' : '')} style={rootStyle} data-detail-root>
      {edit && visible.length > 0 && <AddHere onAdd={() => edit.onAddAt(0)} />}

      {visible.map((menu, i) => (
        <div key={menu.id}>
          <div
            className={'detail__menu' + (edit && selectedId === menu.id ? ' is-selected' : '')}
            style={{ marginBottom: i === visible.length - 1 || !edit ? 0 : d.menuGap }}
            onClick={edit ? () => edit.onJump('menus', menu.id) : undefined}
            data-menu-id={menu.id}
            draggable={!!edit}
            onDragStart={edit ? () => { dragId.current = menu.id; } : undefined}
            onDragOver={edit ? (e) => e.preventDefault() : undefined}
            onDrop={edit ? (e) => {
              e.preventDefault();
              if (dragId.current) edit.onReorder(dragId.current, menu.id);
              dragId.current = null;
            } : undefined}
          >
            {/* 마우스를 올렸을 때만 보이는 작은 도구. 저장 이미지에는 들어가지 않는다 */}
            {edit && (
              <SectionBar
                menu={menu}
                first={i === 0}
                last={i === visible.length - 1}
                edit={edit}
              />
            )}
            {edit && !hasContent(menu, project) && (
              <span className="emptytag">비어 있어 저장할 때는 빠집니다</span>
            )}
            <MenuBody
              menu={menu} project={project} narrow={narrow}
              boxWidth={contentWidth} edit={edit}
            />
            {!ownsPhotos(menu.kind, menu.template) && (
              <PhotoBlock menu={menu} project={project} boxWidth={contentWidth} edit={edit} />
            )}
          </div>
          {/* 영역 구분선 — 스타일에 따라 (미리보기와 저장 이미지 모두) */}
          {d.divider === 'line' && i < visible.length - 1 && (
            <div aria-hidden style={{
              width: 44, height: 1, margin: edit ? `-${Math.round(d.menuGap / 2)}px auto ${Math.round(d.menuGap / 2) - 1}px` : '0 auto -1px',
              background: d.text, opacity: 0.22,
              position: 'relative', top: edit ? 0 : Math.floor(d.menuGap / 2) - 14,
            }} />
          )}
          {edit && <AddHere onAdd={() => edit.onAddAt(i + 1)} />}
          {/* 저장 이미지에서만 — 영역 사이 가운데에 눈에 안 보이는 경계선을 둔다.
              그림을 자를 때 이 선을 찾아 **영역 단위로** 자르고, 저장 직전에 배경색으로 덮는다. */}
          {!edit && i < visible.length - 1 && (
            <div style={{ height: d.menuGap, position: 'relative' }} aria-hidden>
              <i style={{
                position: 'absolute', left: 0, right: 0, top: Math.floor(d.menuGap / 2),
                height: 1, background: cutMarkColor(d.background),
              }} />
            </div>
          )}
        </div>
      ))}

      {visible.length === 0 && edit && (
        <p style={{ color: '#9aa0a6', padding: '60px 0' }}>
          오른쪽에서 영역을 추가하면 여기에 상세페이지가 만들어집니다.
        </p>
      )}
    </div>
    </EditingContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* 편집용 표시 — `edit` 가 있을 때만 그린다                              */
/* ------------------------------------------------------------------ */

/** 섹션에 마우스를 올렸을 때 나오는 작은 도구 */
function SectionBar({ menu, first, last, edit }: {
  menu: MenuItem; first: boolean; last: boolean; edit: PreviewEdit;
}) {
  const act = (e: React.MouseEvent, run: () => void) => { e.stopPropagation(); run(); };
  return (
    <div className="secbar" onClick={(e) => e.stopPropagation()}>
      <span className="secbar__grip" title="끌어서 순서를 바꿀 수 있어요">⠿</span>
      <span className="secbar__name">{menu.title}</span>
      <button className="secbar__btn" disabled={first} title="위로"
        onClick={(e) => act(e, () => edit.onSection('up', menu.id))}>↑</button>
      <button className="secbar__btn" disabled={last} title="아래로"
        onClick={(e) => act(e, () => edit.onSection('down', menu.id))}>↓</button>
      <button className="secbar__btn" title="복제"
        onClick={(e) => act(e, () => edit.onSection('dup', menu.id))}>복제</button>
      <button className="secbar__btn" title="숨기기"
        onClick={(e) => act(e, () => edit.onSection('hide', menu.id))}>숨기기</button>
      <button className="secbar__btn secbar__btn--danger" title="삭제"
        onClick={(e) => act(e, () => edit.onSection('del', menu.id))}>삭제</button>
    </div>
  );
}

/** 섹션과 섹션 사이 — 마우스를 올리면 나오는 + 자리 */
function AddHere({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="addhere">
      <button
        className="addhere__btn"
        onClick={(e) => { e.stopPropagation(); onAdd(); }}
        title="여기에 새 메뉴 넣기"
      >+ 여기에 넣기</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MenuBody({ menu, project, narrow, boxWidth, edit }: {
  menu: MenuItem; project: ProjectData; narrow: boolean; boxWidth: number; edit?: PreviewEdit;
}) {
  const d = project.design;
  const p = project.product;

  /* 이 섹션만 다른 글꼴을 골랐다면 그것을 쓴다 (없으면 전체 기본 글꼴) */
  const titleFont = menu.font ?? d.titleFont;
  ensureFonts([titleFont]);

  const titleStyle: React.CSSProperties = {
    fontFamily: FONT_LABEL[titleFont].stack,
    fontSize: narrow ? Math.round(d.titleSize * 0.82) : d.titleSize,
    color: d.accent,
    margin: '0 0 14px',
    lineHeight: 1.32,
    fontWeight: d.titleBold === false ? 400 : 700,
    wordBreak: 'keep-all',
  };

  const bodyStyle: React.CSSProperties = {
    /* 'margin' 한 줄로 쓰면 아래에서 marginTop 만 덧붙일 때 React 가 경고한다.
       (줄임말과 낱개 값을 섞지 말 것) */
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'keep-all',
    color: d.text,
    fontWeight: d.bodyBold ? 700 : undefined,
    fontFamily: menu.font ? FONT_LABEL[menu.font].stack : undefined,
  };

  /** 섹션 제목 — 눌러서 바로 고친다 */
  const Title = () => (
    <Editable
      as="h2"
      on={!!edit}
      value={menu.title}
      placeholder="섹션 제목"
      style={titleStyle}
      onSave={(v) => edit?.onMenuText(menu.id, 'title', v)}
    />
  );

  /* 섹션마다 여러 모양(템플릿)이 있다. 모양이 달라도 읽는 내용은 같다. */
  const sp: SectionProps = { menu, project, narrow, titleStyle, bodyStyle, boxWidth, edit };

  switch (menu.kind) {
    case 'main':
      return (
        <div>
          {(p.brand || edit) && (
            <Editable
              as="p"
              on={!!edit}
              value={p.brand}
              placeholder="사진관명"
              style={{ margin: '0 0 10px', color: d.primary, fontSize: d.bodySize - 2, letterSpacing: 1 }}
              onSave={(v) => edit?.onProduct('brand', v)}
            />
          )}
          <Editable
            as="h1"
            on={!!edit}
            value={p.name || (edit ? '' : menu.title)}
            placeholder="상품명을 넣어주세요"
            style={{ ...titleStyle, fontSize: narrow ? Math.round(d.titleSize * 0.95) : d.titleSize + 6 }}
            onSave={(v) => edit?.onProduct('name', v)}
          />
          {(p.tagline || edit) && (
            <Editable
              as="p"
              on={!!edit}
              value={p.tagline}
              placeholder="한 줄 소개"
              style={{ ...bodyStyle, fontSize: d.bodySize + 2, opacity: 0.85 }}
              onSave={(v) => edit?.onProduct('tagline', v)}
            />
          )}
          <PriceRow project={project} edit={edit} />
        </div>
      );

    case 'price':
      return (menu.template ?? 'A') === 'E'
        ? <PackagesSection {...sp} />
        : <PriceSection {...sp} />;

    case 'compare':
      return <PackagesSection {...sp} />;

    case 'event':
      return <EventSection {...sp} />;

    case 'benefit':
      return <BenefitSection {...sp} />;

    case 'recommend':
      return <RecommendSection {...sp} />;

    case 'gallery':
      return <GallerySection {...sp} />;

    case 'free':
      return edit ? (
        <div>
          <Title />
          <Editable
            as="p" on multiline
            value={menu.body}
            placeholder="여기에 원하시는 내용을 적어주세요"
            style={bodyStyle}
            onSave={(v) => edit.onMenuText(menu.id, 'body', v)}
          />
          <div style={{ marginTop: 16 }}>
            <Editable
              on
              value={menu.button ?? ''}
              placeholder="버튼 문구 (비워두면 버튼이 안 나옵니다)"
              style={{
                display: 'inline-block',
                background: menu.button ? d.primary : 'transparent',
                color: menu.button ? pickReadable(d.primary) : '#9aa0a6',
                border: menu.button ? 'none' : '1px dashed #c9ced6',
                padding: '13px 28px', fontWeight: 700, fontSize: d.bodySize,
                borderRadius: d.buttonStyle === 'pill' ? 999 : d.buttonStyle === 'round' ? 10 : 0,
              }}
              onSave={(v) => edit.onMenuText(menu.id, 'button', v)}
            />
          </div>
        </div>
      ) : <FreeSection {...sp} />;

    /* ---------------- 사진관 전용 ---------------- */

    case 'perks':
      return <PerksSection {...sp} />;

    case 'shootConcept':
      return <ConceptSection {...sp} />;

    case 'process':
      return <ProcessSection {...sp} />;

    case 'prepare':
      return <PrepareSection {...sp} />;

    case 'cta':
      return (
        <div>
          <Title />
          {(menu.body || edit) && (
            <Editable
              as="p" on={!!edit} multiline
              value={menu.body}
              placeholder="예약·문의 안내 문구"
              style={{ ...bodyStyle, marginBottom: 18 }}
              onSave={(v) => edit?.onMenuText(menu.id, 'body', v)}
            />
          )}
          {/* 사진관의 마지막 행동은 구매가 아니라 예약·문의다 (최대 3개) */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: d.align === 'center' ? 'center' : d.align === 'right' ? 'flex-end' : 'flex-start' }}>
            {ctaButtons(project).map((b, i) => (
              <span
                key={b.label}
                className={edit ? 'ctabtn' : undefined}
                onClick={edit ? (e) => { e.stopPropagation(); edit.onJump('product'); } : undefined}
                title={edit ? '눌러서 전화·예약 정보를 고칩니다' : undefined}
                style={{
                  display: 'inline-block',
                  background: i === 0 ? d.primary : 'transparent',
                  color: i === 0 ? pickReadable(d.primary) : d.primary,
                  border: i === 0 ? 'none' : `1.5px solid ${d.primary}`,
                  padding: '15px 30px',
                  borderRadius: d.buttonStyle === 'pill' ? 999 : d.buttonStyle === 'round' ? 10 : 0,
                  fontWeight: 700,
                  fontSize: d.bodySize + 1,
                }}
              >
                {b.label}
              </span>
            ))}
          </div>
          {p.contact && !menu.body.includes(p.contact.split(' ')[0]) && (
            <p style={{ ...bodyStyle, marginTop: 14, fontSize: d.bodySize - 2, opacity: 0.8 }}>{p.contact}</p>
          )}
        </div>
      );

    case 'intro':
      return (
        <div>
          <Title />
          {edit ? (
            <Editable
              as="p" on multiline
              value={menu.body || p.description}
              placeholder="상세 설명을 입력하면 여기에 보입니다."
              style={bodyStyle}
              onSave={(v) => edit.onMenuText(menu.id, 'body', v)}
            />
          ) : (
            <p style={bodyStyle}>
              {menu.body || p.description || <Placeholder text="상세 설명을 입력하면 여기에 보입니다." inline />}
            </p>
          )}
        </div>
      );

    case 'shipping':
      return <SimpleSection menu={menu} fallback={p.shipping} titleStyle={titleStyle} bodyStyle={bodyStyle} edit={edit} />;
    case 'howto':
      return <SimpleSection menu={menu} fallback={p.howToUse} titleStyle={titleStyle} bodyStyle={bodyStyle} edit={edit} />;
    case 'caution':
      return <SimpleSection menu={menu} fallback={p.caution} titleStyle={titleStyle} bodyStyle={bodyStyle} edit={edit} />;
    default:
      return <SimpleSection menu={menu} fallback="" titleStyle={titleStyle} bodyStyle={bodyStyle} edit={edit} />;
  }
}

/* ------------------------------------------------------------------ */

/**
 * 메뉴에 딸린 사진.
 * 메뉴에 직접 지정한 사진이 없으면, 메뉴 성격에 맞는 사진을 알아서 보여준다.
 */
function PhotoBlock({ menu, project, boxWidth, edit }: {
  menu: MenuItem; project: ProjectData; boxWidth: number; edit?: PreviewEdit;
}) {
  const d = project.design;
  const list = photosOf(menu, project);
  const fileRef = useRef<HTMLInputElement>(null);
  /** 어떤 사진을 바꾸는 중인지 — 비어 있으면 새로 넣는 것 */
  const [target, setTarget] = useState<string | null>(null);

  /* 사진이 하나도 없을 때 — 편집 중에만 '여기에 사진 넣기' 칸을 보여준다 */
  if (list.length === 0) {
    if (!edit) return null;
    return (
      <>
        <button
          className="photoslot"
          onClick={(e) => { e.stopPropagation(); setTarget(null); fileRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault(); e.stopPropagation();
            edit.onPhotoFiles(menu.id, null, Array.from(e.dataTransfer.files));
          }}
        >
          여기에 사진 넣기 · 끌어다 놓아도 됩니다
        </button>
        <PhotoInput inputRef={fileRef} onPick={(files) => edit.onPhotoFiles(menu.id, target, files)} />
      </>
    );
  }

  /* 맨 위 대문 사진인지 */
  const isHero = menu.kind === 'main' && list.length === 1;

  /* 사진 비율을 보고 나란히 둘지 한 장씩 둘지 정한다 */
  const allPortrait = list.length === 2 && list.every((p) => shapeOf(p) === 'portrait');
  const gallery = list.length >= 3;
  const columns = allPortrait ? 2 : gallery ? 2 : 1;
  const gap = 10;
  const cellWidth = columns === 1 ? boxWidth : Math.floor((boxWidth - gap) / 2);

  return (
    <div
      style={{
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
      }}
    >
      {list.map((p) => {
        /* 대문(메인)에서는 사용자가 고른 모양이 있으면 그 모양으로 보여준다 */
        const heroH = isHero ? heroBoxHeight(d.heroShape, cellWidth) : null;
        const style: React.CSSProperties = heroH
          ? {
              width: '100%',
              display: 'block',
              height: heroH,
              objectFit: 'cover',
              objectPosition: p.focusX + '% ' + p.focusY + '%',
            }
          : photoStyle(p, cellWidth);
        return (
        <figure
          key={p.id}
          className={edit ? 'pcell' : undefined}
          style={{ margin: 0 }}
          onDragOver={edit ? (e) => { e.preventDefault(); e.stopPropagation(); } : undefined}
          onDrop={edit ? (e) => {
            e.preventDefault(); e.stopPropagation();
            edit.onPhotoFiles(menu.id, p.id, Array.from(e.dataTransfer.files));
          } : undefined}
        >
          <img
            src={p.dataUrl}
            alt={p.caption || p.name}
            style={{ ...style, borderRadius: d.photoRadius, background: '#f1f3f6' }}
          />
          {edit && (
            <span className="pcell__acts" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setTarget(p.id); fileRef.current?.click(); }}>교체</button>
              {p.kind !== 'main' && (
                <button onClick={() => edit.onPhoto('main', menu.id, p.id)}>대표</button>
              )}
              <button onClick={() => edit.onJump('media')}>관리</button>
              <button className="is-danger" onClick={() => edit.onPhoto('remove', menu.id, p.id)}>삭제</button>
            </span>
          )}
          {p.caption && (
            <figcaption style={{ marginTop: 6, fontSize: d.bodySize - 3, opacity: 0.7 }}>{p.caption}</figcaption>
          )}
        </figure>
        );
      })}
      {edit && (
        <PhotoInput inputRef={fileRef} onPick={(files) => edit.onPhotoFiles(menu.id, target, files)} />
      )}
    </div>
  );
}

/** 사진 고르기 창 — 화면에는 보이지 않는다 */
function PhotoInput({ inputRef, onPick }: {
  inputRef: React.RefObject<HTMLInputElement>;
  onPick: (files: File[]) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        /* value 를 먼저 비우면 파일 목록이 사라지므로 반드시 먼저 복사한다 */
        const picked = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (picked.length) onPick(picked);
      }}
    />
  );
}

function SimpleSection({ menu, fallback, titleStyle, bodyStyle, edit }: {
  menu: MenuItem; fallback: string;
  titleStyle: React.CSSProperties; bodyStyle: React.CSSProperties;
  edit?: PreviewEdit;
}) {
  const text = menu.body || fallback;
  return (
    <div>
      <Editable
        as="h2" on={!!edit} value={menu.title} placeholder="섹션 제목"
        style={titleStyle}
        onSave={(v) => edit?.onMenuText(menu.id, 'title', v)}
      />
      {edit ? (
        <Editable
          as="p" on multiline value={text} placeholder="내용을 입력하면 여기에 보입니다."
          style={bodyStyle}
          onSave={(v) => edit.onMenuText(menu.id, 'body', v)}
        />
      ) : (
        text ? <p style={bodyStyle}>{text}</p> : <Placeholder text="내용을 입력하면 여기에 보입니다." />
      )}
    </div>
  );
}

/** 예약·문의 버튼 — 있는 정보로만 만든다 (최대 3개) */
function ctaButtons(p: ProjectData): { label: string }[] {
  const s = p.studio;
  const out: { label: string }[] = [];
  if (s?.bookingUrl || p.product.buyLink) out.push({ label: '네이버 예약' });
  if (s?.phone) out.push({ label: `전화 ${s.phone}` });
  if (s?.sns) out.push({ label: '카카오톡 문의' });
  return out.length ? out.slice(0, 3) : [{ label: '예약·문의하기' }];
}

function PriceRow({ project, big = false, edit }: {
  project: ProjectData; big?: boolean; edit?: PreviewEdit;
}) {
  const d = project.design;
  const { listPrice, salePrice } = project.product;
  if (!listPrice && !salePrice && !edit) return null;

  const list = formatWon(listPrice);
  const sale = formatWon(salePrice);
  /* 정상가가 없거나 판매가와 같으면 취소선·할인율을 보여주지 않는다 */
  const hasDiscount = !!(list && sale && Number(listPrice) > Number(salePrice));
  const percent = hasDiscount
    ? Math.round((1 - Number(salePrice) / Number(listPrice)) * 100)
    : 0;

  return (
    <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'baseline', justifyContent: d.align === 'center' ? 'center' : d.align === 'right' ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
      {hasDiscount && (
        <span style={{ color: d.primary, fontWeight: 800, fontSize: big ? 30 : 22 }}>{percent}%</span>
      )}
      {list && hasDiscount && (
        <span style={{ textDecoration: 'line-through', opacity: 0.45, fontSize: big ? 18 : 15 }}>{list}</span>
      )}
      {edit ? (
        <Editable
          on numeric
          value={salePrice || listPrice}
          display={sale || list}
          placeholder="가격"
          title="눌러서 가격을 고칠 수 있어요 (숫자만)"
          style={{ fontWeight: 800, fontSize: big ? 32 : 24 }}
          onSave={(v) => edit.onProduct(salePrice || !listPrice ? 'salePrice' : 'listPrice', v)}
        />
      ) : (
        <span style={{ fontWeight: 800, fontSize: big ? 32 : 24 }}>{sale || list}</span>
      )}
    </div>
  );
}

function Placeholder({ text, inline = false }: { text: string; inline?: boolean }) {
  const editing = useContext(EditingContext);
  if (!editing) return null;
  const style: React.CSSProperties = {
    color: '#a8adb5',
    fontSize: 14,
    border: '1px dashed #d6dae0',
    borderRadius: 8,
    padding: '14px 16px',
    display: inline ? 'inline-block' : 'block',
  };
  return <span style={style}>{text}</span>;
}
