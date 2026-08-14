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
      style={{ display: 'grid', gap: 10 }}
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
              padding: '14px 16px',
              border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              background: active ? 'var(--accent-light)' : 'var(--surface)',
              cursor: 'pointer',
              fontFamily: 'var(--sans)',
              transition: 'all 0.15s',
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: active ? 'var(--accent)' : 'var(--text)',
                marginBottom: 4,
              }}
            >
              {structure.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {structure.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
