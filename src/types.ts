/**
 * Shared types for the PunchOut protocol logic.
 *
 * The cart / product shapes are the *minimum* the mapping engine reads — they
 * are structurally compatible with the SDK's `Cart` / `CartMainItem` /
 * `Product` (ProductCartFields) so a host can pass an SDK cart straight in.
 * Kept SDK-free on purpose (no import) so this package has no SDK peer.
 */

export interface LocalizedString {
  language: string;
  value: string;
}

/** Minimum product surface read by the default mappings (ProductCartFields). */
export interface PunchoutProduct {
  sku?: string | null;
  names?: LocalizedString[] | null;
  descriptions?: LocalizedString[] | null;
  supplierCode?: string | null;
  manufacturer?: string | null;
  manufacturerCode?: string | null;
  eanCode?: string | null;
  package?: string | null;
  packageUnit?: string | null;
  packageUnitQuantity?: number | null;
  unit?: string | null;
  media?: unknown;
  [key: string]: unknown;
}

/** Minimum cart-line surface (CartMainItem). */
export interface PunchoutCartLine {
  quantity: number;
  price: number;
  priceNet?: number | null;
  totalPrice?: number | null;
  totalPriceNet?: number | null;
  totalSum?: number | null;
  totalSumNet?: number | null;
  taxCode?: string | null;
  productId?: number | string | null;
  product?: PunchoutProduct | null;
  [key: string]: unknown;
}

/** Minimum cart surface (Cart). */
export interface PunchoutCart {
  items?: PunchoutCartLine[] | null;
  total?: {
    totalNet?: number | null;
    totalGross?: number | null;
    subTotal?: number | null;
  } | null;
  postageData?: {
    price?: number | null;
    priceNet?: number | null;
    taxPercentage?: number | null;
    method?: string | null;
  } | null;
  taxLevels?: Array<{ taxPercentage?: number | null; price?: number | null }> | null;
  [key: string]: unknown;
}

/**
 * Runtime context threaded into the builders — storefront language, the
 * currency CODE for `<Money currency>` / OCI CURRENCY, and the per-session
 * params (OCI `~CALLER/~OKCODE/~TARGET/CLASSIFICATION/…` or the cXML echo
 * credentials) captured at punchout entry.
 */
export interface PunchoutContext {
  language: string;
  /** ISO currency code, e.g. 'EUR' — NOT a symbol. */
  currency: string;
  session?: Record<string, string>;
  shopName?: string;
  // cXML echo (only present for cXML transfer)
  buyerCookie?: string;
  from?: string;
  to?: string;
  deploymentMode?: string; // 'test' | 'production'
}

/** Parsed inbound cXML PunchOutSetupRequest. */
export interface SetupRequest {
  payloadID?: string;
  timestamp?: string;
  operation?: string; // 'create' | 'edit' | 'inspect'
  fromIdentity?: string;
  toIdentity?: string;
  senderIdentity?: string;
  sharedSecret?: string;
  buyerCookie?: string;
  browserFormPostUrl?: string;
  deploymentMode?: string;
}
