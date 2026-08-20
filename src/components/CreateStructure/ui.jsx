/**
 * Small presentational primitives for the Create structure wizard.
 *
 * Inline styles with the existing CSS custom properties, matching Classify and Search — no
 * new styling approach is introduced. They live here so the step components stay readable
 * and so spacing/colour choices are made once.
 */

import { useId } from 'react';

export const Card = ({ children, style }) => (
  <div
    style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow)',
      padding: '20px 24px',
      ...style,
    }}
  >
    {children}
  </div>
);

export const SectionLabel = ({ children }) => (
  <span
    style={{
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    }}
  >
    {children}
  </span>
);

export const MonoPath = ({ children }) => (
  <span
    style={{
      fontFamily: 'var(--mono)',
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--text)',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
    }}
  >
    {children}
  </span>
);

export function Button({ children, onClick, variant = 'secondary', disabled, type = 'button', ...rest }) {
  const primary = variant === 'primary';
  const danger = variant === 'danger';

  const background = disabled
    ? 'var(--surface-raised)'
    : primary
      ? 'var(--accent)'
      : 'transparent';
  const color = disabled
    ? 'var(--text-muted)'
    : primary
      ? '#fff'
      : danger
        ? 'var(--danger)'
        : 'var(--text-secondary)';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        padding: '9px 20px',
        fontSize: 13,
        fontWeight: 700,
        fontFamily: 'var(--sans)',
        border: primary ? 'none' : `1.5px solid ${disabled ? 'var(--border)' : 'var(--border-strong)'}`,
        borderRadius: 'var(--radius-sm)',
        background,
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        boxShadow: primary && !disabled ? '0 4px 12px rgba(166, 43, 255, 0.3)' : 'none',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: 'var(--text-muted)',
          letterSpacing: 0.9,
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
        <span id={hintId} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {hint}
        </span>
      ) : null}

      {error ? (
        <span
          id={errorId}
          style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', lineHeight: 1.5 }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

export const inputStyle = (invalid) => ({
  width: '100%',
  fontSize: 13,
  fontFamily: 'var(--sans)',
  fontWeight: 600,
  padding: '8px 12px',
  border: `1.5px solid ${invalid ? 'var(--danger)' : 'var(--border)'}`,
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)',
  color: 'var(--text)',
});

const TONE = {
  info: { fg: 'var(--accent)', bg: 'var(--accent-light)' },
  success: { fg: 'var(--success)', bg: 'var(--success-light)' },
  danger: { fg: 'var(--danger)', bg: 'var(--danger-light)' },
  neutral: { fg: 'var(--text-secondary)', bg: 'var(--surface-raised)' },
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
        borderLeft: `3px solid ${fg}`,
        borderRadius: 'var(--radius-sm)',
        padding: '12px 14px',
      }}
    >
      {title ? (
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: fg,
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            marginBottom: children ? 6 : 0,
          }}
        >
          {title}
        </div>
      ) : null}
      {children ? (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{children}</div>
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
        style={{ marginTop: 3, width: 15, height: 15, flexShrink: 0, accentColor: 'var(--accent)' }}
      />
      <label htmlFor={id} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, cursor: 'pointer' }}>
        {children}
      </label>
    </div>
  );
}
