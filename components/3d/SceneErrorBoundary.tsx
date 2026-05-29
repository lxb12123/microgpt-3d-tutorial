'use client';

import { Component, type ReactNode } from 'react';

interface State {
  hasError: boolean;
}

export class SceneErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Surface to dev tools; do not crash the page.
    console.error('[SceneViewer] caught error in 3D subtree:', error);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            gap: 8,
            background: '#fff7f7',
            border: '1px solid #f5c2c2',
            borderRadius: 8,
          }}
        >
          <p>3D scene failed to load.</p>
          <button type="button" onClick={this.handleReload}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
