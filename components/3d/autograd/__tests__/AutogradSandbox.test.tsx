import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutogradSandbox } from '../AutogradSandbox';

// Heavily mock R3F + drei so jsdom doesn't need WebGL
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
    Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OrbitControls: () => null,
    Instances: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Instance: () => null,
  };
});
vi.mock('../../webgl', () => ({ isWebGLAvailable: () => true }));

describe('AutogradSandbox', () => {
  it('renders the default expression and exposes a variable slider per identifier', () => {
    render(<AutogradSandbox defaultExpression="(a + b) * c" defaultVariables={{ a: 2, b: -3, c: 10 }} />);
    expect(screen.getByDisplayValue('(a + b) * c')).toBeInTheDocument();
    expect(screen.getByLabelText(/^a$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^b$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^c$/)).toBeInTheDocument();
  });

  it('updates the root data display when a slider value changes', () => {
    render(<AutogradSandbox defaultExpression="a + b" defaultVariables={{ a: 1, b: 2 }} />);
    expect(screen.getByText(/root.*=.*3/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^a$/), { target: { value: '10' } });
    expect(screen.getByText(/root.*=.*12/i)).toBeInTheDocument();
  });

  it('shows a "Parse error" card on malformed expressions', () => {
    render(<AutogradSandbox defaultExpression="a + " defaultVariables={{ a: 1 }} />);
    expect(screen.getByText(/parse error/i)).toBeInTheDocument();
  });
});
