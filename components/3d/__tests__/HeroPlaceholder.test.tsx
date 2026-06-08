import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeroPlaceholder } from '../HeroPlaceholder';

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));

afterEach(() => vi.restoreAllMocks());

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
});
