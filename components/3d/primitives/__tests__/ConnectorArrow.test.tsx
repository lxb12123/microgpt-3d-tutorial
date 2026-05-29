import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorArrow } from '../ConnectorArrow';

vi.mock('@react-three/drei', () => {
  const useGLTF = Object.assign(
    () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
    { preload: () => {} },
  );
  return { useGLTF };
});

describe('ConnectorArrow', () => {
  it('renders without crashing for forward direction', () => {
    const { container } = render(
      <ConnectorArrow from={[0, 0, 0]} to={[1, 0, 0]} color="#00ff00" direction="fwd" />
    );
    expect(container).toBeTruthy();
  });

  it('accepts the bwd direction without crashing', () => {
    const { container } = render(
      <ConnectorArrow from={[0, 0, 0]} to={[0, 1, 0]} color="#ff8800" direction="bwd" />
    );
    expect(container).toBeTruthy();
  });
});
