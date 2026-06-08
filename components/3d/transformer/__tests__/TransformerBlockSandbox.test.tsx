import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransformerBlockSandbox } from '../TransformerBlockSandbox';

// R3F/drei are mocked so the scene tree renders inert in jsdom; the detail panel
// is plain HTML, so we assert behaviour against it.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
  useThree: () => ({ camera: {}, size: { width: 800, height: 560 }, get: () => ({ camera: {}, controls: null }) }),
}));
vi.mock('@react-three/drei', () => {
  const useGLTF = Object.assign(
    () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
    { preload: () => {} },
  );
  return {
    useGLTF,
    Billboard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Line: () => null,
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OrbitControls: () => null,
  };
});
vi.mock('../../webgl', () => ({ isWebGLAvailable: () => true }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));

afterEach(() => vi.restoreAllMocks());

describe('TransformerBlockSandbox', () => {
  it('renders the detail panel for the first stage (Embedding) by default', () => {
    render(<TransformerBlockSandbox autoplay={false} />);
    // the group tag (lowercase) is unique to the panel
    expect(screen.getByText('embedding')).toBeInTheDocument();
    // the exact python slice for the embedding lookup, in the <pre>
    expect(
      screen.getByText(
        (_content, el) =>
          el?.tagName === 'PRE' && el.textContent!.includes("state_dict['wte'][token_id]"),
      ),
    ).toBeInTheDocument();
  });

  it('exposes a play/pause control', () => {
    render(<TransformerBlockSandbox autoplay={false} />);
    expect(screen.getByRole('button', { name: /play|pause/i })).toBeInTheDocument();
  });
});
