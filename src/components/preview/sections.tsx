import { useContext } from 'react';
import type { MenuItem, Photo, ProjectData } from '@/types/project';
import { photoStyle } from '@/utils/image';
import { photosOf } from '@/utils/menuPhotos';
import { fieldProducts, splitPriceLine } from '@/services/ai/studioPlanner';
import { formatWon, pickReadable, shade } from '@/utils/format';
import { Editable } from './Editable';
import type { PreviewEdit } from './editApi';
import { EditingContext } from './editing';

/**
 * 사진관 섹션들의 여러 가지 모양(템플릿).
 *
 * 규칙
 *  - 모양만 다르고 **읽는 데이터는 모두 같다.** 모양을 바꿔도 내용이 사라지지 않는다.
 *  - 색만 다른 것이 아니라 배치 자체가 다르다.
 *  - 사진은 올린 것을 고르고 놓기만 한다. 얼굴을 손대는 일은 없다.
 */

export interface SectionProps {
  menu: MenuItem;
  project: ProjectData;
  narrow: boolean;
  titleStyle: React.CSSProperties;
  bodyStyle: React.CSSProperties;
  boxWidth: number;
  /** 미리보기에서 바로 고칠 때만 넘어온다 (저장 이미지에서는 없다) */
  edit?: PreviewEdit;
}

/* ------------------------------------------------------------------ */
/* 공통 부품                                                            */
/* ------------------------------------------------------------------ */

function Img({ photo, width, radius }: { photo: Photo; width: number; radius: number }) {
  return (
    <img
      src={photo.dataUrl}
      alt={photo.caption || photo.name}
      style={{ ...photoStyle(photo, width), borderRadius: radius, background: '#f1f3f6' }}
    />
  );
}

/**
 * 갤러리 칸 — **같은 모양 안에서는 모든 칸이 같은 크기.**
 *
 * 사진마다 원본 비율이 달라 카드 높이가 들쭉날쭉해 보이던 것을 막는다.
 * 늘려서 찌그러뜨리지 않고(cover), 사진마다 정해 둔 중심을 기준으로 가운데만 남긴다.
 */
function GalleryCell({ photo, height, radius }: { photo: Photo; height: number; radius: number }) {
  return (
    <img
      src={photo.dataUrl}
      alt={photo.caption || photo.name}
      style={{
        width: '100%',
        height,
        display: 'block',
        objectFit: 'cover',
        objectPosition: `${photo.focusX}% ${photo.focusY}%`,
        borderRadius: radius,
        background: '#f1f3f6',
      }}
    />
  );
}

/**
 * 모양에 자리가 없어 못 보여준 사진을 아래에 이어서 보여준다.
 *
 * 스타일(영역 모양)을 바꾸면 사진 자리 수가 달라진다. 자리가 모자라 사진이 화면에서
 * 빠지면 "사진이 사라졌다" 고 느끼므로, 남는 사진은 버리지 않고 두 장씩 나란히 놓는다.
 */
function MorePhotos({ photos, from, boxWidth, radius }: { photos: Photo[]; from: number; boxWidth: number; radius: number }) {
  const rest = photos.slice(from);
  if (rest.length === 0) return null;
  const cell = Math.floor((boxWidth - 10) / 2);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: rest.length === 1 ? '1fr' : '1fr 1fr', gap: 10, marginTop: 12 }}>
      {rest.map((p) => <Img key={p.id} photo={p} width={rest.length === 1 ? boxWidth : cell} radius={radius} />)}
    </div>
  );
}

/** 비어 있는 칸 안내 — 고치는 중일 때만 보인다. 저장 이미지에는 들어가지 않는다 */
function Empty({ text }: { text: string }) {
  const editing = useContext(EditingContext);
  if (!editing) return null;
  return (
    <span style={{
      color: '#a8adb5', fontSize: 14, border: '1px dashed #d6dae0',
      borderRadius: 8, padding: '14px 16px', display: 'block',
    }}>{text}</span>
  );
}

/** '제목 | 설명' 형태의 줄을 나눈다 */
function splitLines(lines: string[]): { title: string; body: string }[] {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [head, ...rest] = l.split('|');
      return { title: head.trim(), body: rest.join('|').trim() };
    });
}

/* ------------------------------------------------------------------ */
/* 이벤트                                                              */
/* ------------------------------------------------------------------ */

/**
 * 이벤트 글 요약 — 설명 1~2문장 + 핵심 항목(•·-·A. 로 시작하는 줄) 최대 4개.
 * 없는 혜택을 만들지 않는다. 원문에 있는 줄을 골라 담기만 한다.
 */
export function eventSummary(raw: string): string {
  const lines = (raw || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 4) return lines.join('\n');
  const isItem = (l: string) => /^([•·\-✓✔▶※]|[A-Z가-힣0-9][.)]\s)/.test(l);
  const intro = lines.filter((l) => !isItem(l) && !/^[📍☎]/u.test(l)).slice(0, 2);
  const items = [...new Set(lines.filter((l) => /^[A-Z0-9][.)]\s/.test(l)))];
  const bullets = items.length ? items : [...new Set(lines.filter((l) => /^[•·\-✓✔▶]/.test(l)))];
  return [...intro, ...bullets.slice(0, 4)].join('\n');
}

