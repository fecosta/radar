import React from 'react';

export default function LoginScreen({ onSignIn, loading, error }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      fontFamily: "'IBM Plex Sans', sans-serif",
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: 420,
        padding: 40,
      }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "'IBM Plex Mono', monospace",
          color: 'var(--accent)',
          marginBottom: 4,
        }}>
          Vélezreyes+
        </h1>
        <p style={{
          fontSize: 13,
          fontFamily: "'IBM Plex Mono', monospace",
          color: 'var(--text-secondary)',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 32,
        }}>
          Drive Search
        </p>

        <p style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: 32,
        }}>
          Search across your Shared Drive — files, contents, and metadata — with instant filters and direct links.
        </p>

        {error && (
          <p style={{
            fontSize: 13,
            color: '#DC2626',
            background: '#FEF2F2',
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 20,
          }}>
            {error}
          </p>
        )}

        <button
          onClick={onSignIn}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 28px',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "'IBM Plex Sans', sans-serif",
            background: 'var(--text)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: 10,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'transform 0.1s, opacity 0.15s',
            opacity: loading ? 0.6 : 1,
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? 'Loading...' : 'Sign in with Google'}
        </button>

        <p style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginTop: 20,
          opacity: 0.7,
        }}>
          Read-only access to your Shared Drive. Nothing is modified.
        </p>
      </div>
    </div>
  );
}
