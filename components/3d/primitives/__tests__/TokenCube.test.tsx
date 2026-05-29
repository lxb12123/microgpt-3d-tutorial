import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TokenCube } from '../TokenCube';

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

describe('TokenCube', () => {
  it('renders the character label', () => {
    render(<TokenCube position={[0, 0, 0]} char="a" color="#88ccff" />);
    expect(screen.getByTestId('html')).toHaveTextContent('a');
  });
});
