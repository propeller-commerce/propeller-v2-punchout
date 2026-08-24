/**
 * OCI (SAP Open Catalog Interface) — inbound param mapping + outbound
 * NEW_ITEM field set. No inbound XML handshake: the ERP opens a magic-login
 * URL carrying HOOK_URL + these params, and the cart transfers back as an
 * HTML form of `NEW_ITEM-<FIELD>[i]` fields POSTed to HOOK_URL.
 */

import type { PunchoutCart, PunchoutContext } from './types';
import { applyRule, mergeMapping, type Mapping, type ResolveScope } from './mapping';
import { DEFAULT_OCI_MAPPING } from './defaults';

/** OCI URL params the plugin recognises (with or without the leading `~`). */
export const OCI_PARAM_NAMES = [
  'CALLER',
  'OKCODE',
  'TARGET',
  'VENDOR',
  'CLASSIFICATION',
  'DEFAULTUNIT',
  'CUSTFIELD1',
  'CUSTFIELD2',
  'CUSTFIELD3',
  'CUSTFIELD4',
  'CUSTFIELD5',
] as const;

type Query = Record<string, string | string[] | undefined>;

function pick(query: Query, name: string): string | undefined {
  const raw = query[name] ?? query['~' + name] ?? query[name.toLowerCase()];
  if (raw == null) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

/** Extract the OCI session params from the entry query, stripping any `~`. */
export function mapOciParams(query: Query): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of OCI_PARAM_NAMES) {
    const v = pick(query, name);
    if (v != null) out[name] = v;
  }
  return out;
}

/**
 * Build the ordered OCI NEW_ITEM field set for the cart. Returns an insertion-
 * ordered map of form-field name -> value, ready to render as hidden inputs
 * POSTed to HOOK_URL.
 */
export function buildOciFields(
  cart: PunchoutCart,
  ctx: PunchoutContext,
  mapping: Partial<Mapping> = {},
): Record<string, string> {
  const map = mergeMapping(DEFAULT_OCI_MAPPING, mapping);
  const session = ctx.session ?? {};
  const fields: Record<string, string> = {};

  // SAP header fields.
  fields['~OkCode'] = session.OKCODE ?? '';
  fields['~caller'] = session.CALLER ?? '';
  fields['~target'] = session.TARGET ?? '';

  const items = cart.items ?? [];
  let i = 1;
  for (const line of items) {
    const scope: ResolveScope = {
      line: line as Record<string, unknown>,
      product: line.product as Record<string, unknown> | null,
      cart: cart as Record<string, unknown>,
      ctx,
      session,
    };
    for (const [key, rule] of Object.entries(map)) {
      const suffix = rule.keySuffix ?? '';
      fields[`NEW_ITEM-${key}[${i}]${suffix}`] = applyRule(rule, scope);
    }
    i++;
  }

  // Trailing shipping line (only when postage carries a price).
  const postage = cart.postageData;
  if (postage && Number(postage.price ?? 0) > 0) {
    fields[`NEW_ITEM-DESCRIPTION[${i}]`] = postage.method || 'Shipping';
    fields[`NEW_ITEM-QUANTITY[${i}]`] = '1';
    fields[`NEW_ITEM-PRICE[${i}]`] = Number(postage.price ?? 0).toFixed(2);
    fields[`NEW_ITEM-PRICEUNIT[${i}]`] = '1';
    fields[`NEW_ITEM-UNIT[${i}]`] = 'PCE';
    fields[`NEW_ITEM-CURRENCY[${i}]`] = ctx.currency;
  }

  return fields;
}
