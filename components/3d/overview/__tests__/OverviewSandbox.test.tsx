import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverviewSandbox } from '../OverviewSandbox';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
}));
vi.mock('@react-three/drei', () => {
  // `useGLTF` is a callable plus a `.preload` static — primitives call
  // `useGLTF.preload(URL)` at module load time. Without this static the mock
  // throws on import of `MatrixGrid`, before any test body runs.
  const useGLTF = Object.assign(
    () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
    { preload: () => {} },
  );
  return {
    useGLTF,
    Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OrbitControls: () => null,
    Instances: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Instance: () => null,
  };
});
vi.mock('../../webgl', () => ({ isWebGLAvailable: () => true }));
vi.mock('@/src/inference/weights', () => ({
  loadWeights: async () => ({
    _vocab: ['.', 'a', 'n', 'b', 'c', 'd'],
    _vocab_size: 7,
    wte: Array.from({ length: 7 }, () => Array(16).fill(0.01)),
    wpe: Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wq': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wk': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wv': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.attn_wo': Array.from({ length: 16 }, () => Array(16).fill(0.01)),
    'layer0.mlp_fc1': Array.from({ length: 64 }, () => Array(16).fill(0.01)),
    'layer0.mlp_fc2': Array.from({ length: 16 }, () => Array(64).fill(0.01)),
    lm_head: Array.from({ length: 7 }, () => Array(16).fill(0.01)),
  }),
  _resetWeightsForTest: () => {},
}));

describe('OverviewSandbox', () => {
  it('renders mode toggle and three presets', async () => {
    render(<OverviewSandbox defaultText="anna" />);
    await waitFor(() => expect(screen.getByDisplayValue('anna')).toBeInTheDocument());
    expect(screen.getByText(/forward/i)).toBeInTheDocument();
    expect(screen.getByText(/loss/i)).toBeInTheDocument();
    expect(screen.getByText(/sample/i)).toBeInTheDocument();
    expect(screen.getByText('emma')).toBeInTheDocument();
    expect(screen.getByText('jacob')).toBeInTheDocument();
  });

  it('truncates input beyond 10 chars', async () => {
    render(<OverviewSandbox defaultText="anna" />);
    const input = await waitFor(() => screen.getByDisplayValue('anna'));
    fireEvent.change(input, { target: { value: 'abcdefghijklmno' } });
    expect((input as HTMLInputElement).value.length).toBeLessThanOrEqual(10);
  });
});
