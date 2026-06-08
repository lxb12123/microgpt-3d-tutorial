import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrainingSandbox } from '../TrainingSandbox';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
  useThree: (sel?: (s: unknown) => unknown) => {
    const state = { camera: { fov: 42, position: { z: 9.5 } }, size: { width: 800, height: 560 } };
    return sel ? sel(state) : state;
  },
}));
vi.mock('@react-three/drei', () => {
  const useGLTF = Object.assign(
    () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
    { preload: () => {} },
  );
  return {
    useGLTF,
    Billboard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OrbitControls: () => null,
  };
});
vi.mock('../../webgl', () => ({ isWebGLAvailable: () => true }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));

const mk = (rows: number, cols: number, base: number) =>
  Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => base + 0.01 * Math.sin(r * 1.3 + c * 0.7)));
vi.mock('@/src/inference/weights', () => ({
  loadWeights: async () => ({
    _vocab: ['.', 'a', 'b', 'c', 'd', 'e', 'm', 'n', 'o'],
    _vocab_size: 10,
    wte: mk(10, 16, 0.02), wpe: mk(16, 16, 0.015),
    'layer0.attn_wq': mk(16, 16, 0.03), 'layer0.attn_wk': mk(16, 16, 0.03),
    'layer0.attn_wv': mk(16, 16, 0.03), 'layer0.attn_wo': mk(16, 16, 0.03),
    'layer0.mlp_fc1': mk(64, 16, 0.02), 'layer0.mlp_fc2': mk(16, 64, 0.02),
    lm_head: mk(10, 16, 0.04),
  }),
}));

afterEach(() => vi.restoreAllMocks());

describe('TrainingSandbox', () => {
  it('defaults to Generate mode and explains temperature', async () => {
    render(<TrainingSandbox defaultDoc="emma" />);
    expect(await screen.findByTestId('generate-panel')).toBeInTheDocument();
    expect(screen.getByText(/sharpens onto the likeliest/i)).toBeInTheDocument();
    // temperature slider present (disambiguated from the timeline scrubber by name)
    expect(screen.getByRole('slider', { name: /temperature/i })).toBeInTheDocument();
  });

  it('switches to Train mode and shows a real Adam update for one LM-head parameter', async () => {
    render(<TrainingSandbox defaultDoc="anna" />);
    await screen.findByTestId('generate-panel');
    fireEvent.click(screen.getByRole('radio', { name: 'Train' }));
    const panel = await screen.findByTestId('train-panel');
    expect(panel).toHaveTextContent(/mean cross-entropy/i);
    expect(panel).toHaveTextContent(/lm_head\[\d+\]\[\d+\]/);
    // the real Adam formula lines are present
    expect(panel).toHaveTextContent(/Δ = -lr_t/);
  });
});
