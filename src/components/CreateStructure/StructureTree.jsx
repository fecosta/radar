import { useRef } from 'react';
import { ITEM_STATUS } from '../../services/previewStructure.js';
import { ITEM_KIND } from '../../radar/canonicalTree.js';

/**
 * Accessible preview of the planned structure.
 *
 * Every node states its outcome in WORDS ("Will create", "Already exists", "Conflict"), so
 * the preview is fully readable without perceiving colour. Colour and the icon reinforce
 * that label rather than carrying it.
 *
 * ARIA: role="tree" with a roving tabindex — the whole tree is one tab stop and Up/Down/
 * Home/End move within it. Nodes are always expanded (this is a preview, not a browser), so
 * parents advertise aria-expanded="true" and there is nothing to collapse.
 */

const STATUS_META = {
  [ITEM_STATUS.CREATE]: { label: 'Will create', color: 'var(--accent)', symbol: '+', tint: 'var(--accent-light)' },
  [ITEM_STATUS.EXISTS]: { label: 'Already exists', color: 'var(--text-muted)', symbol: '=', tint: 'transparent' },
  [ITEM_STATUS.CONFLICT]: { label: 'Conflict', color: 'var(--danger)', symbol: '!', tint: 'var(--danger-light)' },
  [ITEM_STATUS.BLOCKED]: { label: 'Blocked', color: 'var(--text-disabled)', symbol: '·', tint: 'transparent' },
};

/** Rebuild the nested shape from the flat, parents-first item list. */
function toTree(items) {
  const byKey = new Map(items.map((item) => [item.key, { ...item, children: [] }]));
  const roots = [];
  for (const node of byKey.values()) {
    const parent = node.parentKey ? byKey.get(node.parentKey) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Depth-first order of everything rendered, used for keyboard movement. */
function flatten(nodes, level = 1, out = []) {
  for (const node of nodes) {
    out.push({ node, level });
    if (node.children.length > 0) flatten(node.children, level + 1, out);
  }
  return out;
}

export default function StructureTree({ items, label = 'Planned structure' }) {
  const itemRefs = useRef([]);
  const activeRef = useRef(0);

  const visible = flatten(toTree(items));

  const focusAt = (index) => {
    const clamped = Math.max(0, Math.min(visible.length - 1, index));
    activeRef.current = clamped;
    itemRefs.current[clamped]?.focus();
  };

  const onKeyDown = (event) => {
    const current = activeRef.current;
    if (event.key === 'ArrowDown') focusAt(current + 1);
    else if (event.key === 'ArrowUp') focusAt(current - 1);
    else if (event.key === 'Home') focusAt(0);
    else if (event.key === 'End') focusAt(visible.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="tree"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-raised)',
        padding: '12px 6px',
        maxHeight: 420,
        overflowY: 'auto',
      }}
    >
      {visible.map(({ node, level }, index) => {
        const meta = STATUS_META[node.status] || STATUS_META[ITEM_STATUS.BLOCKED];
        const isDoc = node.kind === ITEM_KIND.GOOGLE_DOC;
        const restricted = Boolean(node.sensitive?.restricted);

        return (
          <div
            key={node.key}
            role="treeitem"
            aria-level={level}
            aria-selected={false}
            {...(node.children.length > 0 ? { 'aria-expanded': true } : {})}
            tabIndex={index === 0 ? 0 : -1}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            onFocus={() => {
              activeRef.current = index;
            }}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              padding: '4px 12px',
              paddingLeft: 12 + (level - 1) * 18,
              borderRadius: 'var(--radius-xs)',
              background: meta.tint,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                fontWeight: 800,
                color: meta.color,
                width: 11,
                flexShrink: 0,
              }}
            >
              {meta.symbol}
            </span>

            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                fontWeight: isDoc ? 500 : 700,
                color: node.status === ITEM_STATUS.EXISTS ? 'var(--text-muted)' : 'var(--text)',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              {node.name}
            </span>

            {isDoc ? (
              <span style={{
                fontFamily: 'var(--sans)',
                fontSize: 9.5, fontWeight: 800,
                letterSpacing: 0.6, textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-pill)',
                padding: '2px 7px',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                Google doc
              </span>
            ) : null}

            {restricted ? (
              <span
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: 'var(--on-accent)',
                  background: 'var(--accent)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '2px 8px',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Restricted
              </span>
            ) : null}

            <span
              style={{
                marginLeft: 'auto',
                fontFamily: 'var(--sans)',
                fontSize: 10.5,
                fontWeight: 700,
                color: meta.color,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
