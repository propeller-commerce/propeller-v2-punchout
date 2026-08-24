/** Tiny XML text helpers for the string-template builders. */

/** Escape a value for use in XML text / attribute content. */
export function xmlEscape(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wrap free text in CDATA. Splits any literal `]]>` so it can't close the
 * section early — the standard safe-CDATA trick.
 */
export function cdata(v: unknown): string {
  const s = String(v ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
  return `<![CDATA[${s}]]>`;
}
