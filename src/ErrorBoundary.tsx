import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * There's no devtools on-device — a render throw with no boundary just
 * blanks the whole 800x480 screen. This keeps a crash to one screen and
 * offers the only recovery a kiosk display has: reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[deskbar] unhandled render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="screen center error-screen">
          <div className="error-title">Deskbar hit a snag</div>
          <div className="hint">{this.state.error.message || 'Something went wrong.'}</div>
          <button className="btn-primary error-reload" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
