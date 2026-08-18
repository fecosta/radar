import { Button, Callout } from './CreateStructure/ui.jsx';
import { ACCESS_STATUS } from '../hooks/useRadarAccess.js';

/**
 * Everything the user sees between signing in and being let in.
 *
 * Full-viewport, matching LoginScreen's shell, because each of these states replaces the
 * application rather than sitting inside it.
 *
 * The copy is deliberately specific about *which* of the three layers refused, because the
 * remedy differs — a wrong organization needs a different account, a missing Drive membership
 * needs an administrator, and a failed check needs a retry. What it never does is name the
 * approved organizations: telling an unauthorized visitor which domains are accepted hands
 * them the one fact they would need to go looking for an account.
 *
 * No raw Google response, status code or stack trace reaches this component.
 */

/* ─── Shell ───────────────────────────────────────────────── */

function Screen({ children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #0439A0 0%, #0B5FCC 55%, #1A80E8 100%)',
        fontFamily: 'var(--sans)',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(4, 57, 160, 0.35)',
          padding: '44px 44px 36px',
          width: '100%',
          maxWidth: 460,
          animation: 'fadeSlideIn 0.4s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Heading({ children }) {
  return (
    <h1
      style={{
        fontSize: 21,
        fontWeight: 800,
        color: '#262B40',
        letterSpacing: -0.3,
        marginBottom: 10,
        lineHeight: 1.3,
      }}
    >
      {children}
    </h1>
  );
}

function Body({ children }) {
  return (
    <p style={{ fontSize: 14.5, color: '#66799E', lineHeight: 1.65, marginBottom: 24 }}>
      {children}
    </p>
  );
}

function Actions({ children }) {
  return <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>;
}

/** The signed-in account, so a person who owns several knows which one was refused. */
function AccountNote({ email }) {
  if (!email) return null;
  return (
    <p
      style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        marginTop: 22,
        lineHeight: 1.6,
        wordBreak: 'break-all',
      }}
    >
      Signed in as {email}
    </p>
  );
}

/* ─── Gate ────────────────────────────────────────────────── */

export default function AccessGate({ status, email, onRetry, onSignOut }) {
  if (
    status === ACCESS_STATUS.CHECKING_IDENTITY ||
    status === ACCESS_STATUS.CHECKING_DOMAIN ||
    status === ACCESS_STATUS.CHECKING_DRIVE
  ) {
    return (
      <Screen>
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              width: 20,
              height: 20,
              border: '2.5px solid #E0E7F0',
              borderTopColor: '#0648B3',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#262B40' }}>
            Checking RADAR access…
          </span>
        </div>
      </Screen>
    );
  }

  if (status === ACCESS_STATUS.DOMAIN_DENIED) {
    return (
      <Screen>
        <Heading>Access not authorized</Heading>
        <Body>
          Your Google account belongs to an organization that is not currently authorized to
          use RADAR. Sign in with another account or contact your RADAR administrator.
        </Body>
        <Actions>
          <Button variant="primary" onClick={onSignOut}>
            Sign in with another account
          </Button>
        </Actions>
        <AccountNote email={email} />
      </Screen>
    );
  }

  if (status === ACCESS_STATUS.DRIVE_DENIED) {
    return (
      <Screen>
        <Heading>RADAR Shared Drive access required</Heading>
        <Body>
          Your organization is authorized, but this Google account does not currently have
          access to the RADAR Shared Drive. Ask your RADAR administrator to grant access, then
          try again.
        </Body>
        <Actions>
          <Button variant="primary" onClick={onRetry}>
            Retry
          </Button>
          <Button onClick={onSignOut}>Sign out</Button>
        </Actions>
        <AccountNote email={email} />
      </Screen>
    );
  }

  if (status === ACCESS_STATUS.CONFIGURATION_ERROR) {
    return (
      <Screen>
        <Heading>RADAR is not configured correctly</Heading>
        <Body>
          RADAR cannot check access because it is missing part of its setup. This is not a
          problem with your account — contact the RADAR owner.
        </Body>
        {/* The specific missing variable is in the browser console, not here: it is an owner's
            job and means nothing to the person looking at this screen. */}
        <Callout tone="danger" title="Setup incomplete" role="alert">
          Nobody can be authorized until this is fixed.
        </Callout>
        <div style={{ marginTop: 20 }}>
          <Actions>
            <Button onClick={onSignOut}>Sign out</Button>
          </Actions>
        </div>
        <AccountNote email={email} />
      </Screen>
    );
  }

  // VERIFICATION_ERROR, and any unexpected status — fail closed, and never claim the user
  // lacks permission when the truth is that Google could not be reached.
  return (
    <Screen>
      <Heading>We couldn&rsquo;t verify your RADAR access</Heading>
      <Body>
        Your Google account was signed in, but RADAR could not confirm Shared Drive access.
        Try again or sign out.
      </Body>
      <Actions>
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
        <Button onClick={onSignOut}>Sign out</Button>
      </Actions>
      <AccountNote email={email} />
    </Screen>
  );
}
