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
  [ITEM_STATUS.CREATE]: { label: 'Will create', color: 'var(--accent)', symbol: '+' },
  [ITEM_STATUS.EXISTS]: { label: 'Already exists', color: 'var(--success)', symbol: '=' },
  [ITEM_STATUS.CONFLICT]: { label: 'Conflict', color: 'var(--danger)', symbol: '!' },
  [ITEM_STATUS.BLOCKED]: { label: 'Blocked', color: 'var(--text-muted)', symbol: '·' },
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
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-raised)',
        padding: '10px 6px',
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
              gap: 8,
              padding: '3px 8px',
              paddingLeft: 8 + (level - 1) * 18,
              borderRadius: 4,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                fontWeight: 700,
                color: meta.color,
                width: 12,
                flexShrink: 0,
              }}
            >
              {meta.symbol}
            </span>

            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                fontWeight: isDoc ? 600 : 700,
                color: 'var(--text)',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              {node.name}
            </span>

            {isDoc ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                Google&nbsp;doc
              </span>
            ) : null}

            {restricted ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--danger)',
                  letterSpacing: 0.5,
                  flexShrink: 0,
                }}
              >
                RESTRICTED
              </span>
            ) : null}

            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
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
