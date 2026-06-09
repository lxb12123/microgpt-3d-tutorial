import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SandboxLoading } from '../SandboxLoading';

const mockTheme = vi.fn(() => ({ resolvedTheme: 'dark' }));
vi.mock('next-themes', () => ({ useTheme: () => mockTheme() }));

afterEach(() => vi.restoreAllMocks());

describe('SandboxLoading', () => {
  it('uses the dark preview + dark background on the dark theme', () => {
    mockTheme.mockReturnValue({ resolvedTheme: 'dark' });
    render(<SandboxLoading name="overview" height={560} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringMatching(/\/overview\.png$/));
    expect(screen.getByTestId('sandbox-loading')).toHaveStyle({ background: '#0a0a14' });
  });

  it('uses the LIGHT preview + light background on the light theme (no black block)', () => {
    mockTheme.mockReturnValue({ resolvedTheme: 'light' });
    render(<SandboxLoading name="transformer-block" height={560} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringMatching(/\/transformer-block-light\.png$/));
    expect(screen.getByTestId('sandbox-loading')).toHaveStyle({ background: '#f4f5f7' });
  });
});
