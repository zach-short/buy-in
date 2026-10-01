import { describe, expect, it } from 'vitest';

import { isSafePath } from '../src/safe-path';

const ORIGIN = 'https://buy-in.win';

describe('isSafePath, characterization of the helper as it stood on 2026-09-30', () => {
  // Run against the old rule (start with `/`, not `//`) before it changed; these verdicts held.
  it.each(['/', '/join/abc?code=1', '/reset-password', '/login?redirect=%2Fjoin', '/%5Cevil.example'])(
    'keeps the same-origin path %j',
    (path) => {
      expect(isSafePath(path)).toBe(true);
    },
  );

  it.each(['//evil.example', 'https://evil.example', 'evil.example', '', ' /join', null, undefined])(
    'refuses %j',
    (path) => {
      expect(isSafePath(path)).toBe(false);
    },
  );
});

describe('isSafePath, the paths the URL parser sends off-site (B1, 2026-09-30)', () => {
  // The old rule kept every one of these; each resolves to https://evil.example/.
  it.each(['/\\evil.example', '/\\\\evil.example', '/\t/evil.example', '/\n/evil.example', '/\r/evil.example'])(
    'refuses %j',
    (path) => {
      expect(isSafePath(path)).toBe(false);
    },
  );

  it('refuses a backslash anywhere, not just second', () => {
    expect(isSafePath('/join\\evil.example')).toBe(false);
  });

  it.each(['/join\u0000', '/join\u000b', '/join\u001f', '/join\u007f'])('refuses the control character in %j', (path) => {
    expect(isSafePath(path)).toBe(false);
  });

  it('keeps a space inside the path, which is not a control character', () => {
    expect(isSafePath('/join/a b')).toBe(true);
  });
});

// The B1 rule kept every one of these. Each resolves on this site once, with the pathname
// `//evil.example`; Next's router stores that bare pathname and its hard-navigation fallback hands
// it to `location.assign`, which reads it as a host (PASSOFF item 37 re-audit, finding F1).
const F1_ESCAPES = [
  '/.//evil.example',
  '/..//evil.example',
  '/%2e//evil.example',
  '/%2E%2E//evil.example',
  '/a/..//evil.example',
  '/join/../..//evil.example',
];

describe('isSafePath, the paths a second resolution sends off-site (F1, 2026-09-30)', () => {
  it.each(F1_ESCAPES)('refuses %j', (path) => {
    expect(isSafePath(path)).toBe(false);
  });

  it.each(['/a/./b', '/a/../b', '/.', '/..', '/%2e', '/%2E%2e/x'])('refuses the dot segment in %j', (path) => {
    expect(isSafePath(path)).toBe(false);
  });

  // Pins the empty-segment half of F1 on its own: with only the dot-segment rule, a `//` inside
  // the path was still kept and every other test passed (round-2 audit, mutant M3).
  it.each(['/join//x', '/a//'])('refuses the empty segment in %j', (path) => {
    expect(isSafePath(path)).toBe(false);
  });

  it.each(['/join?next=//x', '/join#//x', '/a.b/c..d/.e', '/join/'])(
    'keeps %j, whose dots and slashes are not a dot segment or an empty one',
    (path) => {
      expect(isSafePath(path)).toBe(true);
    },
  );
});

// Every string up to four characters long from these, with a host after it. Each character is
// one the URL parser treats specially somewhere: as a slash, stripped, a scheme or host delimiter.
const ALPHABET = ['/', '\\', '\t', '\n', '\r', ' ', '.', '%', '@', ':', '?', '#', '\u0000', '\u000b', '\u007f', 'a'];

function prefixes(length: number): string[] {
  if (length === 0) return [''];
  return prefixes(length - 1).flatMap((prefix) => ALPHABET.map((c) => prefix + c));
}

function resolve(path: string): URL | null {
  try {
    return new URL(path, ORIGIN);
  } catch {
    return null;
  }
}

// What Next 16.3 keeps for a same-origin URL (`createHrefFromUrl`), and what its hard-navigation
// fallback passes to `location.assign`, which resolves it a second time.
function nextHref(url: URL): string {
  return url.pathname + url.search + url.hash;
}

// The origin after the first resolution, then after resolving Next's href again; null if either throws.
function origins(path: string): [string | null, string | null] {
  const first = resolve(path);
  const second = first && resolve(nextHref(first));
  return [first?.origin ?? null, second?.origin ?? null];
}

// `search` and `hash` drop an empty `?` or `#` (`/?#x` gives `/#x`), and `href` keeps both.
function resolvedVerbatim(path: string): string {
  return new URL(path, ORIGIN).href.slice(ORIGIN.length);
}

// The shapes the real callers pass, which must stay kept.
const REAL_TARGETS = ['/', '/join/abc123', '/join?code=abc123', '/rsvp/abc123', '/reset-password', '/welcome?next=%2Fjoin%2Fabc'];

describe('isSafePath, as a property of the WHATWG URL parser (Node runs the same one)', () => {
  const generated = [1, 2, 3, 4].flatMap(prefixes).map((prefix) => `${prefix}evil.example`);
  const inputs = [...generated, ...F1_ESCAPES, ...REAL_TARGETS];
  const kept = inputs.filter((path) => isSafePath(path));

  it('resolves every path it keeps on this origin, and again from the href Next keeps', () => {
    const offSite = kept.filter((path) => origins(path).some((origin) => origin !== ORIGIN));
    expect(offSite).toEqual([]);
  });

  it('gives an href Next can resolve again without it changing', () => {
    const moved = kept.filter((path) => {
      const href = nextHref(new URL(path, ORIGIN));
      return nextHref(new URL(href, ORIGIN)) !== href;
    });
    expect(moved).toEqual([]);
  });

  // Of the characters these inputs use, the parser percent-encodes only the space.
  it('resolves every kept path with no space to itself, character for character', () => {
    const changed = kept.filter((path) => !path.includes(' ') && resolvedVerbatim(path) !== path);
    expect(changed).toEqual([]);
  });

  it('keeps every real caller shape', () => {
    expect(REAL_TARGETS.filter((path) => !isSafePath(path))).toEqual([]);
  });

  it('is tested against inputs that do go off-site, so the property is not empty', () => {
    const escapes = inputs.filter((path) => path.startsWith('/') && origins(path).includes('https://evil.example'));
    expect(escapes).toContain('/\\evil.example');
    expect(escapes).toContain('/\t/evil.example');
    expect(escapes).toContain('/.//evil.example');
    expect(escapes.every((path) => !isSafePath(path))).toBe(true);
  });
});
