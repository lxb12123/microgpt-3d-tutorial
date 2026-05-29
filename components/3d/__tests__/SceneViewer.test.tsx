import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneViewer } from '../SceneViewer';
import * as webgl from '../webgl';

// Make Canvas a thin wrapper that renders children directly in the React DOM
// tree so that (a) ThrowingChild throws within the outer reconciler and our
// SceneErrorBoundary can catch it, and (b) three-fiber hooks stay silent.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
}));

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

describe('SceneViewer · WebGL fallback', () => {
  it('renders the fallback image with descriptive alt text when WebGL is unavailable', () => {
    vi.spyOn(webgl, 'isWebGLAvailable').mockReturnValue(false);

    render(
      <SceneViewer height="400px" fallbackImage="/microgpt-3d-tutorial/models/previews/test.png">
        <mesh />
      </SceneViewer>
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/microgpt-3d-tutorial/models/previews/test.png');
    expect(img).toHaveAttribute('alt', expect.stringMatching(/static preview/i));
  });
});

function ThrowingChild(): React.ReactElement {
  throw new Error('boom');
}

describe('SceneViewer · ErrorBoundary', () => {
  it('renders an error card when a child throws during render', () => {
    vi.spyOn(webgl, 'isWebGLAvailable').mockReturnValue(true);
    // Silence React's expected console.error for this test
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <SceneViewer height="400px" fallbackImage="/microgpt-3d-tutorial/models/previews/test.png">
        <ThrowingChild />
      </SceneViewer>
    );

    expect(screen.getByText(/3D scene failed to load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();

    errSpy.mockRestore();
  });
});
