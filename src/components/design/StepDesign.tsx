import { useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { useEdition } from '@/store/EditionContext';
import { ReferenceCapture } from './ReferenceCapture';
import { DESIGN_PRESETS } from '@/types/defaults';
import {
  FONT_LABEL, STYLE_PRESET_LABEL,
  type ButtonStyle, type DesignSettings, type FontKey, type StylePreset,
} from '@/types/project';
import { FONT_CHOICES, FONT_KEYS } from '@/config/fonts';
import { ensureFonts } from '@/services/fonts/loadFont';
import {
  applyStyle, setAllFonts, setTextScale, textScaleOf, TEXT_SCALE_LABEL, type TextScale,
} from '@/services/design/style';
import { saveSnapshot } from '@/services/storage/snapshots';

/**
 * 디자인 — **완성된 것에서 필요한 부분만 고친다.**
 *
 * 처음 보이는 것은 네 가지뿐이다.
 *   스타일 · 글씨체 · 글자 크기 · 정렬
 * 나머지(색·간격·여백·버튼·구분선·제목/본문 글씨체 따로)는 [디자인 더 수정하기] 안에 접어둔다.
 *
 * ⚠ 스타일을 바꿔도 적어두신 글과 사진은 절대 바뀌지 않는다.
 */

/** 스타일 카드에 쓰는 짧은 설명 */
const STYLE_FEEL: Record<StylePreset, string> = {
  luxury: '차분하고 신뢰감 있게',
  clean: '정보가 또렷하게',
  warm: '포근하고 편안하게',
  emotional: '분위기 있게',
  minimal: '선과 여백으로 세련되게',
  bright: '가격·혜택이 눈에 띄게',
};

export function StepDesign() {
  const { project, update } = useProject();
  const { isPro } = useEdition();
  const d = project.design;
  const [more, setMore] = useState(false);
  const [refOpen, setRefOpen] = useState(false);

  ensureFonts(FONT_CHOICES.map((f) => f.key));

  const pickStyle = (key: StylePreset) => {
    if (key === d.preset && d.styleChosen) return;
    void saveSnapshot(project, '스타일 바꾸기 전');
    update((x) => { applyStyle(x, key, { chosen: true, templates: true }); }, { label: 'design.style', merge: false });
  };

  const set = <K extends keyof DesignSettings>(key: K) => (v: DesignSettings[K]) =>
    update((x) => { (x.design[key] as DesignSettings[K]) = v; }, { label: 'design.' + String(key) });

  const scale = textScaleOf(d);
  const allFont = d.titleFont === d.bodyFont ? d.titleFont : null;

  return (
    <div className="stack design">
      {/* ---------------- 스타일 ---------------- */}
      <div>
        <span className="field__label">스타일</span>
        <div className="stylecards">
          {(Object.keys(STYLE_PRESET_LABEL) as StylePreset[]).map((key) => {
            const t = DESIGN_PRESETS[key];
            const on = d.preset === key;
            return (
              <button
                key={key}
                className={'stylecard' + (on ? ' is-on' : '')}
                onClick={() => pickStyle(key)}
                aria-pressed={on}
              >
                {/* 실제 값으로 그린 작은 미리보기 — 여백·구분선·사진 모서리·버튼까지 */}
                <span className="stylecard__view" style={{ background: t.background, padding: Math.round(t.padding / 6) }}>
                  <i className="stylecard__title" style={{ fontFamily: FONT_LABEL[t.titleFont].stack, color: t.accent, textAlign: t.align }}>
                    가나다
                  </i>
                  <i className="stylecard__photo" style={{ background: t.primary, borderRadius: Math.min(8, t.photoRadius), opacity: 0.85 }} />
                  {t.divider === 'line' && <i className="stylecard__rule" style={{ background: t.text }} />}
                  <i className="stylecard__price" style={{ justifyContent: t.align === 'left' ? 'flex-start' : 'center' }}>
                    <b style={{ color: t.accent }}>189,000원</b>
                  </i>
                  <i
                    className="stylecard__btn"
                    style={{
                      background: t.primary,
                      borderRadius: t.buttonStyle === 'pill' ? 999 : t.buttonStyle === 'round' ? 5 : 0,
                      alignSelf: t.align === 'left' ? 'flex-start' : 'center',
                    }}
                  />
                </span>
                <b>{STYLE_PRESET_LABEL[key]}</b>
                <em>{STYLE_FEEL[key]}</em>
              </button>
            );
          })}
        </div>
        <p className="field__hint">스타일을 바꾸면 색·글씨·여백·영역 모양이 함께 바뀝니다. 적어두신 글과 사진은 그대로입니다.</p>
      </div>

      {/* ---------------- 글씨체 ---------------- */}
      <div>
        <span className="field__label">글씨체</span>
        <div className="fontchips">
          {FONT_CHOICES.map((f) => (
            <button
              key={f.key}
              className={'fontchip' + (allFont === f.key ? ' is-on' : '')}
              style={{ fontFamily: FONT_LABEL[f.key].stack }}
              onClick={() => update((x) => { setAllFonts(x, f.key); }, { label: 'design.font', merge: false })}
              aria-pressed={allFont === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
        {!allFont && <p className="field__hint">제목과 본문 글씨체를 따로 쓰고 있어요. 하나를 누르면 함께 바뀝니다.</p>}
      </div>

      {/* ---------------- 글자 크기 · 정렬 ---------------- */}
      <div className="row2">
        <div className="field">
          <span className="field__label">글자 크기</span>
          <div className="seg seg--wide">
            {(['sm', 'md', 'lg'] as TextScale[]).map((s) => (
              <button
                key={s}
                className={'seg__btn' + (scale === s ? ' is-on' : '')}
                onClick={() => update((x) => { setTextScale(x, s); }, { label: 'design.scale', merge: false })}
              >
                {TEXT_SCALE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field__label">정렬</span>
          <div className="seg seg--wide">
            {([['left', '왼쪽'], ['center', '가운데']] as const).map(([a, label]) => (
              <button
                key={a}
                className={'seg__btn' + (d.align === a ? ' is-on' : '')}
                onClick={() => update((x) => { x.design.align = a; }, { label: 'design.align', merge: false })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button className="more__btn" onClick={() => setMore((v) => !v)} aria-expanded={more}>
        {more ? '디자인 더 수정하기 접기' : '디자인 더 수정하기'}
      </button>

      {more && (
        <div className="stack">
          <div className="row2">
            <Color label="배경색" value={d.background} onChange={set('background')} />
            <Color label="대표색" value={d.primary} onChange={set('primary')} />
          </div>
          <div className="row2">
            <Color label="강조색" value={d.accent} onChange={set('accent')} />
            <Color label="글자색" value={d.text} onChange={set('text')} />
          </div>

          <Range label="제목 크기" value={d.titleSize} min={20} max={54} onChange={set('titleSize')} unit="px" />
          <Range label="본문 크기" value={d.bodySize} min={13} max={24} onChange={set('bodySize')} unit="px" />
          <Range label="영역 사이 간격" value={d.menuGap} min={20} max={140} onChange={set('menuGap')} unit="px" />
          <Range label="바깥 여백" value={d.padding} min={0} max={80} onChange={set('padding')} unit="px" />
          <Range label="사진 모서리" value={d.photoRadius} min={0} max={40} onChange={set('photoRadius')} unit="px" />

          <div className="row2">
            <Pick
              label="버튼 모양" value={d.buttonStyle} onChange={set('buttonStyle')}
              options={[
                { value: 'square' as ButtonStyle, label: '각진 모서리' },
                { value: 'round' as ButtonStyle, label: '둥근 모서리' },
                { value: 'pill' as ButtonStyle, label: '완전히 둥근' },
              ]}
            />
            <Pick
              label="영역 구분선" value={d.divider ?? 'none'}
              onChange={(v) => update((x) => { x.design.divider = v; }, { label: 'design.divider', merge: false })}
              options={[
                { value: 'none' as const, label: '없음' },
                { value: 'line' as const, label: '가는 선' },
              ]}
            />
          </div>

          <span className="field__label">글씨체 세부 설정</span>
          <div className="row2">
            <Pick
              label="제목 글씨체" value={d.titleFont}
              onChange={(v: FontKey) => update((x) => { x.design.titleFont = v; x.design.fontLocked = true; }, { label: 'design.titleFont', merge: false })}
              options={FONT_KEYS.map((k) => ({ value: k, label: fontName(k) }))}
            />
            <Pick
              label="본문 글씨체" value={d.bodyFont}
              onChange={(v: FontKey) => update((x) => { x.design.bodyFont = v; x.design.fontLocked = true; }, { label: 'design.bodyFont', merge: false })}
              options={FONT_KEYS.map((k) => ({ value: k, label: fontName(k) }))}
            />
          </div>
          {d.fontLocked && (
            <button
              className="linkbtn"
              onClick={() => update((x) => {
                const base = DESIGN_PRESETS[x.design.preset];
                x.design.titleFont = base.titleFont;
                x.design.bodyFont = base.bodyFont;
                x.design.fontLocked = false;
              }, { label: 'design.fontReset', merge: false })}
            >
              스타일에 어울리는 글씨체로 되돌리기
            </button>
          )}

          {isPro && (
            <>
              <button className="more__btn" onClick={() => setRefOpen((v) => !v)}>
                {refOpen ? '참고 캡처 닫기' : '참고 캡처에서 느낌 가져오기 (색·여백만)'}
              </button>
              {refOpen && <ReferenceCapture />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** 글씨체 이름 — 처음 고르는 다섯 개는 쉬운 이름으로 */
function fontName(k: FontKey): string {
  return FONT_CHOICES.find((f) => f.key === k)?.label ?? FONT_LABEL[k].name;
}

/* ------------------------------------------------------------------ */

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="colorrow">
        <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        <input className="mini" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}

function Range({
  label, value, min, max, onChange, unit,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label className="field">
      <span className="field__label">
        {label} <b className="rangeval">{value}{unit}</b>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Pick<T extends string>({
  label, value, onChange, options,
}: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select className="mini" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function toHex(v: string): string {
  return /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : '#ffffff';
}
