/**
 * The tour: welcome, three feature steps, done.
 *
 * Presentation only. It reads no Drive data, calls no service, and requests no permission — the
 * one thing it does outside itself is switch the visible tab for the two read-only workflows, so
 * a step describes something the user can actually see. It never opens Create structure, because
 * opening that workflow presents a Google write-permission request.
 */

import { useEffect } from 'react';
import OnboardingDialog from './OnboardingDialog.jsx';
import OnboardingSpotlight from './OnboardingSpotlight.jsx';
import { COMPLETE, FEATURE_STEPS, LABELS, WELCOME, progressLabel } from './onboardingSteps.js';

export default function OnboardingTour({ tour, onActivateTab }) {
  const { isOpen, stepId, next, back, skip, finish, goTo } = tour;

  const featureIndex = FEATURE_STEPS.findIndex((s) => s.id === stepId);
  const step = featureIndex >= 0 ? FEATURE_STEPS[featureIndex] : null;

  /* Show the workflow the step is about, where doing so costs nothing: Search and Classify are
     read-only and make no request when opened. `activatesTab` is null for Create structure by
     design — see onboardingSteps.js. */
  useEffect(() => {
    if (isOpen && step?.activatesTab) onActivateTab?.(step.activatesTab);
  }, [isOpen, step, onActivateTab]);

  if (!isOpen) return null;

  if (stepId === 'welcome') {
    return (
      <>
        <div aria-hidden="true" className="onboarding-scrim" />
        <OnboardingDialog onDismiss={skip} className="onboarding-card onboarding-card--centred">
          {({ titleId, bodyId }) => (
            <>
              <h2 id={titleId} className="onboarding-title">
                {WELCOME.title}
              </h2>
              <p id={bodyId} className="onboarding-body">
                {WELCOME.body}
              </p>

              <ul className="onboarding-workflows">
                {WELCOME.workflows.map((w) => (
                  <li key={w.name}>
                    <span className="onboarding-workflow-name">{w.name}</span>
                    <span className="onboarding-workflow-text">{w.text}</span>
                  </li>
                ))}
              </ul>

              <p className="onboarding-safety">{WELCOME.safety}</p>

              <div className="onboarding-actions">
                <button type="button" className="onboarding-btn onboarding-btn--quiet" onClick={skip}>
                  {WELCOME.secondary}
                </button>
                <button
                  type="button"
                  className="onboarding-btn onboarding-btn--primary"
                  onClick={() => goTo('search')}
                >
                  {WELCOME.primary}
                </button>
              </div>
            </>
          )}
        </OnboardingDialog>
      </>
    );
  }

  if (stepId === 'complete') {
    return (
      <>
        <div aria-hidden="true" className="onboarding-scrim" />
        <OnboardingDialog onDismiss={finish} className="onboarding-card onboarding-card--centred">
          {({ titleId, bodyId }) => (
            <>
              <h2 id={titleId} className="onboarding-title">
                {COMPLETE.title}
              </h2>
              <p id={bodyId} className="onboarding-body">
                {COMPLETE.body}
              </p>
              <p className="onboarding-note">{COMPLETE.replayHint}</p>

              <div className="onboarding-actions">
                <button type="button" className="onboarding-btn onboarding-btn--quiet" onClick={finish}>
                  {COMPLETE.secondary}
                </button>
                <button
                  type="button"
                  className="onboarding-btn onboarding-btn--primary"
                  onClick={() => {
                    onActivateTab?.('search');
                    finish();
                  }}
                >
                  {COMPLETE.primary}
                </button>
              </div>
            </>
          )}
        </OnboardingDialog>
      </>
    );
  }

  if (!step) return null;

  return (
    <OnboardingSpotlight
      key={step.id}
      targetSelector={`[data-tour="${step.target}"]`}
      progress={progressLabel(featureIndex)}
      title={step.title}
      body={step.body}
      note={step.note}
      isFirst={featureIndex === 0}
      isLast={featureIndex === FEATURE_STEPS.length - 1}
      onNext={next}
      onBack={back}
      onSkip={skip}
    />
  );
}

export { LABELS };
