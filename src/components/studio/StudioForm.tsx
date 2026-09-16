import type { StudioInfo } from '@/types/studio';

/**
 * ⚠ 입력칸 컴포넌트를 이 함수 **안에서** 만들면 안 된다.
 *   글자를 한 자 칠 때마다 커서가 튕겨 나간다. (실제로 겪은 문제)
 */
function StudioForm({ value, onChange }: { value: StudioInfo; onChange: (v: StudioInfo) => void }) {
  const set = (k: keyof StudioInfo, v: string) => onChange({ ...value, [k]: v });

  return (
    <div className="stack">
      <div className="row2">
        <SField label="사진관명" value={value.name} ph="예) 오늘사진관" onChange={(v) => set('name', v)} />
        <SField label="지역" value={value.area} ph="예) 광명" onChange={(v) => set('area', v)} />
      </div>
      <div className="row2">
        <SField label="전화번호" value={value.phone} ph="예) 02-000-0000" onChange={(v) => set('phone', v)} />
        <SField label="예약링크" value={value.bookingUrl} ph="https://" onChange={(v) => set('bookingUrl', v)} />
      </div>
      <SField label="주소" value={value.address} onChange={(v) => set('address', v)} />
      <div className="row2">
        <SField label="영업시간" value={value.hours} ph="예) 10:00 ~ 19:00" onChange={(v) => set('hours', v)} />
        <SField label="휴무일" value={value.offDays} ph="예) 매주 월요일" onChange={(v) => set('offDays', v)} />
      </div>
      <SField label="SNS" value={value.sns} ph="인스타그램 아이디 등" onChange={(v) => set('sns', v)} />
      <p className="field__hint">
        여기 적은 내용은 가족사진·프로필·증명사진 어디서나 다시 씁니다.
      </p>
    </div>
  );
}

function SField({
  label, value, ph, onChange,
}: { label: string; value: string; ph?: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input className="field__input" value={value} placeholder={ph}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export { StudioForm };
