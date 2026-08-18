/**
 * @vitest-environment jsdom
 *
 * Rendering safety for the root access gate.
 *
 * The question this suite answers is narrow and worth answering directly: can any protected
 * part of RADAR reach the screen for an identity that is not authorized? It drives App through
 * every access status and asserts on the application chrome — the mode tabs and the Sign out
 * control, which exist only inside the authorized tree.
 *
 * `useAuth` is mocked because App takes no props; adding a prop seam purely for tests would be
 * a production change made for test convenience. This is the only vi.mock in the repository.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ACCESS_STATUS } from './hooks/useRadarAccess.js';

const authState = vi.hoisted(() => ({ current: null }));

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => authState.current,
}));

// Drive is never reached in these tests, but App imports the module at load time.
vi.mock('./utils/driveApi', () => ({
  listSubfolders: vi.fn(async () => []),
  searchFiles: vi.fn(async () => ({ files: [] })),
  listTopFolders: vi.fn(async () => []),
  listOwners: vi.fn(async () => []),
  getFile: vi.fn(async () => ({})),
  getFilePath: vi.fn(async () => []),
  getDriveInfo: vi.fn(async () => ({})),
}));

const { default: App } = await import('./App.jsx');

const USER = { name: 'Approved User', email: 'user@velezreyesmas.com', picture: null };

function renderApp(overrides = {}) {
  const signIn = vi.fn();
  const signOut = vi.fn();
  const retryAccessCheck = vi.fn();

  authState.current = {
    user: USER,
    token: 'token-1',
    loading: false,
    error: null,
    accessStatus: ACCESS_STATUS.AUTHORIZED,
    signIn,
    signOut,
    retryAccessCheck,
    ...overrides,
  };

  render(<App />);
  return { signIn, signOut, retryAccessCheck };
}

/** The application chrome, which exists only inside the authorized tree. */
const protectedContent = () => screen.queryByRole('tablist');

afterEach(cleanup);

describe('App — protected content is withheld', () => {
  it.each([
    ['checking identity', ACCESS_STATUS.CHECKING_IDENTITY],
    ['checking domain', ACCESS_STATUS.CHECKING_DOMAIN],
    ['checking drive', ACCESS_STATUS.CHECKING_DRIVE],
    ['domain denied', ACCESS_STATUS.DOMAIN_DENIED],
    ['drive denied', ACCESS_STATUS.DRIVE_DENIED],
    ['verification error', ACCESS_STATUS.VERIFICATION_ERROR],
    ['configuration error', ACCESS_STATUS.CONFIGURATION_ERROR],
  ])('renders no protected content while %s', (_label, accessStatus) => {
    renderApp({ accessStatus });

    expect(protectedContent()).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    // The navbar, which carries the signed-in identity and the application's own Sign out.
    // Asserted by role because the gate screens legitimately offer a Sign out of their own.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders no protected content while initializing', () => {
    renderApp({ accessStatus: ACCESS_STATUS.INITIALIZING });
    expect(protectedContent()).not.toBeInTheDocument();
  });

  /**
   * A token alone must never be sufficient. This is the regression guard for the old gate,
   * which rendered the whole application on `!token` and asked nothing else.
   */
  it('withholds protected content from a signed-in but unauthorized identity', () => {
    renderApp({
      token: 'a-perfectly-valid-google-token',
      user: { name: 'Outsider', email: 'user@gmail.com' },
      accessStatus: ACCESS_STATUS.DOMAIN_DENIED,
    });

    expect(protectedContent()).not.toBeInTheDocument();
    expect(screen.getByText(/access not authorized/i)).toBeInTheDocument();
  });

  it('shows the sign-in screen when signed out', () => {
    renderApp({ user: null, token: null, accessStatus: ACCESS_STATUS.SIGNED_OUT });

    expect(protectedContent()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });
});

describe('App — protected content is rendered when authorized', () => {
  it('renders the application only for an authorized identity', () => {
    renderApp({ accessStatus: ACCESS_STATUS.AUTHORIZED });

    // The same three markers the withholding tests assert the absence of, so those
    // assertions are known to be watching something that really does exist when authorized.
    expect(protectedContent()).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });
});

describe('App — the gate screens', () => {
  it('announces the transitional check without exposing the application', () => {
    renderApp({ accessStatus: ACCESS_STATUS.CHECKING_DRIVE });

    expect(screen.getByRole('status')).toHaveTextContent(/checking radar access/i);
    expect(protectedContent()).not.toBeInTheDocument();
  });

  /** Telling an unauthorized visitor which organizations are accepted helps only them. */
  it('never names the approved organizations on the denial screen', () => {
    renderApp({
      user: { name: 'Outsider', email: 'user@gmail.com' },
      accessStatus: ACCESS_STATUS.DOMAIN_DENIED,
    });

    expect(document.body.textContent).not.toMatch(/velezreyesmas\.com/i);
    expect(document.body.textContent).not.toMatch(/democraciamas\.com/i);
  });

  it('offers another account when the organization is refused', async () => {
    const user = userEvent.setup();
    const { signOut } = renderApp({ accessStatus: ACCESS_STATUS.DOMAIN_DENIED });

    await user.click(screen.getByRole('button', { name: /sign in with another account/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('offers retry and sign out when the Shared Drive refuses', async () => {
    const user = userEvent.setup();
    const { retryAccessCheck, signOut } = renderApp({ accessStatus: ACCESS_STATUS.DRIVE_DENIED });

    expect(screen.getByText(/shared drive access required/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^retry$/i }));
    expect(retryAccessCheck).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /^sign out$/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  /** A failure to reach Google must not be worded as a permissions problem. */
  it('offers retry without claiming the user lacks permission', async () => {
    const user = userEvent.setup();
    const { retryAccessCheck } = renderApp({ accessStatus: ACCESS_STATUS.VERIFICATION_ERROR });

    expect(screen.getByText(/verify your radar access/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/not authorized/i);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(retryAccessCheck).toHaveBeenCalledTimes(1);
  });

  it('presents a missing setup as a configuration problem, not a denial', () => {
    renderApp({ accessStatus: ACCESS_STATUS.CONFIGURATION_ERROR });

    expect(screen.getByText(/not configured correctly/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Environment variable names belong in the console, not on a user's screen.
    expect(document.body.textContent).not.toMatch(/VITE_/);
  });
});
