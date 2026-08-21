/**
 * The modal shell every onboarding step renders inside.
 *
 * This is the app's only dialog, so the accessibility work lives here once rather than being
 * repeated per step: labelled dialog semantics, focus moved in on open, focus trapped while
 * open, Escape to leave, and focus restored to whatever the user was on when it closes.
 *
 * It deliberately does **not** set `aria-hidden` or `inert` on the application root. For the
 * spotlight steps the highlighted control has to stay perceivable — a screen-reader user needs
 * to be able to find the Search tab the card is talking about — and hiding the page would also
 * make the shell unreachable to any role-based query, including the app's own tests.
 */

import { useCallback, useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function OnboardingDialog({
  onDismiss,
  onNext,
  onBack,
  labelledBy,
  describedBy,
  className,
  style,
  children,
}) {
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);
  const generatedId = useId();

  const titleId = labelledBy || `${generatedId}-title`;
  const bodyId = describedBy || `${generatedId}-body`;

  /* Remember where focus was, and put it back on the way out. Without this a keyboard user
     finishing the tour is dumped at the top of the document. */
  useEffect(() => {
    restoreRef.current = document.activeElement;
    return () => {
      const target = restoreRef.current;
      if (target && typeof target.focus === 'function' && document.contains(target)) {
        target.focus();
      }
    };
  }, []);

  const focusables = useCallback(
    () => Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? []),
    []
  );

  /* Focus the dialog itself rather than its first button, so the title is announced before the
     actions. The same idiom the Create structure wizard uses for its step headings. */
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onDismiss?.();
      return;
    }

    if (e.key === 'ArrowRight' && onNext) {
      e.preventDefault();
      onNext();
      return;
    }

    if (e.key === 'ArrowLeft' && onBack) {
      e.preventDefault();
      onBack();
      return;
    }

    if (e.key !== 'Tab') return;

    /* Trap Tab inside the dialog. Arrow keys are safe to claim here because everything focusable
       in this dialog is a button — there is no field whose caret movement we would break, and
       the tab strip's own arrow handling is unreachable while focus is trapped. */
    const items = focusables();
    if (items.length === 0) {
      e.preventDefault();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={className}
      style={{ outline: 'none', ...style }}
    >
      {typeof children === 'function' ? children({ titleId, bodyId }) : children}
    </div>
  );
}
