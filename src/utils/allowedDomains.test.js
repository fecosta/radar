/**
 * The approved-organization gate.
 *
 * The domains below are the project's own public organization names, used here because they
 * are the literal acceptance criteria for this feature. They are supplied to every assertion
 * as test input, so nothing here depends on how a real deployment is configured.
 */

import { describe, it, expect } from 'vitest';
import { parseAllowedDomains, extractEmailDomain, isDomainAllowed } from './allowedDomains.js';

const APPROVED = ['velezreyesmas.com', 'democraciamas.com'];

describe('parseAllowedDomains', () => {
  it('parses a plain comma-separated list', () => {
    expect(parseAllowedDomains('velezreyesmas.com,democraciamas.com')).toEqual(APPROVED);
  });

  it('normalizes surrounding whitespace to the same value', () => {
    expect(parseAllowedDomains(' velezreyesmas.com , democraciamas.com ')).toEqual(APPROVED);
  });

  it('lowercases every domain', () => {
    expect(parseAllowedDomains('VelezReyesMas.COM, DEMOCRACIAMAS.com')).toEqual(APPROVED);
  });

  it('ignores empty entries from a stray or trailing comma', () => {
    expect(parseAllowedDomains('velezreyesmas.com,,democraciamas.com,')).toEqual(APPROVED);
    expect(parseAllowedDomains('velezreyesmas.com, ,democraciamas.com')).toEqual(APPROVED);
  });

  it('accepts a pasted @domain form', () => {
    expect(parseAllowedDomains('@velezreyesmas.com')).toEqual(['velezreyesmas.com']);
  });

  it('parses a single domain', () => {
    expect(parseAllowedDomains('velezreyesmas.com')).toEqual(['velezreyesmas.com']);
  });

  it.each([
    ['unset', undefined],
    ['null', null],
    ['empty string', ''],
    ['only whitespace', '   '],
    ['only commas', ',,,'],
    ['a non-string', 42],
  ])('returns an empty list for %s', (_label, raw) => {
    expect(parseAllowedDomains(raw)).toEqual([]);
  });
});

describe('extractEmailDomain', () => {
  it('extracts and lowercases the domain', () => {
    expect(extractEmailDomain('user@democraciamas.com')).toBe('democraciamas.com');
    expect(extractEmailDomain('USER@DEMOCRACIAMAS.COM')).toBe('democraciamas.com');
    expect(extractEmailDomain('  user@democraciamas.com  ')).toBe('democraciamas.com');
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a non-string', 12345],
    ['empty', ''],
    ['no @', 'user.democraciamas.com'],
    ['no local part', '@democraciamas.com'],
    ['no domain part', 'user@'],
    ['two @ signs', 'user@host@democraciamas.com'],
    ['whitespace in the domain', 'user@democracia mas.com'],
  ])('returns null when the address is %s', (_label, email) => {
    expect(extractEmailDomain(email)).toBeNull();
  });
});

describe('isDomainAllowed', () => {
  it('approves a configured domain', () => {
    expect(isDomainAllowed('user@velezreyesmas.com', APPROVED)).toBe(true);
    expect(isDomainAllowed('user@democraciamas.com', APPROVED)).toBe(true);
  });

  it('approves regardless of case', () => {
    expect(isDomainAllowed('USER@VELEZREYESMAS.COM', APPROVED)).toBe(true);
    expect(isDomainAllowed('User.Name@VelezReyesMas.com', APPROVED)).toBe(true);
  });

  it('rejects an unapproved organization', () => {
    expect(isDomainAllowed('user@gmail.com', APPROVED)).toBe(false);
  });

  /**
   * The reason matching is exact equality rather than includes/endsWith. Every address below
   * contains an approved domain as a substring and must still be refused.
   */
  it.each([
    ['a lookalike prefix', 'user@fake-velezreyesmas.com'],
    ['a lookalike suffix', 'user@velezreyesmas.com.example.org'],
    ['an approved domain as the local part', 'democraciamas.com@gmail.com'],
    ['a subdomain', 'user@mail.velezreyesmas.com'],
    ['a trailing dot', 'user@velezreyesmas.com.'],
  ])('rejects %s', (_label, email) => {
    expect(isDomainAllowed(email, APPROVED)).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', ''],
    ['malformed', 'not-an-email'],
    ['domain only', '@velezreyesmas.com'],
  ])('fails closed when the email is %s', (_label, email) => {
    expect(isDomainAllowed(email, APPROVED)).toBe(false);
  });

  /**
   * An unconfigured RADAR admits nobody. If this ever returns true, a deployment that forgot
   * VITE_RADAR_ALLOWED_DOMAINS would silently accept every Google account on the internet.
   */
  it.each([
    ['empty', []],
    ['undefined', undefined],
    ['null', null],
    ['not an array', 'velezreyesmas.com'],
  ])('fails closed when the allowlist is %s', (_label, allowlist) => {
    expect(isDomainAllowed('user@velezreyesmas.com', allowlist)).toBe(false);
  });

  it('matches the parser output end to end', () => {
    const parsed = parseAllowedDomains(' VelezReyesMas.com , democraciamas.com ');
    expect(isDomainAllowed('Someone@velezreyesmas.com', parsed)).toBe(true);
    expect(isDomainAllowed('someone@partner.org', parsed)).toBe(false);
  });
});
