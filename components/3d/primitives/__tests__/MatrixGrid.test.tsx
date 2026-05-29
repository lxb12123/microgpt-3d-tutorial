import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MatrixGrid } from '../MatrixGrid';

vi.mock('@react-three/drei', () => {
  const useGLTF = Object.assign(
    () => ({
      scene: {
        traverse: (cb: (obj: { isMesh?: boolean; geometry?: unknown; material?: unknown }) => void) => {
          cb({ isMesh: true, geometry: {}, material: {} });
        },
      },
    }),
    { preload: () => {} },
  );
  return {
    useGLTF,
    Instances: ({ children }: { children: React.ReactNode }) => <div data-testid="instances">{children}</div>,
    Instance: () => <div data-testid="instance" />,
  };
});

describe('MatrixGrid', () => {
  it('renders rows × cols instances', () => {
    const values = [
      [0.1, 0.5, 0.9],
      [0.2, 0.4, 0.8],
    ];
    const { getAllByTestId } = render(<MatrixGrid rows={2} cols={3} values={values} />);
    expect(getAllByTestId('instance')).toHaveLength(6);
  });

  it('rejects mismatched values shape with an error', () => {
    // Silence the expected React error log for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<MatrixGrid rows={2} cols={3} values={[[0, 0]]} />)).toThrow(/shape/i);
    spy.mockRestore();
  });
});
