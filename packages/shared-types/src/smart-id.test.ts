import { describe, expect, it } from 'vitest';
import { buildSmartId, categoryOfPrefix, isNodePrefix, isSmartId, parseSmartId, suggestPrefix } from './smart-id.js';

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('parseSmartId', () => {
  it('splits prefix and uuid at the first underscore', () => {
    expect(parseSmartId('img01_' + UUID)).toEqual({ prefix: 'img01', uuid: UUID });
    expect(parseSmartId('txt03_' + UUID)).toEqual({ prefix: 'txt03', uuid: UUID });
  });
  it('rejects malformed ids', () => {
    expect(parseSmartId('img01')).toBeNull();
    expect(parseSmartId('')).toBeNull();
    expect(parseSmartId('_nope')).toBeNull();
  });
});

describe('isSmartId', () => {
  it('accepts a valid prefixed uuid only', () => {
    expect(isSmartId('img01_' + UUID)).toBe(true);
    expect(isSmartId('foo01_' + UUID)).toBe(false);
    expect(isSmartId('img01_not-a-uuid')).toBe(false);
  });
});

describe('buildSmartId', () => {
  it('roundtrips through parseSmartId', () => {
    const id = buildSmartId('pdf02', UUID);
    expect(parseSmartId(id)).toEqual({ prefix: 'pdf02', uuid: UUID });
  });
});

describe('suggestPrefix', () => {
  it('allocates the next free prefix per category', () => {
    expect(suggestPrefix('images', ['img01', 'img02'])).toBe('img03');
    expect(suggestPrefix('images', ['img02', 'img01'])).toBe('img03');
    expect(suggestPrefix('text', ['txt01'])).toBe('txt02');
    expect(suggestPrefix('mixed', [])).toBe('mix01');
  });
});

describe('categoryOfPrefix', () => {
  it('maps prefixes back to categories', () => {
    expect(categoryOfPrefix('img07')).toBe('images');
    expect(categoryOfPrefix('txt01')).toBe('text');
    expect(categoryOfPrefix('pdf02')).toBe('pdfs');
    expect(categoryOfPrefix('mix03')).toBe('mixed');
    expect(categoryOfPrefix('nope')).toBeNull();
  });
});

describe('isNodePrefix', () => {
  it('validates the two-digit convention', () => {
    expect(isNodePrefix('img01')).toBe(true);
    expect(isNodePrefix('img1')).toBe(false);
    expect(isNodePrefix('img100')).toBe(false);
  });
});
