'use client';

// A compact ①→②→③ "do this, in this order" strip shown above each sandbox so a
// first-time reader knows where to start. Theme-aware, wraps on narrow screens.
const CIRCLED = ['①', '②', '③', '④', '⑤'] as const;

export interface StepHintsProps {
  steps: readonly string[];
  scheme: 'light' | 'dark';
}

export function StepHints({ steps, scheme }: StepHintsProps) {
  const light = scheme === 'light';
  return (
    <div
      data-testid="step-hints"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        margin: '0 0 8px',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      {steps.map((s, i) => (
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 999,
            background: light ? 'rgba(37,99,235,0.08)' : 'rgba(96,165,250,0.14)',
            color: light ? '#1e3a8a' : '#cfe0ff',
            border: `1px solid ${light ? 'rgba(37,99,235,0.25)' : 'rgba(96,165,250,0.30)'}`,
          }}
        >
          <b style={{ fontSize: 13, color: light ? '#2563eb' : '#93c5fd' }}>{CIRCLED[i]}</b>
          {s}
        </span>
      ))}
    </div>
  );
}
