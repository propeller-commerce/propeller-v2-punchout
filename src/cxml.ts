/**
 * cXML (Ariba / Coupa) PunchOut — inbound PunchOutSetupRequest parsing and the
 * three outbound documents: PunchOutSetupResponse, an error response, and the
 * PunchOutOrderMessage cart transfer.
 */

import { XMLParser } from 'fast-xml-parser';
import type { PunchoutCart, PunchoutContext, SetupRequest } from './types';
import { applyRule, mergeMapping, type Mapping, type ResolveScope } from './mapping';
import { DEFAULT_CXML_MAPPING } from './defaults';
import { cdata, xmlEscape } from './xml';

const CXML_DTD = 'http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false, // keep everything as strings (IDs, secrets, cookies)
  processEntities: false, // XXE-safe: do not expand entities
});

function firstText(node: unknown): string {
  const n = Array.isArray(node) ? node[0] : node;
  if (n == null) return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  const rec = n as Record<string, unknown>;
  const t = rec['#text'];
  return t == null ? '' : String(t);
}

function credentialIdentity(section: unknown): string {
  const s = section as Record<string, unknown> | undefined;
  const cred = s?.Credential;
  const first = Array.isArray(cred) ? cred[0] : cred;
  return firstText((first as Record<string, unknown>)?.Identity);
}

/** Strip any MIME/HTTP preamble and DTD, leaving parseable cXML. */
function sanitize(raw: string): string {
  let s = raw.trim();
  const start = s.search(/<\?xml|<cXML/i);
  if (start > 0) s = s.slice(start);
  return s.replace(/<!DOCTYPE[^>]*>/i, '');
}

/** Parse an inbound cXML PunchOutSetupRequest into the fields we act on. */
export function parseSetupRequest(rawXml: string): SetupRequest {
  const doc = parser.parse(sanitize(rawXml)) as Record<string, unknown>;
  const root = (doc.cXML ?? {}) as Record<string, unknown>;
  const header = (root.Header ?? {}) as Record<string, unknown>;
  const request = (root.Request ?? {}) as Record<string, unknown>;
  const psr = (request.PunchOutSetupRequest ?? {}) as Record<string, unknown>;

  const sender = (header.Sender ?? {}) as Record<string, unknown>;
  const senderCred = (Array.isArray(sender.Credential) ? sender.Credential[0] : sender.Credential) as
    | Record<string, unknown>
    | undefined;

  const browserFormPost = (psr.BrowserFormPost ?? {}) as Record<string, unknown>;

  return {
    payloadID: (root['@_payloadID'] as string) || undefined,
    timestamp: (root['@_timestamp'] as string) || undefined,
    operation: (psr['@_operation'] as string) || undefined,
    fromIdentity: credentialIdentity(header.From),
    toIdentity: credentialIdentity(header.To),
    senderIdentity: firstText(senderCred?.Identity),
    sharedSecret: firstText(senderCred?.SharedSecret),
    buyerCookie: firstText(psr.BuyerCookie),
    browserFormPostUrl: firstText(browserFormPost.URL),
    deploymentMode: (request['@_deploymentMode'] as string) || undefined,
  };
}

