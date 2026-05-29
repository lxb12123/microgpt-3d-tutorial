import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneViewer } from '../SceneViewer';
import * as webgl from '../webgl';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SceneViewer', () => {
  it('renders the HUD slot when WebGL is available', () => {
    vi.spyOn(webgl, 'isWebGLAvailable').mockReturnValue(true);

    render(
      <SceneViewer height="400px" fallbackImage="/fallback.png" hud={<div>HUD</div>}>
        <mesh />
      </SceneViewer>
    );

    expect(screen.getByText('HUD')).toBeInTheDocument();
  });

  it('applies the provided height to its outer container', () => {
    vi.spyOn(webgl, 'isWebGLAvailable').mockReturnValue(true);

    const { container } = render(
      <SceneViewer height="640px" fallbackImage="/fallback.png">
        <mesh />
      </SceneViewer>
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.style.height).toBe('640px');
  });
});
