/**
 * Local persistence for the first-time onboarding tour.
 *
 * WHAT THIS STORES: one boolean per user per onboarding version — "this person has seen the
 * tour". Nothing else. No token, no Drive id, no query, no description, no document metadata.
 *
 * WHY IT IS ALL WRAPPED: onboarding is a nice-to-have and storage is not guaranteed. Private
 * browsing, a full quota, a disabled-storage policy or a value someone hand-edited must never
 * stop a person using RADAR. Every function here therefore swallows its own failures and
 * degrades to "not completed" — the tour may reappear next session, which is a far better
 * outcome than a blank screen.
 *
 * Note for anyone auditing persistence: `useAuth` is asserted to write nothing at all
 * (useAuth.test.jsx), and that remains true. This is the only storage in the app, it belongs to
 * the presentation layer, and it holds no credential.
 */

/**
 * Bump when a product change is significant enough that people who already toured should see
 * the tour again. Completion is stored per version, so raising this re-opens it once for
 * everyone and leaves the old key harmless.
 */
export const ONBOARDING_VERSION = 1;

const KEY_PREFIX = 'radar:onboarding';

/** Same treatment `allowedDomains.js` gives an address before comparing it. */
function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Key for one user's completion flag.
 *
 * Falls back to a device-level key when there is no email rather than reaching into
 * authentication for an identifier onboarding does not need. In the authorized app tree an
 * email is always present, so the fallback is for tests and defensive callers only.
 */
export function onboardingKey(email, version = ONBOARDING_VERSION) {
  const normalized = normalizeEmail(email);
  return `${KEY_PREFIX}:${normalized || 'device'}:v${version}`;
}

/** The Storage object, or null when the browser will not give us one. */
function storage() {
  try {
    // Touching window.localStorage is itself what throws under some privacy settings.
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Has this user completed this version of the tour?
 *
 * Anything other than the exact stored value counts as "no": a malformed entry is treated as
 * absent rather than repaired, because guessing at a corrupt value is worse than showing a
 * five-screen tour one extra time.
 */
export function hasCompletedOnboarding(email, version = ONBOARDING_VERSION) {
  const store = storage();
  if (!store) return false;

  try {
    return store.getItem(onboardingKey(email, version)) === 'true';
  } catch {
    return false;
  }
}

/**
 * Record that this user finished or skipped the tour.
 *
 * Returns whether it was actually written, so a caller can tell the difference between "saved"
 * and "storage refused" — but no caller is required to care, and nothing changes in the UI
 * either way. A failed write means the tour returns next session.
 */
export function markOnboardingCompleted(email, version = ONBOARDING_VERSION) {
  const store = storage();
  if (!store) return false;

  try {
    store.setItem(onboardingKey(email, version), 'true');
    return true;
  } catch {
    return false;
  }
}

/** Test and support helper: forget the flag so the tour auto-opens again. */
export function clearOnboarding(email, version = ONBOARDING_VERSION) {
  const store = storage();
  if (!store) return false;

  try {
    store.removeItem(onboardingKey(email, version));
    return true;
  } catch {
    return false;
  }
}
