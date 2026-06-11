import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroPlaceholder, HeroStagePreview } from '../HeroPlaceholder';

describe('HeroPlaceholder', () => {
  it('renders an immediate, accessible skeleton (no bare blank box)', () => {
    render(<HeroPlaceholder />);
    expect(screen.getByTestId('hero-skeleton')).toBeInTheDocument();
    // accessible: announced as a labelled image region while loading
    expect(screen.getByRole('img', { name: /loading the microGPT/i })).toBeInTheDocument();
  });

  it('reserves the hero height so the swap to canvas does not shift layout', () => {
    render(<HeroPlaceholder />);
    expect(screen.getByTestId('hero-skeleton')).toHaveStyle({ height: '440px' });
  });

  it('resolves its theme in CSS (html.dark), never in post-hydration JS', () => {
    render(<HeroPlaceholder />);
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent)
      .join('\n');
    // Both theme rules ship in the static HTML, keyed off the class
    // next-themes sets on <html> before first paint — so the first painted
    // frame is already the visitor's theme (no dark flash for light users).
    expect(css).toContain('hero-light.png');
    expect(css).toMatch(/html\.dark[^{]*\{[^}]*hero-dark\.png/s);
    // No JS-chosen <img>: the wrong-theme preview can never flash in.
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('HeroStagePreview', () => {
  it('renders the loading pill so SceneViewer can reuse it as a canvas overlay', () => {
    render(
      <div style={{ position: 'relative' }}>
        <HeroStagePreview />
      </div>,
    );
    expect(screen.getByTestId('hero-stage-preview')).toBeInTheDocument();
    expect(screen.getByText(/loading interactive scene/i)).toBeInTheDocument();
  });
});