export function EventSection({ menu, project, titleStyle, bodyStyle, boxWidth }: SectionProps) {
  const d = project.design;
  const ev = project.event;
  const tpl = menu.template ?? 'A';
  const list = formatWon(ev?.listPrice ?? '');
  const sale = formatWon(ev?.eventPrice ?? '');
  const percent = discountPercent(ev?.listPrice, ev?.eventPrice);
  const name = ev?.title || menu.title;
  /* 가져온 원문은 그대로 두고, 상세페이지에는 핵심만 짧게 보여준다 */
  const body = eventSummary(ev?.body || menu.body);
  const photos = photosOf(menu, project);

  if (tpl === 'C') {
    /* 기간 강조 배너 */
    return (
      <div style={{
        background: d.primary, color: pickReadable(d.primary),
        borderRadius: d.photoRadius, padding: '26px 22px', textAlign: 'center',
      }}>
        <h2 style={{ ...titleStyle, color: pickReadable(d.primary), margin: '0 0 10px' }}>{name}</h2>
        {ev?.period && (
          <p style={{ margin: '0 0 8px', fontSize: d.bodySize - 1, opacity: .9, letterSpacing: 1 }}>
            {ev.period}
          </p>
        )}
        {sale && <p style={{ margin: 0, fontSize: d.titleSize + 2, fontWeight: 800 }}>{sale}</p>}
        {body && <p style={{ ...bodyStyle, color: pickReadable(d.primary), marginTop: 10, opacity: .92 }}>{body}</p>}
      </div>
    );
  }

  if (tpl === 'D') {
    /* 고급 카드 */
    return (
      <div style={{
        border: `1px solid ${shade(d.text, 55)}`, borderRadius: d.photoRadius,
        padding: '28px 24px', textAlign: 'center',
      }}>
        <h2 style={{ ...titleStyle, margin: '0 0 14px' }}>{name}</h2>
        {ev?.period && (
          <p style={{ margin: '0 0 12px', fontSize: d.bodySize - 3, letterSpacing: 3, color: d.primary }}>
            {ev.period}
          </p>
        )}
        <div style={{ width: 40, height: 1, background: shade(d.text, 40), margin: '0 auto 14px' }} />
        {sale && (
          <p style={{ margin: 0, fontSize: d.titleSize, fontWeight: 700 }}>
            {sale}
            {list && <span style={{ fontSize: d.bodySize, opacity: .45, textDecoration: 'line-through', marginLeft: 10 }}>{list}</span>}
          </p>
        )}
        {body && <p style={{ ...bodyStyle, marginTop: 12 }}>{body}</p>}
      </div>
    );
  }

  if (tpl === 'E') {
    /* 이벤트 포스터형 — 대표사진 위에 제목·가격·구성을 얹는다.
       ⚠ 사진 자체는 손대지 않는다. 글자를 위에 올릴 뿐이다. */
    const includes = (project.pricing?.includes ?? '')
      .split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 5);
    const cover = photos[0];
    const coverH = Math.round(boxWidth * 0.72);
    return (
      <div style={{ borderRadius: d.photoRadius, overflow: 'hidden', border: `1px solid ${shade(d.text, 55)}` }}>
        {cover ? (
          <div style={{ position: 'relative' }}>
            <img
              src={cover.dataUrl}
              alt={cover.caption || cover.name}
              style={{
                display: 'block', width: '100%', height: coverH, objectFit: 'cover',
                objectPosition: cover.focusX + '% ' + cover.focusY + '%',
              }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,.62) 100%)',
            }} />
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              padding: '22px 20px', color: '#fff', textAlign: 'center',
            }}>
              <h2 style={{ ...titleStyle, color: '#fff', margin: '0 0 8px' }}>{name}</h2>
              {ev?.period && <p style={{ margin: '0 0 6px', fontSize: d.bodySize - 2, opacity: .9 }}>{ev.period}</p>}
              {body && (
                <p style={{ ...bodyStyle, color: '#fff', margin: '0 0 10px', opacity: .92, fontSize: d.bodySize - 1 }}>
                  {body}
                </p>
              )}
              <p style={{ margin: 0 }}>
                {list && (
                  <span style={{ opacity: .6, textDecoration: 'line-through', marginRight: 10, fontSize: d.bodySize }}>
                    {list}
                  </span>
                )}
                {sale && <b style={{ fontSize: d.titleSize + 4 }}>{sale}</b>}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px 20px' }}>
            <h2 style={{ ...titleStyle, margin: '0 0 8px' }}>{name}</h2>
            <Empty text="사진을 올리면 포스터가 완성됩니다." />
          </div>
        )}

        <div style={{ padding: '18px 20px', textAlign: 'center' }}>
          {includes.length > 0 && (
            <ul style={{ margin: '0 0 14px', padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
              {includes.map((it, i) => (
                <li key={i} style={{ fontSize: d.bodySize - 1, opacity: .9 }}>{it}</li>
              ))}
            </ul>
          )}
          <span style={{
            display: 'inline-block', background: d.primary, color: pickReadable(d.primary),
            padding: '13px 30px', fontWeight: 700, fontSize: d.bodySize + 1,
            borderRadius: d.buttonStyle === 'pill' ? 999 : d.buttonStyle === 'round' ? 10 : 0,
          }}>
            {menu.button || '예약·문의하기'}
          </span>
          <MorePhotos photos={photos} from={1} boxWidth={boxWidth - 40} radius={d.photoRadius} />
        </div>
      </div>
    );
  }

  if (tpl === 'B' && photos.length > 0) {
    /* 사진 + 가격 */
    const half = Math.floor((boxWidth - 14) / 2);
    return (
      <div>
        <h2 style={titleStyle}>{name}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
          <Img photo={photos[0]} width={half} radius={d.photoRadius} />
          <div style={{ textAlign: 'left' }}>
            {ev?.period && <p style={{ margin: '0 0 8px', fontSize: d.bodySize - 2, color: d.primary }}>{ev.period}</p>}
            {percent > 0 && (
              <p style={{ margin: '0 0 4px', fontSize: d.titleSize, fontWeight: 800, color: d.primary }}>{percent}%</p>
            )}
            {list && <p style={{ margin: 0, opacity: .45, textDecoration: 'line-through' }}>{list}</p>}
            {sale && <p style={{ margin: '2px 0 0', fontSize: d.titleSize - 4, fontWeight: 800 }}>{sale}</p>}
            {body && <p style={{ ...bodyStyle, marginTop: 10, fontSize: d.bodySize - 1 }}>{body}</p>}
          </div>
        </div>
        <MorePhotos photos={photos} from={1} boxWidth={boxWidth} radius={d.photoRadius} />
      </div>
    );
  }

  /* A — 큰 할인 강조 */
  return (
    <div>
      <h2 style={titleStyle}>{name}</h2>
      {ev?.period && <p style={{ margin: '0 0 6px', fontSize: d.bodySize - 1, opacity: .75 }}>{ev.period}</p>}
      {percent > 0 ? (
        <p style={{ margin: '0 0 8px', fontSize: d.titleSize + 16, fontWeight: 900, color: d.primary, lineHeight: 1 }}>
          {percent}%
        </p>
      ) : null}
      {(list || sale) && (
        <p style={{ margin: 0, fontSize: d.bodySize + 4 }}>
          {list && <span style={{ opacity: .45, textDecoration: 'line-through', marginRight: 10 }}>{list}</span>}
          {sale && <b style={{ fontSize: d.titleSize - 2 }}>{sale}</b>}
        </p>
      )}
      {body ? <p style={{ ...bodyStyle, marginTop: 12 }}>{body}</p> : null}
      {!body && !sale && !percent && <Empty text="이벤트 내용을 넣으면 여기에 보입니다." />}
    </div>
  );
}

