/** URL + auto-post-form helpers shared by the per-app routes. */

import { xmlEscape } from './xml';

/** Append defined params to a base URL. Used to build the punchout entry link. */
export function buildStartUrl(base: string, params: Record<string, string | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') qs.set(k, v);
  }
  const sep = base.includes('?') ? '&' : '?';
  const query = qs.toString();
  return query ? `${base}${sep}${query}` : base;
}

export interface AutoPostFormOptions {
  target?: string; // '_self' (default) | '_top' | '_parent'
  submitLabel?: string;
  title?: string;
}

/**
 * A self-submitting HTML form — the transfer route's response. The browser
 * POSTs `fields` to `action` (the ERP's HOOK_URL / BrowserFormPost), handing
 * the cart back. Works with JS off via the <noscript> submit button.
 */
export function buildAutoPostForm(
  action: string,
  fields: Record<string, string>,
  opts: AutoPostFormOptions = {},
): string {
  const target = opts.target ?? '_self';
  const submitLabel = opts.submitLabel ?? 'Transfer cart';
  const title = opts.title ?? 'Transferring your cart…';
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${xmlEscape(k)}" value="${xmlEscape(v)}">`)
    .join('');
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${xmlEscape(title)}</title></head>` +
    `<body onload="document.forms[0].submit()">` +
    `<form method="POST" action="${xmlEscape(action)}" target="${xmlEscape(target)}" accept-charset="UTF-8">` +
    inputs +
    `<noscript><p>${xmlEscape(title)}</p><button type="submit">${xmlEscape(submitLabel)}</button></noscript>` +
    `</form></body></html>`
  );
}

export interface DebugPageOptions {
  mode: 'oci' | 'cxml';
  /** The ERP return address the real transfer would POST to. */
  returnUrl: string;
  /** OCI NEW_ITEM field set (mode === 'oci'). */
  fields?: Record<string, string>;
  /** cXML PunchOutOrderMessage (mode === 'cxml'). */
  xml?: string;
  target?: string;
}

/**
 * A human-readable preview of the converted cart — the "dummy results page"
 * mirroring the WP plugin's `oci_results` / `cxml_results` debug sinks. Instead
 * of auto-submitting to the ERP it shows the OCI field table or the cXML
 * document, and offers a manual submit form so the payload can still be sent to
 * a reachable BrowserFormPost/HOOK_URL.
 */
export function buildDebugPage(opts: DebugPageOptions): string {
  const target = opts.target ?? '_self';
  const rows =
    opts.mode === 'oci' && opts.fields
      ? Object.entries(opts.fields)
          .map(
            ([k, v]) =>
              `<tr><th>${xmlEscape(k)}</th><td>${xmlEscape(v)}</td></tr>`,
          )
          .join('')
      : '';
  const body =
    opts.mode === 'oci'
      ? `<table>${rows}</table>`
      : `<pre>${xmlEscape(opts.xml ?? '')}</pre>`;

  const formFields =
    opts.mode === 'oci' && opts.fields
      ? Object.entries(opts.fields)
          .map(([k, v]) => `<input type="hidden" name="${xmlEscape(k)}" value="${xmlEscape(v)}">`)
          .join('')
      : `<input type="hidden" name="cxml-urlencoded" value="${xmlEscape(opts.xml ?? '')}">`;

  const css =
    `body{font:14px/1.5 system-ui,sans-serif;margin:2rem;color:#111;background:#fafafa}` +
    `h1{font-size:1.25rem}code{background:#eee;padding:.1em .3em;border-radius:3px}` +
    `table{border-collapse:collapse;width:100%;background:#fff;margin:1rem 0}` +
    `th,td{border:1px solid #ddd;padding:.35rem .6rem;text-align:left;vertical-align:top;font-size:13px}` +
    `th{background:#f3f3f3;white-space:nowrap;width:1%}` +
    `pre{background:#fff;border:1px solid #ddd;padding:1rem;overflow:auto;white-space:pre-wrap;word-break:break-word}` +
    `button{font:inherit;padding:.5rem 1rem;background:#2563eb;color:#fff;border:0;border-radius:6px;cursor:pointer}` +
    `.meta{color:#555}`;

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>PunchOut ${xmlEscape(opts.mode.toUpperCase())} preview</title><style>${css}</style></head>` +
    `<body>` +
    `<h1>PunchOut ${xmlEscape(opts.mode.toUpperCase())} transfer preview</h1>` +
    `<p class="meta">Return URL (ERP): <code>${xmlEscape(opts.returnUrl)}</code></p>` +
    body +
    `<form method="POST" action="${xmlEscape(opts.returnUrl)}" target="${xmlEscape(target)}" accept-charset="UTF-8">` +
    formFields +
    `<button type="submit">Submit to ERP &rarr;</button>` +
    `</form>` +
    `</body></html>`
  );
}
