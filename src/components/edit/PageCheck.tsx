import { useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { hasContent } from '@/components/preview/sectionContent';

/**
 * 상세페이지 점검 — ③ 보면서 고치기의 **보조 도구.**
 *
 * 저장을 막지 않는다. 퍼센트로 "아직 덜 됐다"고 느끼게 하지도 않는다.
 * 확인하면 좋은 것만 짧게 알려준다.
 */
export function PageCheck({ onGo }: { onGo: (tab: 'content' | 'photos' | 'menus' | 'design') => void }) {
  const { project, update } = useProject();
  const [open, setOpen] = useState(false);
  const p = project;
  const visible = p.menus.filter((m) => !m.hidden);
  /* 맨 위·예약 영역은 글을 넣으면 바로 보여야 하므로 숨기지 않는다 */
  const keep = (k: string) => k === 'main' || k === 'cta';
  const empty = visible.filter((m) => !keep(m.kind) && !hasContent(m, p));

  const items: { ok: boolean; text: string; go?: 'content' | 'photos' | 'menus' }[] = [
    { ok: !!p.product.name.trim(), text: p.product.name.trim() ? '상품명' : '상품명 확인 필요', go: 'content' },
    { ok: !!(p.product.salePrice || p.product.listPrice), text: p.product.salePrice || p.product.listPrice ? '가격' : '가격 확인 필요', go: 'content' },
    { ok: p.photos.some((x) => x.kind !== 'unused'), text: p.photos.length ? `사진 ${p.photos.filter((x) => x.kind !== 'unused').length}장` : '사진 확인 필요', go: 'photos' },
    { ok: visible.some((m) => m.kind === 'cta'), text: visible.some((m) => m.kind === 'cta') ? '예약·문의' : '예약·문의 영역 확인 필요', go: 'menus' },
    { ok: !!(p.studio?.phone || p.studio?.bookingUrl || p.product.contact), text: p.studio?.phone || p.studio?.bookingUrl || p.product.contact ? '연락처' : '전화번호 확인 필요', go: 'content' },
  ];
  const need = items.filter((i) => !i.ok).length;

  return (
    <section className={'pagecheck' + (open ? ' is-open' : '')}>
      <button className="pagecheck__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <b>상세페이지 점검</b>
        <span>{need ? `확인하면 좋은 것 ${need}개` : '모두 좋아요'}{empty.length ? ` · 빈 영역 ${empty.length}개` : ''}</span>
        <em>{open ? '접기' : '보기'}</em>
      </button>
      {open && (
        <div className="pagecheck__body">
          <ul>
            {items.map((it) => (
              <li key={it.text} className={it.ok ? 'is-ok' : 'is-warn'}>
                <i aria-hidden>{it.ok ? '✓' : '!'}</i>
                <span>{it.text}</span>
                {!it.ok && it.go && <button className="linkbtn" onClick={() => onGo(it.go!)}>고치러 가기</button>}
              </li>
            ))}
          </ul>
          {empty.length > 0 && (
            <p className="field__hint">
              비어 있는 영역 <b>{empty.map((m) => m.title).join(' · ')}</b> 은(는) 미리보기와 저장 이미지에서 빠집니다.{' '}
              <button
                className="linkbtn"
                onClick={() => update((d) => {
                  d.menus.forEach((m) => { if (!m.hidden && !keep(m.kind) && !hasContent(m, d)) m.hidden = true; });
                }, { label: 'menu.hideEmpty', merge: false })}
              >
                빈 영역 숨기기
              </button>
            </p>
          )}
          <p className="field__hint">점검은 참고용입니다. 확인할 것이 남아 있어도 저장할 수 있습니다.</p>
        </div>
      )}
    </section>
  );
}
