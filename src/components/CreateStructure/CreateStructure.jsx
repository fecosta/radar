import { useEffect, useRef } from 'react';
import { useCreateStructure, STEPS } from '../../hooks/useCreateStructure.js';
import { useElevatedAuth } from '../../hooks/useElevatedAuth.js';
import { PREVIEW_STATUS } from '../../services/previewStructure.js';
import { STRUCTURE_WRITE_SCOPES } from '../../services/structureServices.js';
import { Button, Callout, Card } from './ui.jsx';
import TypeStep from './steps/TypeStep.jsx';
import DetailsStep from './steps/DetailsStep.jsx';
import PreviewStep from './steps/PreviewStep.jsx';
import ConfirmStep from './steps/ConfirmStep.jsx';
import ResultStep from './steps/ResultStep.jsx';

/**
 * Create structure — the only write-capable workflow in RADAR.
 *
 * Authorization model, stated plainly because it is easy to overclaim: RADAR keeps no admin
 * list of its own. The signed-in user's Google Drive role IS the authorization, and Google
 * enforces it. The preview probes `canAddChildren` on the destination parent and blocks the
 * flow when the answer is no, but that probe is a courtesy — the authoritative refusal is the
 * 403 Google returns on the write itself. This app holds no service-account key and no
 * privileged credential; it can only ever do what the signed-in person could already do.
 */

