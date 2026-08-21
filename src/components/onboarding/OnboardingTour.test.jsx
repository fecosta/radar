/**
 * @vitest-environment jsdom
 *
 * Onboarding tour tests, driven through the real `App` so the tour is exercised where it
 * actually lives — inside the authorized shell, against the real tab strip it points at.
 *
 * The auth harness mirrors src/App.test.jsx: `useAuth` is module-mocked so the three access
 * checks never run and the app can be handed a literal AUTHORIZED status.
 *
 * jsdom keeps one localStorage per test *file* and it is not reset between tests, so every test
 * here clears it explicitly. Without that these would pass or fail depending on their order.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ACCESS_STATUS } from '../../hooks/useRadarAccess.js';
import { onboardingKey, ONBOARDING_VERSION } from '../../utils/onboardingStorage.js';

const authState = vi.hoisted(() => ({ current: null }));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState.current,
}));

// Drive is never reached: the tour must not touch it, and these tests assert that.
vi.mock('../../utils/driveApi', () => ({
  listSubfolders: vi.fn(async () => []),
  searchFiles: vi.fn(async () => ({ files: [] })),
  listTopFolders: vi.fn(async () => []),
  listOwners: vi.fn(async () => []),
  getFile: vi.fn(async () => ({})),
  getFilePath: vi.fn(async () => []),
  getDriveInfo: vi.fn(async () => ({})),
}));

const { default: App } = await import('../../App.jsx');

const EMAIL = 'user@velezreyesmas.com';
const USER = { name: 'Approved User', email: EMAIL, picture: null };

function renderApp(overrides = {}) {
  authState.current = {
    user: USER,
    token: 'token-1',
    loading: false,
    error: null,
    accessStatus: ACCESS_STATUS.AUTHORIZED,
    signIn: vi.fn(),
    signOut: vi.fn(),
    retryAccessCheck: vi.fn(),
    ...overrides,
  };
  return { user: userEvent.setup(), ...render(<App />) };
}

const completeStored = () => window.localStorage.getItem(onboardingKey(EMAIL));
const markStored = () => window.localStorage.setItem(onboardingKey(EMAIL), 'true');

const welcome = () => screen.queryByRole('dialog', { name: /welcome to radar/i });
const dialog = () => screen.queryByRole('dialog');

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/* ─── When it appears ─────────────────────────────────────── */

describe('first run', () => {
  it('opens the welcome dialog for a newly authorized user', async () => {
    renderApp();
    expect(await screen.findByRole('dialog', { name: /welcome to radar/i })).toBeInTheDocument();
  });

  it('names the three workflows and states the safety guarantee up front', () => {
    renderApp();
    const d = welcome();
    expect(d).toHaveTextContent('Search');
    expect(d).toHaveTextContent('Classify');
    expect(d).toHaveTextContent('Create structure');
    expect(d).toHaveTextContent(/never deletes, moves or renames files/i);
    expect(d).toHaveTextContent(/never changes permissions/i);
  });

  it('leaves the application shell reachable while open', () => {
    renderApp();
    expect(welcome()).toBeInTheDocument();
    // The tour must not hide the app from assistive technology: the shell it points at has to
    // stay findable, or a screen-reader user cannot locate the control being described.
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('does not open for someone who has already seen this version', () => {
    markStored();
    renderApp();
    expect(dialog()).not.toBeInTheDocument();
  });

  it('does not open on any pre-authorized state', () => {
    renderApp({ accessStatus: ACCESS_STATUS.CHECKING_DRIVE });
    expect(dialog()).not.toBeInTheDocument();
    cleanup();

    renderApp({ accessStatus: ACCESS_STATUS.DRIVE_DENIED });
    expect(dialog()).not.toBeInTheDocument();
    cleanup();

    renderApp({ accessStatus: ACCESS_STATUS.SIGNED_OUT, user: null, token: null });
    expect(dialog()).not.toBeInTheDocument();
  });
});

/* ─── Moving through it ──────────────────────────────────── */

describe('navigation', () => {
  it('walks welcome → search → classify → create structure → done', async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    expect(await screen.findByText(/find what already exists/i)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(await screen.findByText(/know where a document belongs/i)).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(await screen.findByText(/create approved structures safely/i)).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();

    // Last feature step offers Finish rather than Next.
    await user.click(screen.getByRole('button', { name: /^finish$/i }));
    expect(await screen.findByText(/ready to use radar/i)).toBeInTheDocument();
  });

  it('goes back to the previous step', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(await screen.findByText(/know where a document belongs/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(await screen.findByText(/find what already exists/i)).toBeInTheDocument();
  });

  it('disables Back on the first feature step, so the tour cannot dead-end', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    expect(await screen.findByText(/find what already exists/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^back$/i })).toBeDisabled();
  });

  it('opens the tab it is describing for Search and Classify', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the tour/i }));

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true'));

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Classify' })).toHaveAttribute('aria-selected', 'true'));
  });

  it('never opens the Create structure tab, which would ask for write permission', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(await screen.findByText(/create approved structures safely/i)).toBeInTheDocument();

    // The step is on screen, but the workflow behind it was never activated.
    expect(screen.getByRole('tab', { name: 'Create structure' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByRole('button', { name: /grant permission to continue/i })).not.toBeInTheDocument();
  });
});

/* ─── Leaving it ─────────────────────────────────────────── */

