import { useState } from 'react';
import { useProject } from '@/store/ProjectStore';
import { FONT_KEYS, FONT_SAMPLE } from '@/config/fonts';
import { FONT_LABEL, type AlignStyle, type FontKey } from '@/types/project';
import { DESIGN_PRESETS } from '@/types/defaults';
import { ensureFonts } from '@/services/fonts/loadFont';
import { Icon } from '@/components/ui/Icon';

/**
 * 글 쓰는 자리 바로 옆에 두는 작은 글씨 도구막대.
 *
 * ⚠ 글꼴 기능을 새로 만든 것이 아니다.
 *   ④ 디자인의 글꼴·크기와 **같은 값**을 고칠 뿐이다 (`design.titleFont` 등).
 *   여기서 바꾸면 ④ 디자인에도 그대로 보이고, 미리보기와 저장 이미지에도 같이 적용된다.
 *
 * 크기는 숫자를 몰라도 되도록 **제목 · 소제목 · 본문** 세 가지로 먼저 고른다.
 * 숫자를 직접 맞추고 싶은 분을 위해 `직접` 도 그대로 남겨두었다.
 */

/** 지금 고른 간편 스타일의 **실제 값**에서 세 가지 크기를 가져온다 (새 숫자를 지어내지 않는다) */
function sizesOf(preset: keyof typeof DESIGN_PRESETS) {
  const base = DESIGN_PRESETS[preset];
  return {
    title: base.titleSize,
    sub: Math.round(base.titleSize * 0.78),
    body: base.bodySize,
  };
}

type SizeKey = 'title' | 'sub' | 'body';

const SIZE_LABEL: Record<SizeKey, string> = { title: '제목', sub: '소제목', body: '본문' };

export function TextToolbar({ target = 'title' }: { target?: 'title' | 'body' }) {
  const { project, update } = useProject();
  const d = project.design;
  const [openFont, setOpenFont] = useState(false);
  const [openSize, setOpenSize] = useState(false);

  const font = target === 'title' ? d.titleFont : d.bodyFont;
  const size = target === 'title' ? d.titleSize : d.bodySize;
  const bold = target === 'title' ? d.titleBold !== false : !!d.bodyBold;
  const sizes = sizesOf(d.preset);

  /** 글꼴은 제목·본문에 함께 적용한다 (④ 디자인과 같은 방식) */
  const pickFont = (k: FontKey) => {
    update((x) => {
      x.design.titleFont = k;
      x.design.bodyFont = k;
      x.design.fontLocked = true;
    }, { label: 'design.font', merge: false });
    setOpenFont(false);
  };

  const setSize = (v: number) => {
    const next = Math.max(12, Math.min(64, v));
    update((x) => {
      if (target === 'title') x.design.titleSize = next;
      else x.design.bodySize = next;
    }, { label: 'design.size' });
  };

  /** 제목 · 소제목 · 본문 — 누르는 즉시 적용된다 */
  const pickPreset = (k: SizeKey) =>
    update((x) => {
      if (k === 'body') x.design.bodySize = sizes.body;
      else x.design.titleSize = k === 'title' ? sizes.title : sizes.sub;
    }, { label: 'design.sizePreset', merge: false });

  /** 지금 크기가 어느 것과 같은지 — 같으면 그 단추를 켜진 것으로 보여준다 */
  const activePreset: SizeKey | null =
    d.titleSize === sizes.title ? 'title'
      : d.titleSize === sizes.sub ? 'sub'
      : d.bodySize === sizes.body ? 'body'
      : null;

  const toggleBold = () =>
    update((x) => {
      if (target === 'title') x.design.titleBold = !(x.design.titleBold !== false);
      else x.design.bodyBold = !x.design.bodyBold;
    }, { label: 'design.bold', merge: false });

  const setAlign = (a: AlignStyle) =>
    update((x) => { x.design.align = a; }, { label: 'design.align', merge: false });

  /** 목록을 펼칠 때 글꼴을 받아온다 — 실제 글씨 모양으로 보여주기 위해 */
  const toggleFont = () => {
    if (!openFont) ensureFonts(FONT_KEYS);
    setOpenFont((v) => !v);
  };

  return (
    <div className="ttbar">
      {/* 전체 기본 글꼴 — 이 상세페이지 전체에 적용된다 */}
      <div className="ttbar__font">
        <button
          className="ttbar__btn ttbar__btn--wide"
          onClick={toggleFont}
          aria-expanded={openFont}
          title="전체 기본 글꼴 고르기"
        >
          <span style={{ fontFamily: FONT_LABEL[font].stack }}>{FONT_LABEL[font].name}</span>
          <Icon name="chevronDown" size={13} />
        </button>

        {openFont && (
          <>
            <div className="ttbar__mask" onClick={() => setOpenFont(false)} />
            <div className="ttbar__list">
              <p className="ttbar__head">전체 기본 글꼴 — 상세페이지 전체가 바뀝니다</p>
              {FONT_KEYS.map((k) => (
                <button
                  key={k}
                  className={'ttbar__item' + (k === font ? ' is-on' : '')}
                  onClick={() => pickFont(k)}
                  style={{ fontFamily: FONT_LABEL[k].stack }}
                >
                  <b>{FONT_LABEL[k].name}</b>
                  <span>{FONT_SAMPLE}</span>
                  <em>{FONT_LABEL[k].feel}</em>
                </button>
              ))}
              <p className="ttbar__foot">
                한 곳의 글자만 바꾸려면 <b>구성 → 그 섹션 → 디자인 변경</b>에서 골라주세요.
              </p>
            </div>
          </>
        )}
      </div>

      {/* 크기 — 숫자를 몰라도 되도록 세 가지로 */}
      <div className="ttbar__preset">
        {(['title', 'sub', 'body'] as SizeKey[]).map((k) => (
          <button
            key={k}
            className={'ttbar__btn' + (activePreset === k ? ' is-on' : '')}
            onClick={() => pickPreset(k)}
            title={`${SIZE_LABEL[k]} 크기로`}
          >
            {SIZE_LABEL[k]}
          </button>
        ))}
        <button
          className={'ttbar__btn' + (openSize ? ' is-on' : '')}
          onClick={() => setOpenSize((v) => !v)}
          title="숫자로 직접 맞추기"
        >직접</button>
      </div>

      {/* 직접 맞추기 — 눌렀을 때만 나온다 */}
      {openSize && (
        <div className="ttbar__size">
          <button className="ttbar__btn" onClick={() => setSize(size - 1)} title="글씨 작게" aria-label="글씨 작게">−</button>
          <input
            type="number"
            value={size}
            onChange={(e) => setSize(Number(e.target.value) || size)}
            aria-label={target === 'title' ? '제목 글씨 크기' : '본문 글씨 크기'}
          />
          <button className="ttbar__btn" onClick={() => setSize(size + 1)} title="글씨 크게" aria-label="글씨 크게">+</button>
        </div>
      )}

      {/* 굵게 */}
      <button
        className={'ttbar__btn ttbar__btn--bold' + (bold ? ' is-on' : '')}
        onClick={toggleBold}
        title="굵게"
        aria-label="굵게"
        aria-pressed={bold}
      >B</button>

      <div className="ttbar__align">
        {([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] as const).map(([a, label]) => (
          <button
            key={a}
            className={'ttbar__btn' + (d.align === a ? ' is-on' : '')}
            onClick={() => setAlign(a)}
            title={`${label} 정렬`}
            aria-label={`${label} 정렬`}
            aria-pressed={d.align === a}
          >
            <span className={'alignmark alignmark--' + a} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
