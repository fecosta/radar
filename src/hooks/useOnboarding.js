/**
 * State for the first-time onboarding tour.
 *
 * One explicit step list and one open/closed flag, rather than several loosely-related
 * booleans — so every transition is nameable and testable.
 *
 * The hook decides *whether* to open and *where in the sequence* we are. It knows nothing about
 * overlays, positioning or copy.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { hasCompletedOnboarding, markOnboardingCompleted, ONBOARDING_VERSION } from '../utils/onboardingStorage.js';

/** The sequence. Welcome and complete bookend the three feature steps. */
export const ONBOARDING_STEPS = ['welcome', 'search', 'classify', 'create-structure', 'complete'];

/** Auto-opened for a first-time user, or replayed on request from the navbar. */
export const ONBOARDING_MODE = Object.freeze({
  AUTOMATIC: 'automatic',
  REPLAY: 'replay',
});

export function useOnboarding({ email, enabled = true } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState(ONBOARDING_MODE.AUTOMATIC);

  /**
   * Auto-open is a one-shot decision per mount, not a reaction to state. Without this guard a
   * user who skips would have the tour reopen the moment anything else re-rendered, since
   * storage may legitimately have failed to record the skip.
   */
  const autoStartResolved = useRef(false);

  useEffect(() => {
    if (!enabled || autoStartResolved.current) return;
    autoStartResolved.current = true;

    if (!hasCompletedOnboarding(email)) {
      setMode(ONBOARDING_MODE.AUTOMATIC);
      setStepIndex(0);
      setIsOpen(true);
    }
  }, [enabled, email]);

  /** Skipping counts as completion for this version: nobody wants it every sign-in. */
  const close = useCallback(
    (persist) => {
      if (persist) markOnboardingCompleted(email);
      setIsOpen(false);
      setStepIndex(0);
    },
    [email]
  );

  const next = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  }, []);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const skip = useCallback(() => close(true), [close]);
  const finish = useCallback(() => close(true), [close]);

  /**
   * Replay does not clear the stored flag — it just opens the tour. Completion means "has been
   * shown once automatically", and asking to see it again should not undo that.
   */
  const replay = useCallback(() => {
    setMode(ONBOARDING_MODE.REPLAY);
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  /** Jump straight to a step id. Used by the welcome screen's "Take the tour". */
  const goTo = useCallback((stepId) => {
    const i = ONBOARDING_STEPS.indexOf(stepId);
    if (i >= 0) setStepIndex(i);
  }, []);

  return {
    isOpen,
    mode,
    stepIndex,
    stepId: ONBOARDING_STEPS[stepIndex],
    steps: ONBOARDING_STEPS,
    version: ONBOARDING_VERSION,
    next,
    back,
    skip,
    finish,
    replay,
    goTo,
  };
}
