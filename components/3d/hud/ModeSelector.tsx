'use client';

export interface ModeSelectorProps<T extends string> {
  items: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}

export function ModeSelector<T extends string>({ items, value, onChange }: ModeSelectorProps<T>) {
  return (
    <div role="radiogroup" style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'rgba(0,0,0,0.5)', borderRadius: 6 }}>
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
              background: active ? '#3b82f6' : 'transparent',
              color: '#fff',
              border: '1px solid #3b82f6',
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
