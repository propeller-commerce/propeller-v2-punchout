/**
 * @propeller-commerce/propeller-v2-punchout
 *
 * OCI + cXML PunchOut protocol logic for the Propeller eCommerce V2 platform.
 * Server-side, framework-agnostic, SDK-free (pure functions). The host owns
 * the HTTP layer, the SDK client (contact lookup + magic-token minting), and
 * the punchout session cookie; this package parses/builds the wire formats and
 * maps the cart to the ERP's fields via a configurable mapping.
 */

// Types
export type {
  LocalizedString,
  PunchoutProduct,
  PunchoutCartLine,
  PunchoutCart,
  PunchoutContext,
  SetupRequest,
} from './types';

// Configurable mapping
export type { FieldRule, Mapping, TransformName, ResolveScope } from './mapping';
export { applyRule, resolvePath, mergeMapping } from './mapping';
export { DEFAULT_OCI_MAPPING, DEFAULT_CXML_MAPPING } from './defaults';

// cXML
export {
  parseSetupRequest,
  validateSharedSecret,
  buildSetupResponse,
  buildErrorResponse,
  buildOrderCxml,
} from './cxml';
export type { SetupResponseOptions } from './cxml';

// OCI
export { mapOciParams, buildOciFields, OCI_PARAM_NAMES } from './oci';

// Shared helpers
export { normalizeUnit } from './units';
export { buildStartUrl, buildAutoPostForm, buildDebugPage } from './url';
export type { AutoPostFormOptions, DebugPageOptions } from './url';
export { xmlEscape, cdata } from './xml';
