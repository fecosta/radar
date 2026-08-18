/**
 * The approved-organization gate: parsing and matching for VITE_RADAR_ALLOWED_DOMAINS.
 *
 * This is the ONE authoritative implementation. Nothing else in RADAR may decide whether an
 * organization is approved — no component, no hook, no inline comparison.
 *
 * What this answers is deliberately narrow: "is this email's organization one RADAR accepts
 * identities from?" It does NOT answer "may this person read RADAR data". That question
 * belongs to Google, which enforces it against the Shared Drive ACL on every request. An
 * approved domain is a precondition, never a grant — see docs/operations/access-control.md.
 *
 * Pure by design: no React, no network, no environment access. The caller supplies both the
 * email and the parsed allowlist, which is what makes every rule here directly testable.
 */

/**
 * Parse the configured allowlist into normalized, comparable domains.
 *
 * Tolerant of the ways a human actually edits an env file — surrounding whitespace, a
 * trailing comma, mixed case, a copied `@domain` — because a mistyped allowlist fails closed
 * and locks everyone out, so the parser should forgive formatting rather than punish it.
 *
 * @param {string} raw comma-separated domains, e.g. " Example-Org.com , partner.org "
 * @returns {string[]} lowercase domains, empties removed; `[]` when unset or blank
 */
export function parseAllowedDomains(raw) {
  if (typeof raw !== 'string') return [];

  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    // A pasted "@example.com" is an obvious intent; accept it rather than silently never matching.
    .map((entry) => (entry.startsWith('@') ? entry.slice(1) : entry))
    .filter(Boolean);
}

/**
 * Extract the organization domain from an email address.
 *
 * Splits on the LAST `@`, which is what makes `democraciamas.com@gmail.com` resolve to
 * `gmail.com` rather than to the approved-looking prefix. Anything that is not a single
 * well-formed address returns null, and null is never approved.
 *
 * @param {unknown} email the address Google reported for the signed-in account
 * @returns {string|null} lowercase domain, or null when the input is missing or malformed
 */
export function extractEmailDomain(email) {
  if (typeof email !== 'string') return null;

  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');

  // Needs a local part, an `@`, and a domain part.
  if (at <= 0 || at === normalized.length - 1) return null;

  // Exactly one `@`: "a@b@c.com" is malformed, not an address at c.com.
  if (normalized.indexOf('@') !== at) return null;

  const domain = normalized.slice(at + 1);

  // A domain with whitespace or a second `@` is not an address we will reason about.
  if (/\s/.test(domain)) return null;

  return domain;
}

/**
 * Is this email's organization approved?
 *
 * Exact equality against the normalized allowlist. Substring or suffix matching would make
 * `fake-example.com` and `example.com.attacker.org` pass, so neither is used.
 *
 * Fails closed on every uncertain input: no email, malformed email, and — importantly — an
 * empty allowlist. An unconfigured RADAR admits nobody. It never means "admit everyone".
 *
 * @param {unknown} email
 * @param {string[]} allowedDomains already parsed by parseAllowedDomains
 * @returns {boolean}
 */
export function isDomainAllowed(email, allowedDomains) {
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) return false;

  const domain = extractEmailDomain(email);
  if (!domain) return false;

  return allowedDomains.includes(domain);
}
