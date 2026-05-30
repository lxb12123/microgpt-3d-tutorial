'use client';

export interface ParamSliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (next: number) => void;
}

export function ParamSlider({ label, min, max, step = 1, value, onChange }: ParamSliderProps) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 6, color: '#fff' }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{value}</span>
    </label>
  );
}
