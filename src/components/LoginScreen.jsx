import AuthShell, { AuthHeading, AuthBody, AuthNumberedList } from './AuthShell.jsx';

/**
 * Sign-in screen, per the approved RADAR Mockups design pass.
 *
 * The three checks listed here are the same three layers documented in
 * docs/operations/access-control.md. They are stated up front because two of them fail
 * *outside* RADAR — on Google's own pages — and a user who knows that can tell "I am not
 * approved" apart from "the app is broken".
 */

const CHECKS = [
  'A verified Google identity',
  'An approved organization domain',
  'Access to the RADAR Shared Drive',
];

/** Google's four-colour mark. Decorative: the button's text already names the action. */
const GoogleMark = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function LoginScreen({ onSignIn, loading, error }) {
  return (
    <AuthShell>
      <AuthHeading eyebrow="VélezReyes+ · RADAR">Sign in</AuthHeading>

      <AuthBody>
        Search files, contents, and metadata across your Shared Drive — with instant filters
        and direct links.
      </AuthBody>

      <button
        className="auth-cta"
        onClick={onSignIn}
        disabled={loading}
        style={{
          marginTop: 26,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '15px 24px',
          fontFamily: 'var(--sans)',
          fontSize: 14,
          fontWeight: 700,
          background: loading ? 'var(--surface-inert)' : 'var(--surface)',
          color: loading ? 'var(--text-muted)' : 'var(--text)',
          border: `1.5px solid ${loading ? 'var(--border)' : 'var(--ink)'}`,
          borderRadius: 'var(--radius-pill)',
          cursor: loading ? 'wait' : 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {loading ? null : <GoogleMark />}
        {loading ? 'Connecting...' : 'Sign in with Google'}
      </button>

      {error ? (
        <div
          role="alert"
          style={{
            marginTop: 12,
            background: 'var(--surface-raised)',
            border: '1.5px solid var(--ink)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
          }}
        >
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'var(--text)',
            marginBottom: 6,
          }}>
            Sign-in failed
          </div>
          <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', lineHeight: 1.6 }}>
            {error}
          </p>
        </div>
      ) : null}

      <p style={{
        fontSize: 12.5,
        color: 'var(--text-muted)',
        lineHeight: 1.6,
        marginTop: 18,
        textAlign: 'center',
      }}>
        Read-only access · Nothing is modified
      </p>

      <AuthNumberedList
        label="RADAR checks three things"
        items={CHECKS}
        footnote="All three. RADAR never grants access — that stays a Google Workspace administrator action."
      />
    </AuthShell>
  );
}
