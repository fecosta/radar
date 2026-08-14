import { Component } from 'react';

/* Error boundaries have to be class components — there is no hook equivalent.
   One is mounted per tab so a throw in Classify cannot white-screen Search. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const where = this.props.label ? ` in ${this.props.label}` : '';
    console.error(`Unhandled error${where}:`, error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const where = this.props.label || 'this area';

    return (
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
        padding: 28,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 12px',
          background: 'var(--danger-light)',
          borderRadius: 20,
          marginBottom: 14,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={{
            fontSize: 11, fontWeight: 800,
            color: 'var(--danger)',
            letterSpacing: 0.9, textTransform: 'uppercase',
            fontFamily: 'var(--sans)',
          }}>
            Something went wrong
          </span>
        </div>

        <p style={{
          fontSize: 14, color: 'var(--text-secondary)',
          fontFamily: 'var(--sans)', lineHeight: 1.55,
          marginBottom: 8,
        }}>
          An unexpected error occurred in {where}. The rest of the app is still usable.
        </p>

        <p style={{
          fontSize: 12, color: 'var(--text-muted)',
          fontFamily: 'var(--mono)', wordBreak: 'break-word',
          marginBottom: 18,
        }}>
          {String(error?.message || error)}
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '7px 16px',
              fontSize: 12, fontWeight: 700,
              fontFamily: 'var(--sans)',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '7px 16px',
              fontSize: 12, fontWeight: 700,
              fontFamily: 'var(--sans)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-xs)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
