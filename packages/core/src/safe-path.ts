const BACKSLASH = 0x5c;
const LAST_C0_CONTROL = 0x1f;
const DEL = 0x7f;

/**
 * Whether a redirect target from a query string or a form is a path on this site, and so safe to
 * send the visitor to. Plain string checks, no `URL`: this is shared with a future React Native
 * client, whose `URL` is incomplete (owner, 2026-09-30, PASSOFF item 37 audit, finding B1).
 *
 * Starting with `/` and not `//` was not enough. The WHATWG URL parser (every browser, and Node)
 * reads `\` as `/` in an http(s) URL and drops tab, newline and carriage return anywhere, so
 * `/\evil.example` and `/<TAB>/evil.example` both resolve to `https://evil.example/`. So a kept
 * path starts with `/`, has neither `/` nor `\` second, and holds no `\` and no C0 control
 * character or DEL anywhere. The caller passes the decoded value (`URLSearchParams.get` has
 * already turned `%5C` into `\`); a `%5C` still encoded is harmless, because the parser keeps it.
 *
 * Resolving once on this site was not enough either (2026-09-30, PASSOFF item 37 re-audit,
 * finding F1). The parser removes dot segments, so `/.//evil.example` and `/a/..//evil.example`
 * resolve here with the pathname `//evil.example`. Next's router keeps a same-origin URL as the
 * bare string pathname + search + hash, and its hard-navigation fallback hands that string to
 * `location.assign`, which reads `//evil.example` as a host. So the path part (everything before
 * the first `?` or `#`) holds no empty segment, meaning no `//`, and no dot segment, meaning no
 * segment that is `.` or `..` with any dot written literally or as `%2e`/`%2E`. Without either,
 * a kept path cannot resolve to a pathname that starts with `//`, so a second resolution lands
 * on this site where the first did (the parser may still trim a trailing space).
 * No real target uses either form; a `//` after the `?` or `#` is query or fragment, not path.
 *
 * Returns `boolean`, not the type guard `raw is string`: a guard narrows a refused string to
 * `null | undefined` in the false branch, so a caller could pass an unsafe string through
 * without a type error (round-2 audit, 2026-09-30).
 */
export function isSafePath(raw: string | null | undefined): boolean {
  if (!raw || !raw.startsWith('/')) return false;
  if (raw[1] === '/' || raw[1] === '\\') return false;
  return !hasUnsafeCharacter(raw) && !hasUnsafeSegment(pathPart(raw));
}

function hasUnsafeCharacter(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code === BACKSLASH || code <= LAST_C0_CONTROL || code === DEL) return true;
  }
  return false;
}

// The parser's path ends at the first `?` (query) or `#` (fragment); a `/` after either is not a segment.
function pathPart(path: string): string {
  for (let i = 0; i < path.length; i++) {
    if (path[i] === '?' || path[i] === '#') return path.slice(0, i);
  }
  return path;
}

function hasUnsafeSegment(path: string): boolean {
  return path.includes('//') || path.split('/').some(isDotSegment);
}

// The parser counts `%2e` in either case as a dot here, and only here; `%2e` elsewhere stays as it is.
function isDotSegment(segment: string): boolean {
  const dots = segment.replaceAll('%2e', '.').replaceAll('%2E', '.');
  return dots === '.' || dots === '..';
}
