/**
 * normalizeUnit — cart unit → ERP unit-of-measure code.
 *
 * Ported verbatim from the WP plugin's `OCITrait::normalizeUnit` (Dutch
 * package nouns → UN/ECE-ish codes). `defaultUnit` short-circuits the whole
 * table — the plugin passes the product's `packageUnit` as the default, so a
 * present packageUnit always wins; only when it's empty does the substring
 * table run. Unknown → 'PCE'.
 */
export function normalizeUnit(unit: string | null | undefined, defaultUnit = ''): string {
  if (defaultUnit) return defaultUnit;
  const u = (unit ?? '').toLowerCase();
  if (!u) return 'PCE';
  if (u.includes('doos')) return 'CS';
  if (u.includes('stuk')) return 'PCE';
  if (u.includes('etui')) return 'ET';
  if (u.includes('pak')) return 'PK';
  if (u.includes('rol')) return 'RO';
  if (u.includes('set')) return 'SET';
  if (u.includes('blis')) return 'BR';
  if (u.includes('disp')) return 'DP';
  if (u.includes('flac')) return 'FC';
  if (u.includes('zak')) return 'PCE';
  if (u.includes('koke')) return 'KK';
  if (u.includes('fles')) return 'FL';
  if (u.includes('blik')) return 'BL';
  if (u.includes('spin')) return 'PK';
  if (u.includes('emmer')) return 'EM';
  if (u.includes('krimp')) return 'PK';
  if (u.includes('ompak')) return 'PK';
  return 'PCE';
}