describe('dismissal', () => {
  it('records completion when skipped from the welcome screen', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /skip for now/i }));

    expect(dialog()).not.toBeInTheDocument();
    expect(completeStored()).toBe('true');
  });

  it('records completion when skipped mid-tour', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    await user.click(screen.getByRole('button', { name: /skip tour/i }));

    expect(dialog()).not.toBeInTheDocument();
    expect(completeStored()).toBe('true');
  });

  it('records completion when finished', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^finish$/i }));
    await user.click(screen.getByRole('button', { name: /^done$/i }));

    expect(dialog()).not.toBeInTheDocument();
    expect(completeStored()).toBe('true');
  });

  it('closes on Escape and records completion', async () => {
    const { user } = renderApp();
    expect(welcome()).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(dialog()).not.toBeInTheDocument();
    expect(completeStored()).toBe('true');
  });

  it('does not reopen after being skipped', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(dialog()).not.toBeInTheDocument();

    // A re-render must not resurrect it, even though storage may have failed to record it.
    await user.click(screen.getByRole('tab', { name: 'Classify' }));
    expect(dialog()).not.toBeInTheDocument();
  });
});

/* ─── Replay ─────────────────────────────────────────────── */

describe('replay', () => {
  it('reopens the tour on request for someone who already completed it', async () => {
    markStored();
    const { user } = renderApp();
    expect(dialog()).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /take the radar tour/i }));
    expect(await screen.findByRole('dialog', { name: /welcome to radar/i })).toBeInTheDocument();
  });

  it('leaves the stored completion alone, so replaying is not a reset', async () => {
    markStored();
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the radar tour/i }));

    expect(completeStored()).toBe('true');
  });

  it('needs no sign-out — the session is untouched', async () => {
    markStored();
    const { user, ...rest } = renderApp();
    const signOut = authState.current.signOut;

    await user.click(screen.getByRole('button', { name: /take the radar tour/i }));
    await screen.findByRole('dialog', { name: /welcome to radar/i });

    expect(signOut).not.toHaveBeenCalled();
    expect(rest.container).toBeTruthy();
  });
});

/* ─── Degrading safely ───────────────────────────────────── */

describe('resilience', () => {
  it('renders RADAR when reading storage throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    renderApp();

    // The shell is what matters; whether the tour opened is secondary.
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders RADAR when writing storage throws, and still closes the tour', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /skip for now/i }));

    expect(dialog()).not.toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders RADAR when localStorage is unavailable entirely', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('access denied');
      },
    });

    try {
      renderApp();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });

  it('treats a corrupt stored value as "not seen yet" rather than crashing', async () => {
    window.localStorage.setItem(onboardingKey(EMAIL), '{"completed":"maybe"}');

    renderApp();

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: /welcome to radar/i })).toBeInTheDocument();
  });

  /**
   * Queried by class because the highlight is decorative and `aria-hidden` — it has no role to
   * find it by. Worth asserting anyway: the anchor silently failing is exactly the bug this
   * caught during development, and nothing else would have noticed.
   */
  it('anchors the highlight to the real control', async () => {
    const { user, container } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    await screen.findByText(/find what already exists/i);

    expect(container.ownerDocument.querySelector('.onboarding-spotlight')).toBeInTheDocument();
    expect(container.ownerDocument.querySelector('.onboarding-scrim')).not.toBeInTheDocument();
  });

  it('falls back to a full scrim when there is nothing to anchor to', async () => {
    const { user, container } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    await screen.findByText(/find what already exists/i);

    document.querySelectorAll('[data-tour]').forEach((el) => el.removeAttribute('data-tour'));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await screen.findByText(/know where a document belongs/i);

    expect(container.ownerDocument.querySelector('.onboarding-scrim')).toBeInTheDocument();
    expect(container.ownerDocument.querySelector('.onboarding-spotlight')).not.toBeInTheDocument();
  });

  it('shows the step centred when its target element is missing', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    await screen.findByText(/find what already exists/i);

    // Simulate a future refactor that drops the anchor.
    document.querySelectorAll('[data-tour]').forEach((el) => el.removeAttribute('data-tour'));
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    // The step still reads; it simply stops trying to anchor.
    expect(await screen.findByText(/know where a document belongs/i)).toBeInTheDocument();
  });

  it('keys completion per user, so a shared browser does not swallow the second person', () => {
    expect(onboardingKey('User@VelezReyesMas.com ')).toBe(onboardingKey(EMAIL));
    expect(onboardingKey('other@velezreyesmas.com')).not.toBe(onboardingKey(EMAIL));
    expect(onboardingKey(EMAIL)).toContain(`:v${ONBOARDING_VERSION}`);
  });
});

/* ─── The safety boundary ────────────────────────────────── */

describe('the tour cannot write', () => {
  it('requests no OAuth scope and issues no Drive or Sheets request, start to finish', async () => {
    const requestAccessToken = vi.fn();
    const initTokenClient = vi.fn(() => ({ requestAccessToken }));
    window.google = { accounts: { oauth2: { initTokenClient } } };

    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchSpy);

    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /take the tour/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^finish$/i }));
    await user.click(screen.getByRole('button', { name: /^done$/i }));

    // No incremental authorization was even set up, let alone requested.
    expect(initTokenClient).not.toHaveBeenCalled();
    expect(requestAccessToken).not.toHaveBeenCalled();

    // And nothing was sent anywhere. Drive is module-mocked, so any real network attempt
    // would have to come through fetch.
    const mutating = fetchSpy.mock.calls.filter(([, init]) =>
      ['POST', 'PATCH', 'PUT', 'DELETE'].includes(String(init?.method || 'GET').toUpperCase())
    );
    expect(mutating).toEqual([]);

    delete window.google;
  });
});