/** Constant-time compare of the inbound shared secret vs the contact's stored one. */
export function validateSharedSecret(
  requestSecret: string | undefined,
  contactSecret: string | undefined,
): boolean {
  const a = requestSecret ?? '';
  const b = contactSecret ?? '';
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function nowIso(): string {
  return new Date().toISOString();
}

function envelope(payloadID: string, timestamp: string, inner: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<!DOCTYPE cXML SYSTEM "${CXML_DTD}">` +
    `<cXML payloadID="${xmlEscape(payloadID)}" timestamp="${xmlEscape(timestamp)}">` +
    inner +
    `</cXML>`
  );
}

export interface SetupResponseOptions {
  startUrl: string;
  payloadID?: string;
  timestamp?: string;
}

/** Success PunchOutSetupResponse — StartPage URL wrapped in CDATA (the Ariba/Coupa `&` trap). */
export function buildSetupResponse(opts: SetupResponseOptions): string {
  const payloadID = opts.payloadID ?? `${nowIso()}@propeller-punchout`;
  const timestamp = opts.timestamp ?? nowIso();
  const inner =
    `<Response><Status code="200" text="OK"/>` +
    `<PunchOutSetupResponse><StartPage><URL>${cdata(opts.startUrl)}</URL></StartPage></PunchOutSetupResponse>` +
    `</Response>`;
  return envelope(payloadID, timestamp, inner);
}

/** Error PunchOutSetupResponse (bad secret, unknown buyer, …). */
export function buildErrorResponse(code: number, text: string, payloadID?: string): string {
  const inner = `<Response><Status code="${code}" text="${xmlEscape(text)}"/></Response>`;
  return envelope(payloadID ?? `${nowIso()}@propeller-punchout`, nowIso(), inner);
}

function credential(identity: string, domain = 'NetworkId'): string {
  return `<Credential domain="${xmlEscape(domain)}"><Identity>${xmlEscape(identity)}</Identity></Credential>`;
}

function money(value: number, currency: string): string {
  return `<Money currency="${xmlEscape(currency)}">${Number(value ?? 0).toFixed(2)}</Money>`;
}

/**
 * Build the PunchOutOrderMessage cart transfer, POSTed to BrowserFormPost.
 * From/To are SWAPPED (echoed back to the sender). Tax = gross − net (the
 * plugin's sign-inverted `net − gross` bug is fixed here).
 */
export function buildOrderCxml(
  cart: PunchoutCart,
  ctx: PunchoutContext,
  mapping: Partial<Mapping> = {},
): string {
  const map = mergeMapping(DEFAULT_CXML_MAPPING, mapping);
  const session = ctx.session ?? {};
  const currency = ctx.currency;

  // Propeller's totals are inverted-named: `totalGross` is the ex-tax base and
  // `totalNet` is the amount incl. tax. So Total = totalGross and
  // Tax = totalNet - totalGross (matches the WP plugin's CxmlTrait).
  const totalGross = Number(cart.total?.totalGross ?? 0);
  const totalNet = Number(cart.total?.totalNet ?? 0);
  const shipping = Number(cart.postageData?.price ?? 0);
  const tax = totalNet - totalGross;

  const header =
    `<From>${credential(ctx.to ?? '')}</From>` +
    `<To>${credential(ctx.from ?? '')}</To>` +
    `<Sender>${credential(ctx.to ?? '')}<UserAgent>Propeller PunchOut</UserAgent></Sender>`;

  const lines = (cart.items ?? [])
    .map((line, idx) => {
      const scope: ResolveScope = {
        line: line as Record<string, unknown>,
        product: line.product as Record<string, unknown> | null,
        cart: cart as Record<string, unknown>,
        ctx,
        session,
      };
      const f = (key: string) => applyRule(map[key] ?? {}, scope);
      const qty = f('quantity') || String(line.quantity ?? 1);
      const classificationRule = map.classification ?? {};
      const classification = applyRule(classificationRule, scope);
      const classDomain = classificationRule.domain ?? 'UNSPSC';

      return (
        `<ItemIn quantity="${xmlEscape(qty)}" lineNumber="${idx + 1}">` +
        `<ItemID><SupplierPartID>${xmlEscape(f('supplierPartId'))}</SupplierPartID>` +
        `<SupplierPartAuxiliaryID>${xmlEscape(f('supplierPartAuxId'))}</SupplierPartAuxiliaryID></ItemID>` +
        `<ItemDetail>` +
        `<UnitPrice>${money(Number(f('unitPrice') || 0), currency)}</UnitPrice>` +
        `<Description xml:lang="${xmlEscape(ctx.language)}">${cdata(f('description'))}</Description>` +
        `<UnitOfMeasure>${xmlEscape(f('unitOfMeasure'))}</UnitOfMeasure>` +
        `<Classification domain="${xmlEscape(classDomain)}">${xmlEscape(classification)}</Classification>` +
        `<ManufacturerPartID>${xmlEscape(f('manufacturerPartId'))}</ManufacturerPartID>` +
        `<ManufacturerName>${xmlEscape(f('manufacturerName'))}</ManufacturerName>` +
        `</ItemDetail>` +
        `</ItemIn>`
      );
    })
    .join('');

  const body =
    `<Message><PunchOutOrderMessage>` +
    `<BuyerCookie>${xmlEscape(ctx.buyerCookie ?? '')}</BuyerCookie>` +
    `<PunchOutOrderMessageHeader operationAllowed="edit">` +
    `<Total>${money(totalGross, currency)}</Total>` +
    `<Shipping>${money(shipping, currency)}</Shipping>` +
    `<Tax>${money(tax, currency)}</Tax>` +
    `</PunchOutOrderMessageHeader>` +
    lines +
    `</PunchOutOrderMessage></Message>`;

  const payloadID = `${nowIso()}@propeller-punchout`;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<!DOCTYPE cXML SYSTEM "${CXML_DTD}">` +
    `<cXML payloadID="${xmlEscape(payloadID)}" timestamp="${xmlEscape(nowIso())}" ` +
    `deploymentMode="${xmlEscape(ctx.deploymentMode ?? 'test')}">` +
    `<Header>${header}</Header>` +
    body +
    `</cXML>`
  );
}
