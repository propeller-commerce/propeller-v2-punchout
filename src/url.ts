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

/** Hostnames (as `URL.hostname` normalises them) that may receive plain `http:`. */
const LOOPBACK_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Validate the ERP return address (OCI `HOOK_URL` / cXML `BrowserFormPost`)
 * before a form posts the cart to it. Returns the parsed URL's `href`; throws
 * for anything that isn't an absolute `https:` URL (`javascript:`, `data:`,
 * plain `http:`, relative or malformed values), for embedded credentials, and,
 * when `allowedHosts` is non-empty, for a hostname not in that list (exact
 * match, case-insensitive). Plain `http:` is accepted only for the loopback
 * hosts `localhost`, `127.0.0.1` and `[::1]` (local procurement simulators).
 */
export function assertReturnUrl(returnUrl: string, allowedHosts?: readonly string[]): string {
  let url: URL;
  try {
    url = new URL(String(returnUrl ?? '').trim());
  } catch {
    throw new Error('PunchOut return URL is not a valid absolute URL');
  }
  if (url.protocol === 'http:') {
    if (!LOOPBACK_HOSTS.includes(url.hostname)) {
      throw new Error('PunchOut return URL must use https (plain http only for localhost)');
    }
  } else if (url.protocol !== 'https:') {
    throw new Error(`PunchOut return URL scheme ${url.protocol} is not allowed`);
  }
  if (url.username || url.password) {
    throw new Error('PunchOut return URL must not contain credentials');
  }
  const hosts = (allowedHosts ?? []).map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (hosts.length > 0 && !hosts.includes(url.hostname.toLowerCase())) {
    throw new Error(`PunchOut return URL host ${url.hostname} is not allowed`);
  }
  return url.href;
}

export interface AutoPostFormOptions {
  target?: string; // '_self' (default) | '_top' | '_parent'
  submitLabel?: string;
  title?: string;
  /** Only post to these hostnames (exact, case-insensitive). Unset/empty = any https host (http only for loopback). */
  allowedHosts?: readonly string[];
}

/**
 * A self-submitting HTML form — the transfer route's response. The browser
 * POSTs `fields` to `action` (the ERP's HOOK_URL / BrowserFormPost), handing
 * the cart back. Works with JS off via the <noscript> submit button.
 *
 * Throws (see `assertReturnUrl`) unless `action` is an absolute https URL (http only for loopback) on
 * an allowed host, so a forged return address never gets an auto-posting
 * form. Every attribute and text value is HTML-escaped.
 */
export function buildAutoPostForm(
  action: string,
  fields: Record<string, string>,
  opts: AutoPostFormOptions = {},
): string {
  const href = assertReturnUrl(action, opts.allowedHosts);
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
    `<form method="POST" action="${xmlEscape(href)}" target="${xmlEscape(target)}" accept-charset="UTF-8">` +
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
  /** Same as `AutoPostFormOptions.allowedHosts`. */
  allowedHosts?: readonly string[];
}

/**
 * A human-readable preview of the converted cart — the "dummy results page"
 * mirroring the WP plugin's `oci_results` / `cxml_results` debug sinks. Instead
 * of auto-submitting to the ERP it shows the OCI field table or the cXML
 * document, and offers a manual submit form so the payload can still be sent to
 * a reachable BrowserFormPost/HOOK_URL.
 */
export function buildDebugPage(opts: DebugPageOptions): string {
  const returnUrl = assertReturnUrl(opts.returnUrl, opts.allowedHosts);
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
    `<p class="meta">Return URL (ERP): <code>${xmlEscape(returnUrl)}</code></p>` +
    body +
    `<form method="POST" action="${xmlEscape(returnUrl)}" target="${xmlEscape(target)}" accept-charset="UTF-8">` +
    formFields +
    `<button type="submit">Submit to ERP &rarr;</button>` +
    `</form>` +
    `</body></html>`
  );
}
