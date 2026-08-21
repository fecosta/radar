import { useState, useRef, useEffect } from 'react';
import { classifyRadar, getLabels } from '../utils/radarClassify';
import { THEMES, CROSS_THEMATIC } from '../radar/canonicalTree.js';

const CONTEXTS = [
  { key: 'auto', label: 'Auto' },
  { key: 'exploration', label: 'Exploration' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'venture', label: 'Venture' },
  { key: 'inhouse', label: 'In-house' },
  { key: 'institutional', label: 'Institutional' },
];

/**
 * Sourced from the canonical model rather than re-declared. Cross_Thematic is offered
 * because some destinations accept it; the classifier resolves it per location and reports
 * the theme as still needed where v06 does not define it.
 */
const THEME_OPTIONS = [
  { key: 'auto', label: 'Auto' },
  ...THEMES.map((t) => ({ key: t, label: t })),
  { key: CROSS_THEMATIC, label: 'Cross-thematic' },
];

const CONFIDENCE = {
  high: { band: 'var(--success)', fg: 'var(--ink-hover)', chipBorder: 'solid' },
  medium: { band: 'var(--accent-light)', fg: 'var(--text)', chipBorder: 'solid' },
  low: { band: 'var(--bg)', fg: 'var(--text)', chipBorder: 'dashed' },
};

/* ─── Small controls ──────────────────────────────────────── */

/* Radio-style variant of the Filters chip — one option is always selected,
   so there is no ✕ affordance to clear it. */
function Chip({ label, active, onClick, role, tabIndex }) {
  return (
    <button
      onClick={onClick}
      role={role}
      aria-checked={role === 'radio' ? active : undefined}
      tabIndex={tabIndex}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 12px',
        fontSize: 11.5,
        fontWeight: 700,
        fontFamily: 'var(--sans)',
        border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-pill)',
        background: active ? 'var(--ink)' : 'transparent',
        color: active ? 'var(--on-ink)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--text)'; e.currentTarget.style.color = 'var(--text)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
    >
      {label}
    </button>
  );
}

/* Single-select chip group, so it follows the radio pattern rather than a row of
   buttons: the whole group is one tab stop and the arrows move selection and focus
   together. The chips live in their own wrapper so the FieldRow's text label isn't
   swallowed into the radiogroup. */
function RadioChipGroup({ label, ariaLabel, options, value, onChange }) {
  const onChipKeyDown = (e) => {
    const count = options.length;
    const current = options.findIndex(o => o.key === value);
    let next;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % count;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else return; // Space/Enter already select via the button's native click

    e.preventDefault();
    onChange(options[next].key);
    e.currentTarget.querySelectorAll('[role="radio"]')[next]?.focus();
  };

  return (
    <FieldRow label={label}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        onKeyDown={onChipKeyDown}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}
      >
        {options.map(o => (
          <Chip
            key={o.key}
            label={o.label}
            active={value === o.key}
            onClick={() => onChange(o.key)}
            role="radio"
            tabIndex={value === o.key ? 0 : -1}
          />
        ))}
      </div>
    </FieldRow>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <FieldLabel text={label} />
      {children}
    </div>
  );
}

function FieldLabel({ text }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 800,
      color: 'var(--text-muted)',
      letterSpacing: 1, textTransform: 'uppercase',
      fontFamily: 'var(--sans)',
      flexShrink: 0, minWidth: 58,
    }}>
      {text}
    </span>
  );
}

