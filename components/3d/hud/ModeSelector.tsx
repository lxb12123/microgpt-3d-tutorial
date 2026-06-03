'use client';

export interface ModeSelectorProps<T extends string> {
  items: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  /** 'light' restyles for a light HUD (default 'dark' keeps the original look). */
  variant?: 'dark' | 'light';
}

export function ModeSelector<T extends string>({ items, value, onChange, variant = 'dark' }: ModeSelectorProps<T>) {
  const light = variant === 'light';
  const accent = light ? '#2563eb' : '#3b82f6';
  return (
    <div role="radiogroup" style={{ display: 'inline-flex', gap: 4, padding: 4, background: light ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.5)', border: light ? '1px solid rgba(100,116,139,0.28)' : 'none', borderRadius: 6 }}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            style={{
              padding: '4px 10px',
              background: active ? accent : 'transparent',
              color: active ? '#fff' : light ? '#0f172a' : '#fff',
              border: `1px solid ${active ? accent : light ? 'rgba(100,116,139,0.4)' : accent}`,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
