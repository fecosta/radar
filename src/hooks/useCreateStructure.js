import { useCallback, useMemo, useState } from 'react';
import { planStructureFromRaw } from '../radar/planStructure.js';
import { defaultInputsFor } from '../radar/structureInputs.js';
import { getTemplate } from '../radar/structureTemplates.js';
import { previewStructure, PREVIEW_STATUS } from '../services/previewStructure.js';
import { executeStructure } from '../services/executeStructure.js';
import { createStructureServices, readStructureConfig } from '../services/structureServices.js';
import { DriveError } from '../services/driveErrors.js';

export const STEPS = Object.freeze([
  { id: 'type', label: 'Structure type' },
  { id: 'details', label: 'Details' },
  { id: 'preview', label: 'Preview' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'result', label: 'Result' },
]);

/**
 * Wizard state machine for Create structure.
 *
 * Business rules deliberately live in src/radar and src/services — this hook only sequences
 * the steps and holds what the user has entered, so the rules stay testable without React.
 *
 * `servicesFactory` is injectable so component tests never touch the network.
 */
export function useCreateStructure({ token, user, servicesFactory = createStructureServices, config } = {}) {
  const resolvedConfig = useMemo(() => config || readStructureConfig(), [config]);

  const [stepId, setStepId] = useState('type');
  const [structureType, setStructureType] = useState(null);
  const [inputs, setInputs] = useState({});
  const [showErrors, setShowErrors] = useState(false);

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const [acknowledged, setAcknowledged] = useState([]);
  const [confirmed, setConfirmed] = useState(false);

  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);

  /* ── Derived plan ─────────────────────────────────────── */

  const planned = useMemo(
    () => (structureType ? planStructureFromRaw(structureType, inputs) : null),
    [structureType, inputs]
  );

  const plan = planned?.ok ? planned.plan : null;
  const fieldErrors = useMemo(() => {
    if (!planned || planned.ok) return {};
    return Object.fromEntries(planned.errors.map((e) => [e.field, e.message]));
  }, [planned]);

  const template = structureType ? getTemplate(structureType) : null;

  /* ── Navigation ───────────────────────────────────────── */

  /**
   * Choose a type WITHOUT advancing.
   *
   * Selection and navigation are deliberately separate: in a radiogroup the arrow keys move
   * the selection, so advancing on selection would make a keyboard user skip the step the
   * moment they pressed Down.
   */
  const selectType = useCallback((type) => {
    setStructureType(type);
    setInputs(defaultInputsFor(type));
    setShowErrors(false);
    setPreview(null);
    setPreviewError(null);
    setAcknowledged([]);
    setConfirmed(false);
    setResult(null);
  }, []);

  const goToDetails = useCallback(() => setStepId('details'), []);

  const setField = useCallback((field, value) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
    // Any edit invalidates a preview taken against the old inputs.
    setPreview(null);
    setPreviewError(null);
    setConfirmed(false);
    setAcknowledged([]);
  }, []);

  const goBack = useCallback(() => {
    setStepId((current) => {
      const i = STEPS.findIndex((s) => s.id === current);
      return STEPS[Math.max(0, i - 1)].id;
    });
  }, []);

  /* ── Preview ──────────────────────────────────────────── */

  const runPreview = useCallback(async () => {
    setShowErrors(true);
    if (!plan) return;

    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    setConfirmed(false);
    setAcknowledged([]);
    setStepId('preview');

    try {
      const services = servicesFactory({ token, config: resolvedConfig });
      setPreview(await previewStructure({ drive: services.drive, registry: services.registry, plan }));
    } catch (error) {
      setPreviewError(
        error instanceof DriveError ? error.userMessage : 'The preview could not be completed. Try again.'
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [plan, servicesFactory, token, resolvedConfig]);

  const goToConfirm = useCallback(() => setStepId('confirm'), []);

  const toggleAcknowledgement = useCallback((code) => {
    setAcknowledged((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }, []);

  /* ── Execution ────────────────────────────────────────── */

  const allAcknowledged = useMemo(
    () => (preview?.acknowledgements || []).every((a) => acknowledged.includes(a.code)),
    [preview, acknowledged]
  );

  /**
   * Every gate the brief requires, in one place. The button is disabled on this, but the
   * disabled state is a courtesy — execution re-checks all of it server-side of the browser
   * boundary, against live Drive.
   */
  const canCreate = Boolean(
    plan &&
      preview &&
      preview.status === PREVIEW_STATUS.READY &&
      preview.blocking.length === 0 &&
      preview.drive?.id &&
      allAcknowledged &&
      confirmed &&
      !executing
  );

  const execute = useCallback(async () => {
    if (!canCreate) return;
    setExecuting(true);
    try {
      const services = servicesFactory({ token, config: resolvedConfig });
      const outcome = await executeStructure({
        drive: services.drive,
        registry: services.registry,
        audit: services.audit,
        structureType,
        rawInputs: inputs,
        confirmedPlanHash: preview.planHash,
        acknowledged,
        actor: user?.email || user?.name || 'unknown',
        // Stable within an attempt so a double submit collapses; bumped by an explicit
        // retry so retrying genuinely re-runs.
        operationId: `${preview.planHash}-${attempt}`,
      });
      setResult(outcome);
      setStepId('result');
    } catch (error) {
      setResult({
        outcome: 'failed',
        failureStage: 'unexpected',
        created: [],
        existing: [],
        warnings: [],
        errors: [
          {
            code: error instanceof DriveError ? error.code : 'UNEXPECTED',
            message:
              error instanceof DriveError ? error.userMessage : 'An unexpected error stopped the operation.',
          },
        ],
        registry: { status: null },
        audit: { status: null },
      });
      setStepId('result');
    } finally {
      setExecuting(false);
    }
  }, [canCreate, servicesFactory, token, resolvedConfig, structureType, inputs, preview, acknowledged, user, attempt]);

  /** Retry is safe: execution reuses whatever already exists and creates only what is missing. */
  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
    setResult(null);
    setConfirmed(false);
    setStepId('preview');
    runPreview();
  }, [runPreview]);

  const startOver = useCallback(() => {
    setStepId('type');
    setStructureType(null);
    setInputs({});
    setShowErrors(false);
    setPreview(null);
    setPreviewError(null);
    setAcknowledged([]);
    setConfirmed(false);
    setResult(null);
    setAttempt(0);
  }, []);

  return {
    // navigation
    stepId,
    steps: STEPS,
    goBack,
    startOver,
    // type + details
    structureType,
    template,
    inputs,
    setField,
    selectType,
    goToDetails,
    fieldErrors: showErrors ? fieldErrors : {},
    hasFieldErrors: Object.keys(fieldErrors).length > 0,
    plan,
    // preview
    preview,
    previewLoading,
    previewError,
    runPreview,
    goToConfirm,
    // confirmation
    acknowledged,
    toggleAcknowledgement,
    allAcknowledged,
    confirmed,
    setConfirmed,
    // execution
    canCreate,
    executing,
    execute,
    result,
    retry,
    config: resolvedConfig,
  };
}
