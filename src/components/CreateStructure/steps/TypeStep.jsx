import { useRef } from 'react';
import { SUPPORTED_STRUCTURES } from '../../../radar/structureTemplates.js';

/**
 * Step 1 — pick a structure type.
 *
 * Only the six approved MVP structures appear. There is deliberately no "Portfolio
 * organization" option: approval MOVES an existing Pipeline folder to Portfolio and keeps
 * its history, so offering a new-object button here would produce the rebuilt-instead-of-
 * moved folder the policy forbids. There is likewise no root bootstrap and no seed example.
 *
 * Implemented as a radiogroup with a roving tabindex, matching the chip groups in Classify.
 */
export default function TypeStep({ value, onSelect }) {
  const optionRefs = useRef([]);

  const onKeyDown = (event) => {
    const count = SUPPORTED_STRUCTURES.length;
    const current = Math.max(0, SUPPORTED_STRUCTURES.findIndex((s) => s.id === value));
    let next;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (current + 1) % count;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (current - 1 + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    else return;

    event.preventDefault();
    onSelect(SUPPORTED_STRUCTURES[next].id);
    optionRefs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Structure type"
      onKeyDown={onKeyDown}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}
    >
      {SUPPORTED_STRUCTURES.map((structure, index) => {
        const active = value === structure.id;
        return (
          <button
            key={structure.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (!value && index === 0) ? 0 : -1}
            ref={(el) => {
              optionRefs.current[index] = el;
            }}
            onClick={() => onSelect(structure.id)}
            style={{
              textAlign: 'left',
              padding: 16,
              border: active ? '2px solid var(--ink)' : '1.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: active ? 'var(--bg)' : 'var(--surface-raised)',
              cursor: 'pointer',
              fontFamily: 'var(--sans)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                {structure.label}
              </div>
              {/* The selection says so in words, not by border colour alone. */}
              {active ? (
                <span style={{
                  fontSize: 9.5, fontWeight: 800,
                  letterSpacing: 0.8, textTransform: 'uppercase',
                  color: 'var(--on-ink)', background: 'var(--ink)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '3px 9px', flexShrink: 0,
                }}>
                  Selected
                </span>
              ) : null}
            </div>
            <div style={{ fontFamily: 'var(--body)', fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 6 }}>
              {structure.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
