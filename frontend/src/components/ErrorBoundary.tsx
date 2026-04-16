import React, { Component } from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Page crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '48px 32px',
          textAlign: 'center',
          maxWidth: 500,
          margin: '0 auto',
        }}>
          <span className="material-icons" style={{
            fontSize: 64,
            color: 'var(--color-error)',
            display: 'block',
            marginBottom: 16,
          }}>error_outline</span>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 14, marginBottom: 24 }}>
            This page encountered an error. Try refreshing or navigating to a different page.
          </p>
          {this.state.error && (
            <details style={{
              textAlign: 'left',
              background: 'var(--surface-container)',
              padding: 16,
              borderRadius: 'var(--border-radius-md)',
              marginBottom: 16,
            }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Error details</summary>
              <pre style={{
                fontSize: 12,
                color: 'var(--color-error)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginTop: 8,
              }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            className="vn-btn vn-btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