/** '4인' → '4인 기준' / '4인 기준' → 그대로 (겹쳐 적히지 않게) */
function withGijun(people: string): string {
  const v = people.trim();
  return /(기준|까지)$/.test(v) ? v : `${v} 기준`;
}

function discountPercent(list?: string, sale?: string): number {
  const l = Number(String(list ?? '').replace(/[^\d]/g, ''));
  const s = Number(String(sale ?? '').replace(/[^\d]/g, ''));
  if (!l || !s || s >= l) return 0;
  return Math.round((1 - s / l) * 100);
}

/* ------------------------------------------------------------------ */
/* 특별한 혜택                                                          */
/* ------------------------------------------------------------------ */

export function PerksSection({ menu, project, titleStyle, bodyStyle, boxWidth }: SectionProps) {
  const d = project.design;
  const tpl = menu.template ?? 'A';
  /*
   * 이 섹션에 적어둔 줄을 **먼저** 본다.
   * 읽어온 혜택 목록(project.perks)은 그 줄을 채우는 데 쓰였을 뿐이고,
   * 사용자가 [글 수정]에서 고치면 그 내용이 바로 보여야 한다.
   */
  const own = splitLines(menu.lines);
  const items = own.length
    ? own
    : (project.perks ?? []).map((p) => ({ title: p.title, body: p.body }));
  const photos = photosOf(menu, project);

  if (items.length === 0) {
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <Empty text="드리는 혜택을 적으면 여기에 보입니다." />
      </div>
    );
  }

  if (tpl === 'B') {
    /* 카드 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {items.map((it, i) => (
            <div key={i} style={{
              border: `1px solid ${shade(d.text, 60)}`, borderRadius: d.photoRadius || 10,
              padding: '18px 16px', textAlign: 'center',
            }}>
              <b style={{ display: 'block', marginBottom: 6, color: d.accent }}>{it.title}</b>
              {it.body && <span style={{ fontSize: d.bodySize - 2, opacity: .8 }}>{it.body}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tpl === 'C') {
    /* 사진 + 설명 */
    const half = Math.floor((boxWidth - 14) / 2);
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {items.map((it, i) => {
            const photo = photos[i % Math.max(1, photos.length)];
            const flip = i % 2 === 1;
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center',
                direction: flip ? 'rtl' : 'ltr',
              }}>
                <div style={{ direction: 'ltr' }}>
                  {photo ? <Img photo={photo} width={half} radius={d.photoRadius} /> : <Empty text="사진" />}
                </div>
                <div style={{ direction: 'ltr', textAlign: 'left' }}>
                  <b style={{ display: 'block', marginBottom: 6, color: d.accent }}>{it.title}</b>
                  {it.body && <span style={{ fontSize: d.bodySize - 1, opacity: .85 }}>{it.body}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <MorePhotos photos={photos} from={items.length} boxWidth={boxWidth} radius={d.photoRadius} />
      </div>
    );
  }

  if (tpl === 'D') {
    /* 아이콘 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
          {items.map((it, i) => (
            <div key={i} style={{ width: Math.floor((boxWidth - 28) / 3), textAlign: 'center' }}>
              <span style={{
                display: 'flex', width: 54, height: 54, borderRadius: 27, margin: '0 auto 10px',
                background: shade(d.background, -6), color: d.primary,
                alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800,
              }}>{project.perks?.[i]?.icon || String(i + 1).padStart(2, '0')}</span>
              <b style={{ display: 'block', fontSize: d.bodySize - 1 }}>{it.title}</b>
              {it.body && <span style={{ fontSize: d.bodySize - 3, opacity: .75 }}>{it.body}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tpl === 'E') {
    /* 세로 스토리 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gap: 0, textAlign: 'left' }}>
          {items.map((it, i) => (
            <div key={i} style={{
              borderLeft: `2px solid ${shade(d.primary, 30)}`, paddingLeft: 18,
              paddingBottom: i === items.length - 1 ? 0 : 20, position: 'relative',
            }}>
              <span style={{
                position: 'absolute', left: -5, top: 4, width: 8, height: 8,
                borderRadius: 4, background: d.primary,
              }} />
              <b style={{ display: 'block', marginBottom: 4, color: d.accent }}>{it.title}</b>
              {it.body && <span style={{ fontSize: d.bodySize - 1, opacity: .85 }}>{it.body}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* A — 번호 강조 */
  return (
    <div>
      <h2 style={titleStyle}>{menu.title}</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', gap: 14, alignItems: 'flex-start', textAlign: 'left',
            background: shade(d.background, -4), borderRadius: d.photoRadius, padding: '16px 18px',
          }}>
            <span style={{
              flex: '0 0 auto', fontSize: d.titleSize - 6, fontWeight: 800,
              color: d.primary, lineHeight: 1, minWidth: 34,
            }}>{String(i + 1).padStart(2, '0')}</span>
            <span>
              <b style={{ display: 'block', marginBottom: 4 }}>{it.title}</b>
              {it.body && <span style={{ opacity: .85 }}>{it.body}</span>}
            </span>
          </div>
        ))}
      </div>
      {bodyStyle && null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 가격                                                                */
/* ------------------------------------------------------------------ */

/** 가격 안내 — 이 섹션에 직접 고른 사진(예: GPT로 만든 가격표 이미지)이 있으면 아래에 보여준다 */
export function PriceSection(props: SectionProps) {
  const photos = props.menu.photoIds.length ? photosOf(props.menu, props.project) : [];
  return (
    <div>
      <PriceSectionBody {...props} />
      <MorePhotos photos={photos} from={0} boxWidth={props.boxWidth} radius={props.project.design.photoRadius} />
    </div>
  );
}

function PriceSectionBody({ menu, project, titleStyle, bodyStyle }: SectionProps) {
  const d = project.design;
  const tpl = menu.template ?? 'A';
  const pr = project.pricing;
  const prod = project.product;
  /* 고른 촬영분야의 상품만 보여준다 (원본 상품 데이터는 그대로) */
  const fp = fieldProducts(project);
  const repMain = !fp.rep || fp.rep.main;
  const useMain = fp.matched && repMain;
  const list = useMain ? formatWon(pr?.listPrice || prod.listPrice) : '';
  const sale = !fp.matched ? '' : repMain ? formatWon(pr?.eventPrice || prod.salePrice) : fp.rep!.price;
  const percent = useMain ? discountPercent(pr?.listPrice || prod.listPrice, pr?.eventPrice || prod.salePrice) : 0;
  const includes = useMain ? (pr?.includes || '').split('\n').map((s) => s.trim()).filter(Boolean) : [];
  const extras = [
    ['액자', pr?.frame], ['수정본', pr?.retouch], ['원본 제공', pr?.rawFiles],
    ['의상', pr?.costume], ['헤어·메이크업', pr?.hairMakeup],
    ['추가 인원', pr?.extraPerson], ['주말 추가', pr?.weekendExtra],
    /* '기타' 에는 여러 줄이 들어올 수 있다 (링크로 가져온 가격표 등).
       한 칸에 몰아 넣으면 줄바꿈이 사라져 길게 이어 붙으므로 줄마다 한 칸씩 보여준다 */
    /* '상품명 25,000원' 처럼 적힌 줄은 실제 이름과 금액으로 나눈다 — '기타' 같은 임시 이름은 쓰지 않는다 */
    ...(fp.field
      ? fp.others.map((o) => [o.name, o.price] as [string, string | undefined])
      : (pr?.etcExtra || '').split('\n').map((s) => s.trim()).filter(Boolean)
        .map((s) => (splitPriceLine(s) ?? ['', s]) as [string, string | undefined])),
  ].filter(([, v]) => !!v) as [string, string][];
  /* 대표 상품의 실제 이름 — 금액만 있으면 어느 상품 가격인지 알 수 없으므로 제목 아래에 보여준다 (카드형 B 는 머리에 이미 있음) */
  /* 메인 제목(product.name)과 따로 — 가져오거나 고른 실제 상품명을 먼저 쓴다 */
  const itemName = (fp.field ? (fp.rep?.name ?? '') : (project.shoot?.productName || prod.name || '')).trim();
  const nameLine = itemName
    ? <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: d.bodySize + 2 }}>{itemName}</p>
    : null;

  if (!list && !sale && includes.length === 0 && extras.length === 0) {
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <Empty text={fp.field && !fp.matched
          ? `${fp.field} 관련 상품을 자동으로 찾지 못했습니다. 가격 안내 편집에서 상품을 골라주세요.`
          : '가격을 넣으면 여기에 보입니다. (확인이 필요한 값이라 비워뒀습니다)'} />
      </div>
    );
  }

  const row = (k: string, v: string, i = 0) => (
    <div key={`${k}-${i}-${v}`} style={{
      display: 'flex', justifyContent: 'space-between', gap: 12,
      padding: '9px 0', borderBottom: `1px solid ${shade(d.text, 70)}`, textAlign: 'left',
    }}>
      <span style={{ opacity: .7 }}>{k}</span>
      <b>{v}</b>
    </div>
  );

  if (tpl === 'B') {
    /* 패키지 카드 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{
          border: `2px solid ${d.primary}`, borderRadius: d.photoRadius || 12, overflow: 'hidden',
        }}>
          <div style={{ background: d.primary, color: pickReadable(d.primary), padding: '14px 18px' }}>
            <b style={{ fontSize: d.bodySize + 2 }}>{itemName || (pr?.people ? withGijun(pr.people) : '기본 패키지')}</b>
          </div>
          <div style={{ padding: '18px' }}>
            {sale && <p style={{ margin: '0 0 14px', fontSize: d.titleSize, fontWeight: 800 }}>{sale}</p>}
            {includes.map((x, i) => row('포함', x, i))}
            {extras.map(([k, v], i) => row(k, v, i))}
          </div>
        </div>
      </div>
    );
  }

  if (tpl === 'C') {
    /* 정상가 → 할인가 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        {nameLine}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
          {/* 정상가가 없으면 줄 그은 가격과 화살표를 그리지 않는다 */}
          {list && sale && (
            <>
              <span style={{ fontSize: d.bodySize + 2, opacity: .5, textDecoration: 'line-through' }}>{list}</span>
              <span style={{ fontSize: d.titleSize, color: d.primary }}>→</span>
            </>
          )}
          <span style={{ fontSize: d.titleSize + 6, fontWeight: 900 }}>{sale || list}</span>
          {percent > 0 && (
            <span style={{
              background: d.primary, color: pickReadable(d.primary), borderRadius: 999,
              padding: '5px 13px', fontWeight: 800, fontSize: d.bodySize,
            }}>{percent}% 할인</span>
          )}
        </div>
        {pr?.people && <p style={{ ...bodyStyle, marginTop: 12, opacity: .75 }}>{withGijun(pr.people)}</p>}
        {/* 상품 구성도 함께 — 예전에는 이 모양에서만 구성이 안 보였다 */}
        {(includes.length > 0 || extras.length > 0) && (
          <div style={{ marginTop: 16 }}>
            {includes.map((x, i) => row('포함', x, i))}
            {extras.map(([k, v], i) => row(k, v, i))}
          </div>
        )}
      </div>
    );
  }

  if (tpl === 'D') {
    /* 포함사항 중심 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        {nameLine}
        {sale && (
          <p style={{ margin: '0 0 14px', fontSize: d.titleSize - 4, fontWeight: 800 }}>
            {sale}{pr?.people ? <span style={{ fontSize: d.bodySize, opacity: .6, marginLeft: 8 }}>{withGijun(pr.people)}</span> : null}
          </p>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          {includes.map((x, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left',
              background: shade(d.background, -4), borderRadius: d.photoRadius || 8, padding: '12px 16px',
            }}>
              <span style={{ color: d.primary, fontWeight: 800 }}>+</span>
              <span>{x}</span>
            </div>
          ))}
          {extras.map(([k, v], i) => row(k, v, i))}
        </div>
      </div>
    );
  }

  /* A — 큰 가격 강조 */
  return (
    <div>
      <h2 style={titleStyle}>{menu.title}</h2>
      {nameLine}
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', justifyContent: d.align === 'center' ? 'center' : d.align === 'right' ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
        {percent > 0 && <span style={{ color: d.primary, fontWeight: 800, fontSize: 30 }}>{percent}%</span>}
        {list && percent > 0 && <span style={{ textDecoration: 'line-through', opacity: .45, fontSize: 18 }}>{list}</span>}
        <span style={{ fontWeight: 800, fontSize: 34 }}>{sale || list}</span>
      </div>
      {pr?.people && <p style={{ ...bodyStyle, marginTop: 8, opacity: .75 }}>{withGijun(pr.people)}</p>}
      {(includes.length > 0 || extras.length > 0) && (
        <div style={{ marginTop: 16 }}>
          {includes.map((x, i) => row('포함', x, i))}
          {extras.map(([k, v], i) => row(k, v, i))}
        </div>
      )}
      {menu.body && <p style={{ ...bodyStyle, marginTop: 14 }}>{menu.body}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 촬영 콘셉트                                                          */
/* ------------------------------------------------------------------ */

export function ConceptSection({ menu, project, titleStyle, bodyStyle, boxWidth }: SectionProps) {
  const d = project.design;
  const tpl = menu.template ?? 'A';
  const names = menu.lines.filter(Boolean);
  const concepts = project.concepts ?? [];
  const photos = photosOf(menu, project);
  const half = Math.floor((boxWidth - 14) / 2);

  const chips = names.length > 0 && (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: d.align === 'center' ? 'center' : d.align === 'right' ? 'flex-end' : 'flex-start', marginTop: 12 }}>
      {names.map((n, i) => (
        <span key={i} style={{
          border: `1px solid ${d.primary}`, color: d.primary,
          borderRadius: 999, padding: '7px 16px', fontSize: d.bodySize - 2,
        }}>{n}</span>
      ))}
    </div>
  );

  if (tpl === 'B' || tpl === 'C') {
    /* 사진 왼쪽/오른쪽 + 설명 */
    const photoFirst = tpl === 'B';
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
          {photoFirst && photos[0] && <Img photo={photos[0]} width={half} radius={d.photoRadius} />}
          <div style={{ textAlign: 'left' }}>
            {menu.body && <p style={{ ...bodyStyle }}>{menu.body}</p>}
            {names.length > 0 && (
              <ul style={{ margin: '12px 0 0', paddingLeft: 18, display: 'grid', gap: 5 }}>
                {names.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </div>
          {!photoFirst && photos[0] && <Img photo={photos[0]} width={half} radius={d.photoRadius} />}
        </div>
        <MorePhotos photos={photos} from={1} boxWidth={boxWidth} radius={d.photoRadius} />
      </div>
    );
  }

  if (tpl === 'D') {
    /* 콜라주 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        {menu.body && <p style={{ ...bodyStyle, marginBottom: 14 }}>{menu.body}</p>}
        {photos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Img photo={photos[0]} width={Math.floor(boxWidth * 0.64)} radius={d.photoRadius} />
            <div style={{ display: 'grid', gap: 10 }}>
              {photos.slice(1, 3).map((p) => (
                <Img key={p.id} photo={p} width={Math.floor(boxWidth * 0.33)} radius={d.photoRadius} />
              ))}
            </div>
          </div>
        ) : <Empty text="사진을 넣으면 여기에 보입니다." />}
        <MorePhotos photos={photos} from={3} boxWidth={boxWidth} radius={d.photoRadius} />
        {chips}
      </div>
    );
  }

  if (tpl === 'E') {
    /* 카드 갤러리 — 콘셉트마다 사진 한 장 */
    const cards = concepts.length > 0
      ? concepts.map((c, i) => ({ name: c.name, summary: c.summary, photo: photos[i] }))
      : names.map((n, i) => ({ name: n, summary: '', photo: photos[i] }));
    /* 사진이 있는 카드만 그린다 — 빈 회색 칸을 만들지 않는다 (콘셉트 이름은 그대로 두어 사진을 넣으면 다시 보인다) */
    const shown = cards.filter((c) => c.photo);
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        {menu.body && <p style={{ ...bodyStyle, marginBottom: 14 }}>{menu.body}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {shown.map((c, i) => (
            <div key={i}>
              {c.photo && <Img photo={c.photo} width={half} radius={d.photoRadius} />}
              <b style={{ display: 'block', marginTop: 8, fontSize: d.bodySize }}>{c.name}</b>
              {c.summary && <span style={{ fontSize: d.bodySize - 3, opacity: .75 }}>{c.summary}</span>}
            </div>
          ))}
        </div>
        <MorePhotos photos={photos} from={cards.length} boxWidth={boxWidth} radius={d.photoRadius} />
      </div>
    );
  }

  /* A — 큰 사진 중심 (사진은 공통 사진 칸이 그린다) */
  return (
    <div>
      <h2 style={titleStyle}>{menu.title}</h2>
      {menu.body && <p style={bodyStyle}>{menu.body}</p>}
      {chips}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 장점                                                                */
/* ------------------------------------------------------------------ */

export function BenefitSection({ menu, project, titleStyle, bodyStyle, boxWidth }: SectionProps) {
  const d = project.design;
  const tpl = menu.template ?? 'A';
  const lines = (menu.body || project.product.benefits || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const photos = photosOf(menu, project);
  const half = Math.floor((boxWidth - 14) / 2);

  if (lines.length === 0) {
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <Empty text="장점을 적으면 여기에 보입니다." />
      </div>
    );
  }

  if (tpl === 'B') {
    /* 숫자 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gap: 18 }}>
          {lines.map((line, i) => (
            <div key={i} style={{ textAlign: 'left' }}>
              <span style={{
                display: 'block', fontSize: d.titleSize + 4, fontWeight: 900,
                color: shade(d.primary, 45), lineHeight: 1, marginBottom: 4,
              }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: d.bodySize + 1 }}>{line}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tpl === 'C') {
    /* 키워드 강조 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {lines.map((line, i) => {
            const [head, ...rest] = line.split(' ');
            return (
              <p key={i} style={{ margin: 0, fontSize: d.bodySize + 2, lineHeight: 1.7 }}>
                <b style={{ color: d.primary }}>{head}</b>{rest.length ? ' ' + rest.join(' ') : ''}
              </p>
            );
          })}
        </div>
      </div>
    );
  }

  if (tpl === 'D') {
    /* 사진 + 설명 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {lines.map((line, i) => {
            const photo = photos[i % Math.max(1, photos.length)];
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
                {photo ? <Img photo={photo} width={half} radius={d.photoRadius} />
                  : <div style={{ height: 110, background: shade(d.background, -6), borderRadius: d.photoRadius }} />}
                <span style={{ textAlign: 'left' }}>{line}</span>
              </div>
            );
          })}
        </div>
        <MorePhotos photos={photos} from={lines.length} boxWidth={boxWidth} radius={d.photoRadius} />
      </div>
    );
  }

  /* A — 포인트 카드 */
  return (
    <div>
      <h2 style={titleStyle}>{menu.title}</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {lines.map((line, i) => (
          <li key={i} style={{
            background: shade(d.background, -4), borderRadius: d.photoRadius,
            padding: '14px 18px', borderLeft: `4px solid ${d.primary}`, textAlign: 'left',
          }}>{line}</li>
        ))}
      </ul>
      {bodyStyle && null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 이런 분께 추천                                                       */
/* ------------------------------------------------------------------ */

export function RecommendSection({ menu, project, titleStyle, bodyStyle }: SectionProps) {
  const d = project.design;
  const tpl = menu.template ?? 'A';
  const items = menu.lines.length
    ? menu.lines.filter(Boolean)
    : (menu.body || project.product.target || '').split('\n').map((x) => x.trim()).filter(Boolean);

  if (items.length === 0) {
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <Empty text="어떤 분께 추천하는지 적으면 여기에 보입니다." />
      </div>
    );
  }

  if (tpl === 'B') {
    /* 상황별 카드 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {items.map((line, i) => (
            <div key={i} style={{
              background: shade(d.primary, 88), borderRadius: d.photoRadius || 12,
              padding: '18px 16px', textAlign: 'left', fontSize: d.bodySize,
            }}>{line}</div>
          ))}
        </div>
      </div>
    );
  }

  if (tpl === 'C') {
    /* 질문형 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((line, i) => (
            <p key={i} style={{
              margin: 0, textAlign: 'left', fontSize: d.bodySize + 1,
              paddingLeft: 26, position: 'relative', lineHeight: 1.7,
            }}>
              <span style={{ position: 'absolute', left: 0, color: d.primary, fontWeight: 800 }}>Q.</span>
              {line.replace(/\?$/, '')} 이신가요?
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (tpl === 'D') {
    /* 큰 문장 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {items.map((line, i) => (
            <p key={i} style={{
              margin: 0, fontSize: d.bodySize + 5, lineHeight: 1.6,
              color: i === 0 ? d.accent : d.text, fontWeight: i === 0 ? 700 : 400,
            }}>{line}</p>
          ))}
        </div>
      </div>
    );
  }

  /* A — 체크리스트 */
  return (
    <div>
      <h2 style={titleStyle}>{menu.title}</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        {items.map((line, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left' }}>
            <span style={{
              flex: '0 0 auto', width: 22, height: 22, borderRadius: 11,
              background: d.primary, color: pickReadable(d.primary),
              fontSize: 13, fontWeight: 700, display: 'flex',
              alignItems: 'center', justifyContent: 'center', marginTop: 2,
            }}>
              {/* 체크 모양은 글자(✓)가 아니라 선으로 그린다 — 휴대폰에서 이모지로 바뀌지 않게 */}
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M2.5 6.2l2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      {bodyStyle && null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 갤러리                                                              */
/* ------------------------------------------------------------------ */

export function GallerySection({ menu, project, titleStyle, boxWidth }: SectionProps) {
  const d = project.design;
  const tpl = menu.template ?? 'A';
  const photos = photosOf(menu, project);

  if (photos.length === 0) {
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <Empty text="사진을 넣으면 여기에 보입니다." />
      </div>
    );
  }

  const gap = 10;
  const cols = tpl === 'B' ? 1 : tpl === 'C' ? 2 : tpl === 'D' ? 3 : 2;
  const cell = Math.floor((boxWidth - gap * (cols - 1)) / cols);
  /*
   * 갤러리 카드는 4:5 세로형.
   * 정사각(1:1)으로 맞추니 사진 속 글자와 인물의 위아래가 너무 잘렸다.
   * 원본은 그대로 두고 보여주는 칸 비율만 바꾼다. (갤러리에서만 쓴다)
   */
  const cellH = Math.round(cell * 1.25);

  if (tpl === 'D') {
    /* 모자이크 — 첫 장을 크게 */
    const [first, ...rest] = photos;
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gap }}>
          <GalleryCell photo={first} height={Math.round(boxWidth * 0.66)} radius={d.photoRadius} />
          {rest.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap }}>
              {rest.map((p) => <GalleryCell key={p.id} photo={p} height={cellH} radius={d.photoRadius} />)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={titleStyle}>{menu.title}</h2>
      {/* 칸 높이를 칸 너비와 같게(1:1) 잡아 모든 카드가 같은 크기로 보이게 한다 */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, marginTop: 4 }}>
        {photos.map((p) => <GalleryCell key={p.id} photo={p} height={cellH} radius={d.photoRadius} />)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 촬영 과정 · 준비사항                                                  */
/* ------------------------------------------------------------------ */

export function ProcessSection({ menu, project, titleStyle }: SectionProps) {
  const d = project.design;
  const tpl = menu.template ?? 'A';
  const steps = menu.lines.filter(Boolean);
  if (steps.length === 0) {
    return <div><h2 style={titleStyle}>{menu.title}</h2><Empty text="촬영 과정을 적으면 여기에 보입니다." /></div>;
  }

  if (tpl === 'B') {
    /* 가로 단계 */
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          {steps.map((s, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: shade(d.background, -5), borderRadius: 999,
                padding: '9px 16px', fontSize: d.bodySize - 1,
              }}>{s}</span>
              {i < steps.length - 1 && <span style={{ color: d.primary }}>›</span>}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={titleStyle}>{menu.title}</h2>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', textAlign: 'left' }}>
        {steps.map((line, i) => (
          <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: i === steps.length - 1 ? 0 : 14 }}>
            <span style={{
              flex: '0 0 auto', width: 26, height: 26, borderRadius: 13,
              border: `2px solid ${d.primary}`, color: d.primary,
              fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i + 1}</span>
            <span style={{ paddingTop: 3 }}>{line}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PrepareSection({ menu, project, titleStyle }: SectionProps) {
  const d = project.design;
  const tpl = menu.template ?? 'A';
  const items = menu.lines.filter(Boolean);
  if (items.length === 0) {
    return <div><h2 style={titleStyle}>{menu.title}</h2><Empty text="준비사항을 적으면 여기에 보입니다." /></div>;
  }

  if (tpl === 'B') {
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {items.map((line, i) => (
            <div key={i} style={{
              background: shade(d.background, -4), borderRadius: d.photoRadius || 10,
              padding: '16px', textAlign: 'left', fontSize: d.bodySize - 1,
            }}>{line}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={titleStyle}>{menu.title}</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8, textAlign: 'left' }}>
        {items.map((line, i) => (
          <li key={i} style={{
            border: `1px dashed ${shade(d.text, 60)}`, borderRadius: d.photoRadius || 8,
            padding: '12px 16px',
          }}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 가격표 · 상품 비교                                                   */
/* ------------------------------------------------------------------ */

/**
 * 촬영상품 여러 개를 한눈에.
 *
 * 한 장짜리 그림이 아니다. 상품명·가격·구성·사진이 **각각 고칠 수 있는 내용**이다.
 * 미리보기에서 글자를 눌러 바로 고칠 수 있다.
 */
export function PackagesSection({ menu, project, titleStyle, bodyStyle, boxWidth, narrow, edit }: SectionProps) {
  const d = project.design;
  const list = project.packages ?? [];
  const tpl = menu.template ?? 'A';
  const photoById = (id: string) => project.photos.find((p) => p.id === id);

  if (list.length === 0) {
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <Empty text="촬영상품을 넣으면 여기에 가격표가 만들어집니다." />
      </div>
    );
  }

  /* 표 — 상품이 많을 때 한눈에 비교하기 좋다 */
  if (tpl === 'B') {
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        {menu.body && <p style={{ ...bodyStyle, marginBottom: 14 }}>{menu.body}</p>}
        <div style={{ border: `1px solid ${shade(d.text, 55)}`, borderRadius: d.photoRadius, overflow: 'hidden' }}>
          {list.map((it, i) => (
            <div
              key={it.id}
              style={{
                display: 'grid',
                gridTemplateColumns: narrow ? '1fr auto' : '1.2fr 2fr auto',
                gap: 12, alignItems: 'center', textAlign: 'left',
                padding: '14px 16px',
                borderTop: i === 0 ? 'none' : `1px solid ${shade(d.text, 60)}`,
              }}
            >
              <Editable as="b" on={!!edit} value={it.name} placeholder="상품명"
                style={{ fontSize: d.bodySize + 1 }}
                onSave={(v) => edit?.onPackage(it.id, 'name', v)} />
              {!narrow && (
                <span style={{ fontSize: d.bodySize - 2, opacity: .8 }}>
                  {it.note || it.includes.split('\n').filter(Boolean).join(' · ')}
                </span>
              )}
              {edit
                ? <Editable as="b" on numeric value={it.price} display={formatWon(it.price) || it.price} placeholder="가격"
                    style={{ fontSize: d.bodySize + 2, color: d.primary, whiteSpace: 'nowrap' }}
                    onSave={(v) => edit.onPackage(it.id, 'price', v)} />
                : <b style={{ fontSize: d.bodySize + 2, color: d.primary, whiteSpace: 'nowrap' }}>{formatWon(it.price) || it.price}</b>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* A — 상품 카드 나란히 */
  const cols = narrow ? 1 : list.length >= 3 ? 3 : 2;
  const gap = 12;
  const cellW = Math.floor((boxWidth - gap * (cols - 1)) / cols);

  return (
    <div>
      <h2 style={titleStyle}>{menu.title}</h2>
      {menu.body && <p style={{ ...bodyStyle, marginBottom: 16 }}>{menu.body}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
        {list.map((it) => {
          const photo = photoById(it.photoId);
          const items = it.includes.split('\n').map((s) => s.trim()).filter(Boolean);
          return (
            <div
              key={it.id}
              style={{
                border: `1px solid ${shade(d.text, 55)}`, borderRadius: d.photoRadius,
                overflow: 'hidden', textAlign: 'left', background: shade(d.background, 98),
              }}
            >
              {photo && (
                <img
                  src={photo.dataUrl}
                  alt={photo.caption || photo.name}
                  style={{
                    display: 'block', width: '100%', height: Math.round(cellW * 0.66),
                    objectFit: 'cover', objectPosition: photo.focusX + '% ' + photo.focusY + '%',
                  }}
                />
              )}
              <div style={{ padding: '14px 14px 16px' }}>
                <Editable as="b" on={!!edit} value={it.name} placeholder="상품명"
                  style={{ display: 'block', fontSize: d.bodySize + 1 }}
                  onSave={(v) => edit?.onPackage(it.id, 'name', v)} />
                {it.note && (
                  <span style={{ display: 'block', marginTop: 4, fontSize: d.bodySize - 3, opacity: .75 }}>
                    {it.note}
                  </span>
                )}
                {edit
                  ? <Editable as="p" on numeric value={it.price} display={formatWon(it.price) || it.price} placeholder="가격"
                      style={{ margin: '10px 0 0', fontSize: d.titleSize - 10, fontWeight: 800, color: d.primary }}
                      onSave={(v) => edit.onPackage(it.id, 'price', v)} />
                  : <p style={{ margin: '10px 0 0', fontSize: d.titleSize - 10, fontWeight: 800, color: d.primary }}>{formatWon(it.price) || it.price}</p>}
                {items.length > 0 && (
                  <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                    {items.map((x, k) => (
                      <li key={k} style={{ fontSize: d.bodySize - 3, opacity: .85 }}>· {x}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 자유 영역                                                            */
/* ------------------------------------------------------------------ */

/** 정해진 틀에 없는 내용을 직접 적는 칸 — 제목 · 본문 · 사진 · 버튼 */
export function FreeSection({ menu, project, titleStyle, bodyStyle }: SectionProps) {
  const d = project.design;
  return (
    <div>
      {menu.title && <h2 style={titleStyle}>{menu.title}</h2>}
      {menu.body
        ? <p style={bodyStyle}>{menu.body}</p>
        : <Empty text="여기에 원하시는 내용을 적어주세요." />}
      {menu.button && (
        <div style={{ marginTop: 16 }}>
          <span style={{
            display: 'inline-block', background: d.primary, color: pickReadable(d.primary),
            padding: '13px 28px', fontWeight: 700, fontSize: d.bodySize,
            borderRadius: d.buttonStyle === 'pill' ? 999 : d.buttonStyle === 'round' ? 10 : 0,
          }}>
            {menu.button}
          </span>
        </div>
      )}
    </div>
  );
}

/** 후기 별점 — 어느 디자인에서나 같은 밝은 골드. 브랜드색을 따라가지 않는다 */
const STAR_GOLD = '#f5b301';

/* ------------------------------------------------------------------ */
/* 후기                                                                */
/* ------------------------------------------------------------------ */

/**
 * 후기 — 후기 전용 카드.
 *
 * 글과 사진을 **따로** 그린다. 한 장 이미지로 합치지 않는다.
 * 별점은 **실제 값이 있을 때만** 그린다 (없는 후기에 별 5개를 만들어 붙이지 않는다).
 */
export function ReviewSection({ menu, project, titleStyle, bodyStyle, boxWidth, narrow }: SectionProps) {
  const d = project.design;
  /* 고른 후기 중 앞에서 최대 4개까지만 (넓은 화면에서 2열 × 2행). 없는 후기를 만들어 채우지 않는다 */
  const list = (project.reviews ?? [])
    .filter((r) => r.use && (r.body.trim() || r.photoId))
    .slice(0, 4);

  if (list.length === 0) {
    return (
      <div>
        <h2 style={titleStyle}>{menu.title}</h2>
        <Empty text="후기를 고르면 여기에 보입니다." />
      </div>
    );
  }

  const cols = narrow || list.length === 1 ? 1 : 2;
  const gap = 12;
  const cell = Math.floor((boxWidth - gap * (cols - 1)) / cols);
  const photoOf = (id: string) => project.photos.find((p) => p.id === id);

  return (
    <div>
      <h2 style={titleStyle}>{menu.title}</h2>
      {menu.body.trim() && <p style={{ ...bodyStyle, marginTop: 0, marginBottom: 14 }}>{menu.body}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
        {list.map((r) => {
          const photo = photoOf(r.photoId);
          const who = [r.author, r.source].filter(Boolean).join(' · ');
          return (
            <div
              key={r.id}
              style={{
                background: shade(d.background, -3),
                borderRadius: d.photoRadius,
                overflow: 'hidden',
                textAlign: 'left',
              }}
            >
              {photo && (
                <img
                  src={photo.dataUrl}
                  alt={photo.caption || photo.name}
                  style={{
                    width: '100%', height: Math.round(cell * 0.72), display: 'block',
                    objectFit: 'cover', objectPosition: `${photo.focusX}% ${photo.focusY}%`,
                    background: '#f1f3f6',
                  }}
                />
              )}
              <div style={{ padding: '14px 16px 16px' }}>
                {/* 실제 별점이 있을 때만 */}
                {/* 실제 별점이 있을 때만. 빈 별·숫자는 그리지 않는다 */}
                {!!r.stars && (
                  <p style={{ margin: '0 0 6px', color: STAR_GOLD, fontSize: d.bodySize, letterSpacing: 2 }}>
                    {'★'.repeat(Math.max(1, Math.min(5, Math.round(r.stars))))}
                  </p>
                )}
                {r.body.trim() && (
                  <p style={{ ...bodyStyle, margin: 0, textAlign: 'left', whiteSpace: 'pre-wrap' }}>{r.body}</p>
                )}
                {(who || r.date) && (
                  <p style={{ margin: '10px 0 0', fontSize: d.bodySize - 2, opacity: .7, textAlign: 'left' }}>
                    {[who, r.date].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
