/**
 * Default field mappings — match the WP plugin's OCITrait / CxmlTrait output.
 * Apps deep-merge partial overrides over these (see `mergeMapping`).
 *
 * Notes on faithful-but-corrected defaults:
 * - OCI UNIT normalizes `packageUnit` (falling back to `package`); ERP unit
 *   codes pass the table through unchanged, Dutch nouns map to codes.
 * - OCI MATNR is the ERP's own material number, unknown to the shop → empty
 *   (same as the plugin, but here it's intentional, not the accidental-empty bug).
 * - MATGROUP / cXML Classification default to the session CLASSIFICATION param
 *   (UNSPSC isn't on the cart product fragment); a deployment that stores it as
 *   a product attribute just points `source` at that attribute in config.
 */

import type { Mapping } from './mapping';

/** OCI: key -> rule, emitted as `NEW_ITEM-<KEY>[i]`. */
export const DEFAULT_OCI_MAPPING: Mapping = {
  DESCRIPTION: { source: 'product.names', transform: 'localized' },
  QUANTITY: { source: 'quantity', transform: 'int' },
  PRICE: { source: 'price', transform: 'money2dp' },
  CURRENCY: { static: 'ctx.currency' },
  UNIT: { source: 'product.packageUnit||product.package', transform: 'normalizeUnit' },
  VENDORMAT: { source: 'product.sku||product.supplierCode' },
  MANUFACTMAT: { source: 'product.manufacturer' },
  MANUFACTCODE: { source: 'product.manufacturerCode' },
  EXT_PRODUCT_ID: { source: 'productId' },
  LONGTEXT: { source: 'product.descriptions', transform: 'localized', keySuffix: ':132' },
  MATNR: { static: '' },
  MATGROUP: { static: 'session.CLASSIFICATION' },
  PRICEUNIT: { source: 'product.packageUnitQuantity', transform: 'int', fallback: '1' },
  CUST_FIELD1: { source: 'totalSumNet', transform: 'money2dp' },
  CUST_FIELD2: { source: 'taxCode' },
  ATTACHMENT: { source: 'product.media', transform: 'firstImageUrl' },
};

/** cXML: semantic key -> rule, consumed by buildOrderCxml. */
export const DEFAULT_CXML_MAPPING: Mapping = {
  quantity: { source: 'quantity', transform: 'int' },
  supplierPartId: { source: 'product.sku||product.supplierCode' },
  supplierPartAuxId: { source: 'productId' },
  unitPrice: { source: 'price', transform: 'money2dp' },
  description: { source: 'product.names', transform: 'localized' },
  unitOfMeasure: { source: 'product.packageUnit||product.package', transform: 'normalizeUnit', fallback: 'EA' },
  classification: { static: 'session.CLASSIFICATION', transform: 'first8', domain: 'UNSPSC' },
  manufacturerName: { source: 'product.manufacturer' },
  manufacturerPartId: { source: 'product.manufacturerCode' },
};