/** Ordered step indicator with the current step marked for assistive technology. */
function StepNav({ currentId }) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentId);

  return (
    <nav aria-label="Progress" style={{ marginBottom: 22 }}>
      <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none' }}>
        {STEPS.map((step, index) => {
          const isCurrent = step.id === currentId;
          const isDone = index < currentIndex;
          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                border: `1.5px solid ${isCurrent ? 'var(--ink)' : 'var(--border)'}`,
                // The longhand, not the `background` shorthand: jsdom cannot parse a custom
                // property inside the shorthand, which breaks node cloning in the tests.
                backgroundColor: isCurrent ? 'var(--ink)' : 'transparent',
                fontFamily: 'var(--sans)',
                fontSize: 11.5,
                fontWeight: 700,
                color: isCurrent ? 'var(--on-ink)' : isDone ? 'var(--text-secondary)' : 'var(--text-disabled)',
              }}
            >
              <span aria-hidden="true" style={{ fontWeight: 800 }}>{isDone ? '✓' : index + 1}</span>
              {step.label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function CreateStructure({ user, servicesFactory, config }) {
  const elevated = useElevatedAuth();
  const wizard = useCreateStructure({
    token: elevated.token,
    user,
    servicesFactory,
    config,
  });

  const headingRef = useRef(null);
  const { stepId } = wizard;

  // Move focus to the step heading on each transition, so keyboard and screen-reader users
  // land on the new content instead of staying on a button that has just disappeared.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepId]);

  const currentStep = STEPS.find((s) => s.id === stepId);

  /* ── Configuration gate ─────────────────────────────── */

  if (!wizard.config.sharedDriveId) {
    return (
      <Card>
        <Callout tone="danger" title="Not configured" role="alert">
          No Shared Drive is configured. Set <code>VITE_SHARED_DRIVE_ID</code> before using Create
          structure.
        </Callout>
      </Card>
    );
  }

  /* ── Permission gate ────────────────────────────────── */

  if (!elevated.token) {
    return (
      <Card>
        <h3 style={{ fontFamily: 'var(--sans)', fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.4, lineHeight: 1.2, marginBottom: 8 }}>
          Create a canonical structure
        </h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 18, maxWidth: 720 }}>
          Search and Classify are read-only. Creating folders needs additional Google permission,
          which RADAR requests only when you open this workflow.
        </p>

        <Callout tone="neutral" title="What you are granting">
          <p style={{ marginBottom: 8 }}>
            Permission to create Drive items and update the Registry and audit spreadsheets, using
            your own Google account:
          </p>
          <ul style={{ listStyle: 'disc', paddingLeft: 18, fontFamily: 'var(--mono)', fontSize: 11 }}>
            {STRUCTURE_WRITE_SCOPES.map((scope) => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>
          <p style={{ marginTop: 10 }}>
            RADAR can never do more than your Drive role already allows. If you are not a Content
            Manager on the RADAR Shared Drive, Google will refuse the operation.
          </p>
        </Callout>

        {elevated.error ? (
          <div style={{ marginTop: 16 }}>
            <Callout tone="danger" title="Permission not granted" role="alert">
              {elevated.error}
            </Callout>
          </div>
        ) : null}

        <div style={{ marginTop: 18 }}>
          <Button variant="primary" onClick={elevated.requestAccess} disabled={elevated.requesting}>
            {elevated.requesting ? 'Waiting for Google…' : 'Grant permission to continue'}
          </Button>
        </div>
      </Card>
    );
  }

  /* ── Wizard ─────────────────────────────────────────── */

  const previewReady =
    wizard.preview && wizard.preview.status === PREVIEW_STATUS.READY && wizard.preview.blocking.length === 0;

  return (
    <Card>
      <StepNav currentId={stepId} />

      <h3
        ref={headingRef}
        tabIndex={-1}
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--text)',
          letterSpacing: -0.4,
          lineHeight: 1.2,
          marginBottom: 6,
          outline: 'none',
        }}
      >
        {stepId === 'type' ? 'Choose a structure type' : currentStep.label}
        {wizard.template && stepId !== 'type' ? ` — ${wizard.template.label}` : ''}
      </h3>

      <div style={{ marginTop: 18 }}>
        {stepId === 'type' ? <TypeStep value={wizard.structureType} onSelect={wizard.selectType} /> : null}

        {stepId === 'details' ? (
          <DetailsStep
            template={wizard.template}
            inputs={wizard.inputs}
            fieldErrors={wizard.fieldErrors}
            onChange={wizard.setField}
            plan={wizard.plan}
          />
        ) : null}

        {stepId === 'preview' ? (
          <PreviewStep
            preview={wizard.preview}
            loading={wizard.previewLoading}
            error={wizard.previewError}
          />
        ) : null}

        {stepId === 'confirm' ? (
          <ConfirmStep
            preview={wizard.preview}
            template={wizard.template}
            acknowledged={wizard.acknowledged}
            onToggleAcknowledgement={wizard.toggleAcknowledgement}
            confirmed={wizard.confirmed}
            onConfirmedChange={wizard.setConfirmed}
          />
        ) : null}

        {stepId === 'result' ? (
          <ResultStep result={wizard.result} onRetry={wizard.retry} onStartOver={wizard.startOver} />
        ) : null}
      </div>

      {/* ── Step actions ── */}
      {stepId !== 'result' ? (
        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'space-between',
            marginTop: 26,
            borderTop: '1.5px dotted var(--border)',
            paddingTop: 20,
          }}
        >
          {stepId === 'type' ? (
            <span />
          ) : (
            <Button onClick={wizard.goBack} disabled={wizard.executing}>
              Back
            </Button>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {stepId === 'type' ? (
              <Button variant="primary" onClick={wizard.goToDetails} disabled={!wizard.structureType}>
                Continue
              </Button>
            ) : null}

            {stepId === 'details' ? (
              <Button variant="primary" onClick={wizard.runPreview} disabled={wizard.previewLoading}>
                {wizard.previewLoading ? 'Checking Drive…' : 'Validate and preview'}
              </Button>
            ) : null}

            {stepId === 'preview' ? (
              <Button variant="primary" onClick={wizard.goToConfirm} disabled={!previewReady}>
                Continue to confirmation
              </Button>
            ) : null}

            {/* The one action that writes to Drive takes the reserved signal colour. */}
            {stepId === 'confirm' ? (
              <Button variant="signal" onClick={wizard.execute} disabled={!wizard.canCreate}>
                {wizard.executing ? 'Creating…' : 'Create structure'}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* A busy announcement separate from the button label, so the state is spoken. */}
      {wizard.executing ? (
        <div role="status" aria-live="polite" style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
          Creating the structure in Drive. Do not close this tab.
        </div>
      ) : null}
    </Card>
  );
}
