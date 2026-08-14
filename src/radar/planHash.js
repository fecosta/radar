/**
 * Stable hashing for structure plans.
 *
 * WHAT THIS IS: an integrity and staleness check. It lets execution prove that the plan the
 * administrator confirmed is byte-for-byte the plan being written, and that no intervening
 * input change slipped through.
 *
 * WHAT THIS IS NOT: a security control. RADAR runs entirely in the browser with the signed-in
 * user's own Drive token, so the confirming user and any would-be tamperer are the same
 * principal — someone determined to create arbitrary folders can already call the Drive API
 * directly. FNV-1a is not a cryptographic hash and is not treated as one. The real
 * authorization boundary is the Shared Drive ACL, enforced by Google.
 */

/**
 * Deterministic serialization: object keys sorted at every depth so that two structurally
 * identical plans always produce the same string regardless of property insertion order.
 * Arrays keep their order, which matters — plan item order is meaningful.
 */
export function canonicalSerialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(',')}]`;

  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalSerialize(value[k])}`).join(',')}}`;
}

/** FNV-1a, 32-bit. `offset` lets us derive two independent digests from one pass shape. */
function fnv1a(input, offset) {
  let hash = offset;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime (16777619) via shifts, keeping the result an unsigned 32-bit int.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const toHex8 = (n) => n.toString(16).padStart(8, '0');

/**
 * 16-hex-character digest of any serializable value. Two FNV-1a passes with different
 * offset bases are concatenated, which widens the digest enough for accidental-collision
 * safety at this scale.
 */
export function stableHash(value) {
  const serialized = canonicalSerialize(value);
  return `${toHex8(fnv1a(serialized, 0x811c9dc5))}${toHex8(fnv1a(serialized, 0x9dc5811c))}`;
}
