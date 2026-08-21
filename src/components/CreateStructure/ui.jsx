/**
 * Small presentational primitives for the Create structure wizard.
 *
 * Inline styles reading the ver+ brand tokens from index.css — no new styling approach is
 * introduced. They live here so the step components stay readable and so spacing, colour and
 * type choices are made once.
 *
 * Type convention, applied throughout: `--sans` (Montserrat) for chrome — labels, buttons,
 * headings, anything uppercase or tracked-out. `--body` (Roboto) for prose. `--mono` for
 * identifiers.
 */

import { useId } from 'react';

export const Card = ({ children, style }) => (
  <div
    style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      padding: '24px 26px',
      ...style,
    }}
  >
    {children}
  </div>
);

/** Tracked-out uppercase eyebrow. The brand's only label voice. */
export const SectionLabel = ({ children }) => (
  <span
    style={{
      fontFamily: 'var(--sans)',
      fontSize: 10.5,
      fontWeight: 800,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: 1,
    }}
  >
    {children}
  </span>
);

export const MonoPath = ({ children }) => (
  <span
    style={{
      fontFamily: 'var(--mono)',
      fontSize: 12.5,
      fontWeight: 500,
      color: 'var(--text)',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
    }}
  >
    {children}
  </span>
);

/**
 * Pill button.
 *
 * `signal` is the write-to-Drive variant: the brand reserves the yellow for actions that
 * change the Shared Drive, so it must not be spent on ordinary primaries.
 */
export function Button({ children, onClick, variant = 'secondary', disabled, type = 'button', ...rest }) {
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const signal = variant === 'signal';
  const onInk = variant === 'on-ink';
  const filled = primary || signal;

  const background = disabled
    ? 'var(--surface-raised)'
    : primary
      ? 'var(--accent)'
      : signal
        ? 'var(--signal)'
        : 'transparent';
  const color = disabled
    ? 'var(--text-disabled)'
    : primary
      ? '#FFFFFF'
      : signal
        ? 'var(--ink)'
        : danger
          ? 'var(--danger)'
          : onInk
            ? 'var(--on-ink)'
            : 'var(--text-secondary)';
  const borderColor = disabled
    ? 'var(--border)'
    : onInk
      ? 'var(--ink-border)'
      : 'var(--border)';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...(onInk || signal ? { 'data-on-ink': '' } : {})}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '12px 26px',
        fontSize: 12.5,
        fontWeight: 700,
        fontFamily: 'var(--sans)',
        border: filled ? 'none' : `1.5px solid ${borderColor}`,
        borderRadius: 'var(--radius-pill)',
        background,
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * A labelled form control.
 *
 * Uses a real <label htmlFor>, and wires aria-describedby / aria-invalid so the error and
 * hint are announced with the field rather than floating unattached beside it.
 */
export function Field({ label, hint, error, required, children }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          color: 'var(--text-muted)',
          letterSpacing: 1,
          textTransform: 'uppercase',
          fontFamily: 'var(--sans)',
        }}
      >
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
        {!required ? <span style={{ fontWeight: 600, letterSpacing: 0 }}> (optional)</span> : null}
      </label>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {hint ? (
        <span
          id={hintId}
          style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}
        >
          {hint}
        </span>
      ) : null}

      {error ? (
        <span
          id={errorId}
          style={{
            fontFamily: 'var(--body)',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--danger)',
            lineHeight: 1.55,
          }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

export const inputStyle = (invalid) => ({
  width: '100%',
  fontSize: 12.5,
  fontFamily: 'var(--body)',
  fontWeight: 500,
  padding: '9px 12px',
  border: `1.5px solid ${invalid ? 'var(--danger)' : 'var(--border)'}`,
  borderRadius: 'var(--radius-xs)',
  background: 'var(--surface-raised)',
  color: 'var(--text)',
});

const TONE = {
  info: { fg: 'var(--accent)', bg: 'var(--accent-light)' },
  success: { fg: 'var(--success)', bg: 'var(--success-light)' },
  danger: { fg: 'var(--danger)', bg: 'var(--danger-light)' },
  neutral: { fg: 'var(--text-muted)', bg: 'var(--surface-raised)' },
};

/**
 * Message block. `title` always carries the meaning in words — colour is reinforcement,
 * never the only signal.
 */
export function Callout({ tone = 'info', title, children, role }) {
  const { fg, bg } = TONE[tone] || TONE.info;
  return (
    <div
      role={role}
      style={{
        background: bg,
        borderRadius: 'var(--radius-sm)',
        padding: '14px 16px',
      }}
    >
      {title ? (
        <div
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 10.5,
            fontWeight: 800,
            color: fg,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: children ? 7 : 0,
          }}
        >
          {title}
        </div>
      ) : null}
      {children ? (
        <div
          style={{
            fontFamily: 'var(--body)',
            fontSize: 12.5,
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Checkbox with its label, used for acknowledgements and the final confirmation. */
export function CheckboxRow({ checked, onChange, children }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--accent)' }}
      />
      <label
        htmlFor={id}
        style={{
          fontFamily: 'var(--body)',
          fontSize: 12.5,
          color: 'var(--text)',
          lineHeight: 1.6,
          cursor: 'pointer',
        }}
      >
        {children}
      </label>
    </div>
  );
}
