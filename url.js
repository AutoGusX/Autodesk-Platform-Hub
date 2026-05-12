// url.js — URL variable substitution, slug helpers, and output escaping

const TOKEN_RE = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Returns the list of unique variable token names found in a URL template. */
export function extractTokens(url) {
  const tokens = [];
  const re = new RegExp(TOKEN_RE.source, 'g');
  let m;
  while ((m = re.exec(url)) !== null) {
    if (!tokens.includes(m[1])) tokens.push(m[1]);
  }
  return tokens;
}

/**
 * Resolves a URL by substituting {token} placeholders.
 * Resolution order: submodule variables → customer variables.
 * Values are encodeURIComponent-encoded.
 * Returns { resolved: string, missing: string[] }.
 */
export function resolveUrl(url, urlMode, subVars = {}, custVars = {}) {
  if (urlMode === 'fixed') return { resolved: url, missing: [] };
  const missing = [];
  const resolved = url.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => {
    const val = subVars[name] !== undefined ? subVars[name] : custVars[name];
    if (val === undefined) {
      missing.push(name);
      return `{${name}}`;
    }
    return encodeURIComponent(val);
  });
  return { resolved, missing };
}

/** Returns the list of unresolved token names for a submodule's URL. */
export function getMissingTokens(url, urlMode, subVars = {}, custVars = {}) {
  if (urlMode === 'fixed') return [];
  const { missing } = resolveUrl(url, urlMode, subVars, custVars);
  return missing;
}

/** Converts a display name to a URL-safe slug. */
export function toSlug(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 41) || 'item';
}

/** Ensures a slug is unique by appending -2, -3, ... as needed. */
export function ensureUniqueSlug(base, existingSlugs) {
  if (!existingSlugs.includes(base)) return base;
  let i = 2;
  while (existingSlugs.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/** Escapes a string for safe HTML output. */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
