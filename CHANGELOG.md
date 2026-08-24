# Changelog

All notable changes to `@propeller-commerce/propeller-v2-punchout` are documented here.

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
