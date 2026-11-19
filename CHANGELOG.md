# Changelog

All notable changes to `@propeller-commerce/propeller-v2-punchout` are documented here.

## [0.1.1] - 2026-11-19

### Security
- **`buildAutoPostForm` and `buildDebugPage` refuse unsafe return URLs**
  (security review #20, defence in depth). They threw nothing and rendered a
  form for any `action`, including `javascript:` / `data:` URLs or an
  attacker's host taken from the punchout entry link. Both now throw unless the
  return URL is an absolute `http:`/`https:` URL without credentials, and, when
  the new `allowedHosts` option is non-empty, its hostname is in that list.
  Attribute and text escaping (already present) is now covered by tests.
- **Return URLs must use `https:`** (security review #20). Plain `http:` let the
  cart, prices included, travel to the ERP unencrypted. It is now refused
  except for the loopback hosts `localhost`, `127.0.0.1` and `[::1]`, which
  local procurement simulators use. A buyer configured with an `http:` HOOK_URL
  / BrowserFormPost on a real host must switch to `https:`.

### Added
- `assertReturnUrl(url, allowedHosts?)`: the check above, exported so hosts can
  run it when the punchout session is created (before storing `HOOK_URL` /
  `BrowserFormPost`).
- `allowedHosts` option on `AutoPostFormOptions` and `DebugPageOptions`.

## [0.1.0] - 2026-07-30

### Added
- Initial release. OCI + cXML PunchOut protocol logic, server-side and SDK-free.
- **cXML**: `parseSetupRequest` (XXE-safe, tolerates MIME preambles), `validateSharedSecret`
  (constant-time), `buildSetupResponse` / `buildErrorResponse` (StartPage URL in CDATA),
  `buildOrderCxml` (PunchOutOrderMessage; From/To swapped; tax = gross − net).
- **OCI**: `mapOciParams`, `buildOciFields` (`NEW_ITEM-<FIELD>[i]` set + SAP header + shipping line).
- **Configurable mappings**: declarative `outputKey → { source, transform, static, fallback }`
  per protocol, with `DEFAULT_OCI_MAPPING` / `DEFAULT_CXML_MAPPING` matching the WP plugin,
  overridable via `mergeMapping`.
- Shared helpers: `normalizeUnit`, `buildStartUrl`, `buildAutoPostForm`, `xmlEscape`, `cdata`.
