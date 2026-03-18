export default function LoginScreen({ onSignIn, loading, error }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(145deg, #0439A0 0%, #0B5FCC 55%, #1A80E8 100%)',
      fontFamily: 'var(--sans)',
      padding: 24,
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 20,
        boxShadow: '0 20px 60px rgba(4, 57, 160, 0.35)',
        padding: '48px 44px',
        width: '100%',
        maxWidth: 420,
        animation: 'fadeSlideIn 0.4s ease',
      }}>
        {/* Logo mark */}
        <div style={{
          width: 56, height: 56,
          background: 'linear-gradient(135deg, #0648B3, #1A80E8)',
          borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(6, 72, 179, 0.35)',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#262B40', marginBottom: 4, letterSpacing: -0.5 }}>
          VélezReyes+
        </h1>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#66799E', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 28 }}>
          Drive Search
        </p>

        <p style={{ fontSize: 15, color: '#66799E', lineHeight: 1.65, marginBottom: 32 }}>
          Search files, contents, and metadata across your Shared Drive — with instant filters and direct links.
        </p>

        {error && (
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: 'var(--danger)',
            background: 'var(--danger-light)',
            border: '1px solid #FECACA',
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={onSignIn}
          disabled={loading}
          style={{
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '13px 24px',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'var(--sans)',
            background: loading ? '#BFD0E8' : '#0648B3',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 10,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'background 0.15s, transform 0.1s, box-shadow 0.15s',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(6, 72, 179, 0.35)',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#0B5FCC'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#0648B3'; }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {!loading && (
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? 'Connecting...' : 'Sign in with Google'}
        </button>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20, textAlign: 'center', lineHeight: 1.6 }}>
          Read-only access · Nothing is modified
        </p>
      </div>
    </div>
  );
}
