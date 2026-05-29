import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeBlock } from '../NodeBlock';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: () => {},
  useThree: () => ({ camera: { position: { x: 0, y: 0, z: 5 } } }),
}));
vi.mock('@react-three/drei', () => {
  const useGLTF = Object.assign(
    () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
    { preload: () => {} },
  );
  return {
    useGLTF,
    Html: ({ children }: { children: React.ReactNode }) => <div data-testid="html">{children}</div>,
  };
});

afterEach(() => vi.restoreAllMocks());

describe('NodeBlock', () => {
  it('renders an html label when provided', () => {
    render(<NodeBlock position={[0, 0, 0]} label="x" color="#ff0000" />);
    expect(screen.getByTestId('html')).toHaveTextContent('x');
  });

  it('omits the label slot when label prop is absent', () => {
    render(<NodeBlock position={[0, 0, 0]} color="#ff0000" />);
    expect(screen.queryByTestId('html')).toBeNull();
  });

  it('renders with reactiveColor prop without crashing', () => {
    // Smoke test: the reactive-color codepath introduces useThree + extra
    // useMemo Color allocations; verify the component still mounts cleanly.
    render(<NodeBlock position={[0, 0, 0]} label="x" color="#52525b" reactiveColor />);
    expect(screen.getByTestId('html')).toHaveTextContent('x');
  });
});
