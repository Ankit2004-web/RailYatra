import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-shell" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p className="muted" style={{ margin: '1rem 0 1.5rem' }}>
            An unexpected error occurred. Please refresh or return home.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Refresh page
            </button>
            <a href="/home" className="btn btn-outline">Go to Home</a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
