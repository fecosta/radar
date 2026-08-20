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
  high: { fg: 'var(--success)', bg: 'var(--success-light)' },
  medium: { fg: 'var(--accent)', bg: 'var(--accent-light)' },
  low: { fg: 'var(--danger)', bg: 'var(--danger-light)' },
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
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'var(--sans)',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 20,
        background: active ? 'var(--accent-light)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)'; }}
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
      fontSize: 11, fontWeight: 800,
      color: 'var(--text-muted)',
      letterSpacing: 0.9, textTransform: 'uppercase',
      fontFamily: 'var(--sans)',
      flexShrink: 0, minWidth: 62,
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
        fontSize: 11, fontWeight: 700,
        fontFamily: 'var(--sans)',
        background: 'var(--surface)',
        border: `1.5px solid ${done ? 'var(--success)' : failed ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        padding: '4px 10px',
        cursor: 'pointer',
        color,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!state) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; } }}
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
      fontSize: 11, fontWeight: 700,
      color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: 0.7,
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
        fontSize: 13, fontWeight: 700,
        color: 'var(--text)',
        lineHeight: 1.55,
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
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
    <div>
      {/* ── Input card ── */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow)',
        padding: '20px 24px',
      }}>
        {/* Heading */}
        <h3 style={{
          fontSize: 22,
          fontWeight: 800,
          fontFamily: 'var(--sans)',
          color: 'var(--text)',
          letterSpacing: -0.3,
          lineHeight: 1.25,
          marginBottom: 5,
        }}>
          Where should I save this?
        </h3>
        <h4 style={{
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'var(--sans)',
          color: 'var(--text)',
          lineHeight: 1.45,
          marginBottom: 20,
        }}>
          Describe the file, note, document, photo, report, or material in English, Spanish, or Portuguese. RADAR will suggest its official folder and a consistent file name.
        </h4>
        <h5 style={{
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'var(--sans)',
          color: 'var(--text)',
          lineHeight: 1.45,
          marginBottom: 20,
        }}>
          Describe what you want to save
        </h5>

        {/* Description */}
        <div style={{
          background: 'var(--surface)',
          border: `2px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '10px 14px',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxShadow: focused ? '0 0 0 4px rgba(6, 72, 179, 0.10)' : 'none',
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
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--sans)',
              color: 'var(--text)',
              lineHeight: 1.6,
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
                flex: 1, minWidth: 220,
                fontSize: 12,
                fontFamily: 'var(--sans)',
                fontWeight: 600,
                padding: '5px 10px',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
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
            fontSize: 13, fontWeight: 600,
            color: 'var(--danger)',
            background: 'var(--danger-light)',
            border: '1px solid #FECACA',
            padding: '10px 16px',
            borderRadius: 8,
            marginTop: 16,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={handleClassify}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '10px 22px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'var(--sans)',
              cursor: 'pointer',
              transition: 'background 0.15s, box-shadow 0.15s',
              boxShadow: '0 4px 12px rgba(6, 72, 179, 0.3)',
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
          boxShadow: 'var(--shadow)',
          padding: '20px 24px',
          marginTop: 20,
          animation: 'fadeSlideIn 0.2s ease',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, marginBottom: 18,
          }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.2 }}>
              {result.title}
            </span>
            <span style={{
              display: 'inline-block', flexShrink: 0,
              padding: '3px 10px',
              background: conf.bg,
              color: conf.fg,
              borderRadius: 20,
              fontSize: 10, fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>
              {result.confidenceLabel}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CopyableBlock label={L.recommended} value={result.path} />
            <CopyableBlock label={L.name} value={result.filename} />

            {/* Why */}
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{L.why} </span>
              <span style={{ color: 'var(--text-secondary)' }}>{result.why}</span>
            </div>

            {/* Special RADAR case */}
            {result.specialText && (
              <div style={{
                background: 'var(--accent-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: 'var(--accent)',
                  textTransform: 'uppercase', letterSpacing: 0.7,
                  marginBottom: 6,
                }}>
                  {result.specialLabel}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {result.specialText}
                </div>
              </div>
            )}

            {/* Needs */}
            {result.needs.length > 0 && (
              <div>
                <ResultLabel text={result.needsLabel} />
                <ul style={{ listStyle: 'disc', paddingLeft: 18, marginTop: 6 }}>
                  {result.needs.map(need => (
                    <li key={need} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      {need}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Alternatives */}
            {result.alternatives.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <ResultLabel text={result.alternativesLabel} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 8 }}>
                  {/* Two candidates can share a path (e.g. the Democracia+ subportfolio
                      records), so the index is part of the key. */}
                  {result.alternatives.map((alt, i) => (
                    <div key={`${alt.path}-${i}`}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {alt.title}
                      </div>
                      <div style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
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