function CopyButton({ value }) {
  const [state, setState] = useState(null); // null | 'copied' | 'failed'
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch (err) {
      console.error('Clipboard error:', err);
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), 1500);
  };

  const done = state === 'copied';
  const failed = state === 'failed';
  const color = done ? 'var(--success)' : failed ? 'var(--danger)' : 'var(--text-secondary)';

  return (
    <button
      onClick={copy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        flexShrink: 0,
        fontSize: 10.5, fontWeight: 700,
        fontFamily: 'var(--sans)',
        background: 'transparent',
        border: `1.5px solid ${done ? 'var(--success)' : failed ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-pill)',
        padding: '4px 11px',
        cursor: 'pointer',
        color,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!state) { e.currentTarget.style.borderColor = 'var(--text)'; e.currentTarget.style.color = 'var(--text)'; } }}
      onMouseLeave={e => { if (!state) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {done
          ? <polyline points="20 6 9 17 4 12"/>
          : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>
        }
      </svg>
      {done ? 'Copied' : failed ? 'Failed' : 'Copy'}
    </button>
  );
}

/* ─── Result pieces ───────────────────────────────────────── */

function ResultLabel({ text }) {
  return (
    <span style={{
      fontFamily: 'var(--sans)',
      fontSize: 10.5, fontWeight: 800,
      color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: 1,
    }}>
      {text}
    </span>
  );
}

function CopyableBlock({ label, value }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 7,
      }}>
        <ResultLabel text={label} />
        <CopyButton value={value} />
      </div>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 12.5, fontWeight: 500,
        color: 'var(--text)',
        lineHeight: 1.6,
        background: 'var(--surface-raised)',
        borderRadius: 'var(--radius-xs)',
        padding: '12px 14px',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      }}>
        {value}
      </div>
    </div>
  );
}

/* ─── Classify ────────────────────────────────────────────── */

export default function Classify() {
  const [description, setDescription] = useState('');
  const [objectName, setObjectName] = useState('');
  const [context, setContext] = useState('auto');
  const [theme, setTheme] = useState('auto');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [focused, setFocused] = useState(false);

  const handleClassify = () => {
    try {
      setResult(classifyRadar({ description, objectName, context, theme }));
      setError(null);
    } catch (err) {
      setError(err.message);
      setResult(null);
    }
  };

  // Plain Enter adds a newline — this is a multi-line description box.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleClassify();
    }
  };

  const L = result ? getLabels(result.language) : null;
  const conf = result ? (CONFIDENCE[result.confidence] || CONFIDENCE.low) : null;

  return (
    /* Input beside result on a wide viewport; the minmax lets it stack when narrow, since
       the app has no breakpoints of its own. */
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
      gap: 20,
      alignItems: 'start',
    }}>
      {/* ── Input card ── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: '24px',
      }}>
        {/* Heading */}
        <h3 style={{
          fontSize: 24,
          fontWeight: 800,
          fontFamily: 'var(--sans)',
          color: 'var(--text)',
          letterSpacing: -0.4,
          lineHeight: 1.2,
        }}>
          Where should I save this?
        </h3>
        <p style={{
          fontSize: 13.5,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginTop: 8,
          marginBottom: 18,
        }}>
          Describe the file, note, document, photo, report, or material in English, Spanish, or Portuguese. RADAR will suggest its official folder and a consistent file name.
        </p>

        {/* Description */}
        <div style={{
          background: 'var(--surface-raised)',
          border: `1.5px solid ${focused ? 'var(--text)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          padding: '14px 16px',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxShadow: focused ? '0 0 0 6px rgba(166, 43, 255, 0.22)' : 'none',
        }}>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder="Board meeting minutes for August' or 'Fotos del evento de Beca Tech"
            style={{
              display: 'block',
              width: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: 13.5,
              fontWeight: 400,
              fontFamily: 'var(--body)',
              color: 'var(--text)',
              lineHeight: 1.65,
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Optional refinements */}
        <div style={{
          marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <FieldRow label="Object">
            <input
              value={objectName}
              onChange={e => setObjectName(e.target.value)}
              placeholder="Organization, program or topic (optional)"
              style={{
                flex: 1, minWidth: 180,
                fontSize: 12.5,
                fontFamily: 'var(--body)',
                fontWeight: 500,
                padding: '7px 12px',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--surface-raised)',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </FieldRow>

          <RadioChipGroup
            label="Context"
            ariaLabel="Work context"
            options={CONTEXTS}
            value={context}
            onChange={setContext}
          />

          <RadioChipGroup
            label="Theme"
            ariaLabel="Theme"
            options={THEME_OPTIONS}
            value={theme}
            onChange={setTheme}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            fontSize: 12.5, fontWeight: 500,
            color: 'var(--danger)',
            background: 'var(--danger-light)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginTop: 16,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={handleClassify}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 30px',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.3,
              fontFamily: 'var(--sans)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Classify
          </button>
        </div>
      </div>

      {/* ── Result card ── */}
      {result && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          animation: 'fadeSlideIn 0.2s ease',
        }}>
          {/* Header band */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12,
            padding: '16px 22px',
            background: conf.band,
          }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 800, color: conf.fg }}>
              {result.title}
            </span>
            <span style={{
              flexShrink: 0,
              fontFamily: 'var(--sans)',
              padding: '4px 12px',
              color: conf.fg,
              border: `1.5px ${conf.chipBorder} ${conf.fg}`,
              borderRadius: 'var(--radius-pill)',
              fontSize: 10.5, fontWeight: 800,
              letterSpacing: 1, textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              {result.confidenceLabel}
            </span>
          </div>

          <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <CopyableBlock label={L.recommended} value={result.path} />
            <CopyableBlock label={L.name} value={result.filename} />

            {/* Why */}
            <div style={{ fontSize: 13, lineHeight: 1.65 }}>
              <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, color: 'var(--text)' }}>{L.why} </span>
              <span style={{ color: 'var(--text-secondary)' }}>{result.why}</span>
            </div>

            {/* Special RADAR case */}
            {result.specialText && (
              <div style={{
                background: 'var(--accent-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
              }}>
                <div style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 10.5, fontWeight: 800,
                  color: 'var(--accent)',
                  textTransform: 'uppercase', letterSpacing: 1,
                  marginBottom: 7,
                }}>
                  {result.specialLabel}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                  {result.specialText}
                </div>
              </div>
            )}

            {/* Needs */}
            {result.needs.length > 0 && (
              <div style={{
                background: 'var(--surface-raised)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
              }}>
                <div style={{ marginBottom: 9 }}>
                  <ResultLabel text={result.needsLabel} />
                </div>
                <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {result.needs.map((need, i) => (
                    <li key={need} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span aria-hidden="true" style={{
                        fontFamily: 'var(--sans)',
                        fontSize: 10, fontWeight: 800,
                        color: 'var(--on-accent)', background: 'var(--accent)',
                        borderRadius: 'var(--radius-pill)',
                        width: 18, height: 18, flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                        {need}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Alternatives */}
            {result.alternatives.length > 0 && (
              <div style={{ borderTop: '1.5px dotted var(--border)', paddingTop: 16 }}>
                <div style={{ marginBottom: 10 }}>
                  <ResultLabel text={result.alternativesLabel} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Two candidates can share a path (e.g. the Democracia+ subportfolio
                      records), so the index is part of the key. */}
                  {result.alternatives.map((alt, i) => (
                    <div key={`${alt.path}-${i}`}>
                      <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                        {alt.title}
                      </div>
                      <div style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11.5,
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}>
                        {alt.path}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
