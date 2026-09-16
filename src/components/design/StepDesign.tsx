import { useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { useEdition } from '@/store/EditionContext';
import { ReferenceCapture } from './ReferenceCapture';
import { DESIGN_PRESETS } from '@/types/defaults';
import {
  FONT_LABEL, STYLE_PRESET_LABEL,
  type AlignStyle, type ButtonStyle, type DesignSettings, type FontKey, type StylePreset,
} from '@/types/project';
import { FONT_KEYS, FONT_SAMPLE } from '@/config/fonts';
import { ensureFonts } from '@/services/fonts/loadFont';

/** ④ 디자인 — 간편 스타일 + 세부 설정 2단계 */
export function StepDesign() {
  const { project, update } = useProject();
  const { isPro } = useEdition();
  const d = project.design;
  const [detail, setDetail] = useState(false);
  const [refOpen, setRefOpen] = useState(false);

  /* 간편 스타일을 바꿔도 사용자가 직접 고른 글꼴은 그대로 둔다 */
  const applyPreset = (key: StylePreset) =>
    update((x) => {
      const keepFont = x.design.fontLocked;
      const before = { titleFont: x.design.titleFont, bodyFont: x.design.bodyFont };
      x.design = { ...DESIGN_PRESETS[key] };
      if (keepFont) {
        x.design.titleFont = before.titleFont;
        x.design.bodyFont = before.bodyFont;
        x.design.fontLocked = true;
      }
    }, { label: 'design.preset', merge: false });

  /** 글꼴 하나로 제목·본문을 함께 바꾼다 (어렵지 않게) */
  const pickFont = (key: FontKey) =>
    update((x) => {
      x.design.titleFont = key;
      x.design.bodyFont = key;
      x.design.fontLocked = true;
    }, { label: 'design.font', merge: false });

  /* 고르기 화면에서 글꼴을 비교할 수 있도록 다섯 개를 미리 받아둔다 */
  ensureFonts(FONT_KEYS);

  const set = <K extends keyof DesignSettings>(key: K) => (v: DesignSettings[K]) =>
    update((x) => { (x.design[key] as DesignSettings[K]) = v; }, { label: 'design.' + String(key) });

  return (
    <div className="stack">
      <div>
        <span className="field__label">간편 스타일</span>
        <div className="stylecards">
          {(Object.keys(STYLE_PRESET_LABEL) as StylePreset[]).map((key) => {
            const t = DESIGN_PRESETS[key];
            return (
              <button
                key={key}
                className={'stylecard' + (d.preset === key ? ' is-on' : '')}
                onClick={() => applyPreset(key)}
                title={`${FONT_LABEL[t.titleFont].name} · 사진 모서리 ${t.photoRadius}px`}
              >
                {/* 실제 값으로 그린 작은 미리보기 */}
                <span className="stylecard__view" style={{ background: t.background }}>
                  <i
                    className="stylecard__title"
                    style={{ fontFamily: FONT_LABEL[t.titleFont].stack, color: t.accent }}
                  >
                    가나다
                  </i>
                  <i className="stylecard__photo" style={{ background: t.primary, borderRadius: t.photoRadius }} />
                  {/* 가격 한 줄 — 사진·제목·가격·버튼이 다 보여야 실제 느낌이 온다 */}
                  <i className="stylecard__price">
                    <s style={{ color: t.text }}>250,000</s>
                    <b style={{ color: t.accent }}>189,000원</b>
                  </i>
                  <i
                    className="stylecard__btn"
                    style={{
                      background: t.primary,
                      borderRadius: t.buttonStyle === 'pill' ? 999 : t.buttonStyle === 'round' ? 6 : 0,
                    }}
                  />
                </span>
                <b>{STYLE_PRESET_LABEL[key]}</b>
                <em>{FONT_LABEL[t.titleFont].feel}</em>
              </button>
            );
          })}
        </div>
        <p className="field__hint">
          스타일을 고르면 색상·글씨·여백이 함께 바뀝니다. 카드의 작은 그림이 실제 색과 모양입니다.
        </p>
      </div>

      {isPro && (
        <>
          <button className="more__btn" onClick={() => setRefOpen((v) => !v)}>
            {refOpen ? '참고 캡처 닫기' : '참고 캡처에서 느낌 가져오기 (색·여백만)'}
          </button>
          {refOpen && <ReferenceCapture />}
        </>
      )}

      {/* ---------------- 글꼴 ---------------- */}
      <div>
        <span className="field__label">글꼴</span>
        <div className="fontlist">
          {FONT_KEYS.map((k) => {
            const on = d.bodyFont === k && d.titleFont === k;
            return (
              <button
                key={k}
                className={'fontcard' + (on ? ' is-on' : '')}
                onClick={() => pickFont(k)}
                style={{ fontFamily: FONT_LABEL[k].stack }}
              >
                <b>
                  {on && <i className="fontcard__check" aria-hidden>✓</i>}
                  {FONT_LABEL[k].name}
                  <em>{FONT_LABEL[k].feel}</em>
                </b>
                <span className="fontcard__sample">{FONT_SAMPLE}</span>
              </button>
            );
          })}
        </div>
        <p className="field__hint">
          제목과 본문에 함께 적용됩니다. 미리보기·저장 이미지에도 같은 글꼴이 쓰입니다.
          {d.fontLocked && (
            <>
              <br />
              직접 고르셨으므로 간편 스타일을 바꿔도 이 글꼴이 유지됩니다.{' '}
              <button
                className="linkbtn"
                onClick={() => update((x) => {
                  const base = DESIGN_PRESETS[x.design.preset];
                  x.design.titleFont = base.titleFont;
                  x.design.bodyFont = base.bodyFont;
                  x.design.fontLocked = false;
                }, { label: 'design.fontReset', merge: false })}
              >
                스타일 추천 글꼴로 되돌리기
              </button>
            </>
          )}
        </p>
      </div>

      <button className="more__btn" onClick={() => setDetail((v) => !v)}>
        {detail ? '세부 설정 접기' : '세부 설정 열기'}
      </button>

      {detail && (
        <div className="stack">
          <div className="row2">
            <Color label="배경색" value={d.background} onChange={set('background')} />
            <Color label="대표색" value={d.primary} onChange={set('primary')} />
          </div>
          <div className="row2">
            <Color label="강조색" value={d.accent} onChange={set('accent')} />
            <Color label="글자색" value={d.text} onChange={set('text')} />
          </div>

          {!isPro && (
            <p className="field__hint">
              글씨·여백·버튼 같은 자세한 설정은 PRO에서 쓸 수 있어요.
            </p>
          )}

          {isPro && (
          <>
          <Range label="제목 크기" value={d.titleSize} min={20} max={54} onChange={set('titleSize')} unit="px" />
          <Range label="본문 크기" value={d.bodySize} min={13} max={24} onChange={set('bodySize')} unit="px" />
          <Range label="메뉴 간격" value={d.menuGap} min={20} max={140} onChange={set('menuGap')} unit="px" />
          <Range label="여백" value={d.padding} min={0} max={80} onChange={set('padding')} unit="px" />
          <Range label="사진 모서리" value={d.photoRadius} min={0} max={40} onChange={set('photoRadius')} unit="px" />

          <div className="row2">
            <Pick
              label="제목 글꼴" value={d.titleFont} onChange={(v) => { set('titleFont')(v); set('fontLocked' as never)(true as never); }}
              options={FONT_KEYS.map((k) => ({ value: k, label: FONT_LABEL[k].name }))}
            />
            <Pick
              label="본문 글꼴" value={d.bodyFont} onChange={(v) => { set('bodyFont')(v); set('fontLocked' as never)(true as never); }}
              options={FONT_KEYS.map((k) => ({ value: k, label: FONT_LABEL[k].name }))}
            />
          </div>

          <div className="row2">
            <Pick
              label="버튼 모양" value={d.buttonStyle} onChange={set('buttonStyle')}
              options={[
                { value: 'round' as ButtonStyle, label: '둥근 모서리' },
                { value: 'square' as ButtonStyle, label: '각진 모서리' },
                { value: 'pill' as ButtonStyle, label: '완전히 둥근' },
              ]}
            />
            <Pick
              label="정렬" value={d.align} onChange={set('align')}
              options={[
                { value: 'center' as AlignStyle, label: '가운데' },
                { value: 'left' as AlignStyle, label: '왼쪽' },
              ]}
            />
          </div>

          <p className="field__hint">
            제목과 본문을 따로 정하고 싶을 때만 쓰세요. 글꼴은 상업적으로 쓸 수 있는 것만 넣었습니다.
          </p>
          </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="colorrow">
        <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} />
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
