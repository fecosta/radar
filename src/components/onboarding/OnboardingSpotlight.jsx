/**
 * A feature step: the rest of the page dimmed, one control lit, and a card beside it.
 *
 * The dim is a single element sitting on the target's own rectangle with an enormous
 * `box-shadow` spread, which paints everything *outside* that rectangle. The target is never
 * cloned, moved or restyled, so there is no layout shift and no chance of the highlight and the
 * real control disagreeing.
 *
 * Position is measured on open and re-measured on resize and scroll — no polling and no
 * MutationObserver, so nothing keeps running once the tour closes.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import OnboardingDialog from './OnboardingDialog.jsx';
import { LABELS } from './onboardingSteps.js';

/** Breathing room between the lit control and the dim edge. */
const PAD = 8;
/** Gap between the target and the card. */
const GAP = 14;
const CARD_WIDTH = 380;
/** Below this the card stops trying to anchor and becomes a bottom sheet. */
const NARROW = 860;

function measure(target) {
  const r = target.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function OnboardingSpotlight({
  targetSelector,
  progress,
  title,
  body,
  note,
  isFirst,
  isLast,
  onNext,
  onBack,
  onSkip,
}) {
  const [rect, setRect] = useState(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW);
  const frame = useRef(0);

  /* Measure before paint so the spotlight never appears in the wrong place first. */
  useLayoutEffect(() => {
    let warned = false;

    const read = () => {
      const target = document.querySelector(targetSelector);

      if (!target && !warned) {
        warned = true;
        if (import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.warn(
            `[RADAR onboarding] no element matched ${targetSelector}; showing the step centred.`
          );
        }
      }

      setRect(target ? measure(target) : null);
      setNarrow(window.innerWidth < NARROW);
    };

    read();

    const schedule = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(read);
    };

    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });

    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
    };
  }, [targetSelector]);

  /* If the control cannot be found — a layout change, a future refactor, a permission-dependent
     control — say the step's piece anyway rather than dropping it or crashing. The card centres
     itself and the step still reads. */
  const anchored = Boolean(rect) && !narrow;

  const cardStyle = anchored
    ? {
        position: 'fixed',
        top: Math.max(GAP, rect.top + rect.height + GAP + PAD),
        left: Math.min(
          Math.max(GAP, rect.left + rect.width / 2 - CARD_WIDTH / 2),
          Math.max(GAP, window.innerWidth - CARD_WIDTH - GAP)
        ),
        width: CARD_WIDTH,
      }
    : undefined;

  return (
    <>
      {rect ? (
        <div
          aria-hidden="true"
          className="onboarding-spotlight"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div aria-hidden="true" className="onboarding-scrim" />
      )}

      <OnboardingDialog
        onDismiss={onSkip}
        onNext={onNext}
        onBack={isFirst ? undefined : onBack}
        className={anchored ? 'onboarding-card' : 'onboarding-card onboarding-card--sheet'}
        style={cardStyle}
      >
        {({ titleId, bodyId }) => (
          <>
            <div className="onboarding-progress">{progress}</div>
            <h2 id={titleId} className="onboarding-title">
              {title}
            </h2>
            <p id={bodyId} className="onboarding-body">
              {body}
            </p>
            {note ? <p className="onboarding-note">{note}</p> : null}

            <div className="onboarding-actions">
              <button type="button" className="onboarding-btn" onClick={onBack} disabled={isFirst}>
                {LABELS.back}
              </button>
              <button type="button" className="onboarding-btn onboarding-btn--quiet" onClick={onSkip}>
                {LABELS.skip}
              </button>
              <button type="button" className="onboarding-btn onboarding-btn--primary" onClick={onNext}>
                {isLast ? LABELS.finish : LABELS.next}
              </button>
            </div>
          </>
        )}
      </OnboardingDialog>
    </>
  );
}
