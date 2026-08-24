import {
  parseSetupRequest,
  validateSharedSecret,
  buildSetupResponse,
  buildErrorResponse,
  buildOrderCxml,
} from '../src/cxml';
import { SETUP_REQUEST_XML, CART, CTX } from './fixtures';

describe('parseSetupRequest', () => {
  const p = parseSetupRequest(SETUP_REQUEST_XML);

  it('reads identities, secret, cookie and hook url', () => {
    expect(p.fromIdentity).toBe('BUYER-DUNS');
    expect(p.toIdentity).toBe('SUPPLIER-DUNS');
    expect(p.senderIdentity).toBe('buyer@ariba');
    expect(p.sharedSecret).toBe('s3cr3t-token');
    expect(p.buyerCookie).toBe('BC-42');
    expect(p.browserFormPostUrl).toBe('https://buyer.example.com/cxml/hook');
    expect(p.operation).toBe('create');
    expect(p.deploymentMode).toBe('test');
  });

  it('tolerates a MIME preamble before the XML', () => {
    const withPreamble = `Content-Type: text/xml\r\n\r\n${SETUP_REQUEST_XML}`;
    expect(parseSetupRequest(withPreamble).sharedSecret).toBe('s3cr3t-token');
  });
});

describe('validateSharedSecret', () => {
  it('matches equal secrets, rejects everything else', () => {
    expect(validateSharedSecret('abc', 'abc')).toBe(true);
    expect(validateSharedSecret('abc', 'abd')).toBe(false);
    expect(validateSharedSecret('abc', 'abcd')).toBe(false); // length differs
    expect(validateSharedSecret('', '')).toBe(false); // empty never valid
    expect(validateSharedSecret(undefined, 'abc')).toBe(false);
  });
});

describe('buildSetupResponse / buildErrorResponse', () => {
  it('wraps the StartPage URL in CDATA', () => {
    const xml = buildSetupResponse({ startUrl: 'https://shop/api/punchout/enter?a=1&b=2' });
    expect(xml).toContain('<PunchOutSetupResponse>');
    expect(xml).toContain('<![CDATA[https://shop/api/punchout/enter?a=1&b=2]]>');
    expect(xml).toContain('Status code="200"');
  });

  it('emits a status-only error', () => {
    const xml = buildErrorResponse(401, 'Unauthorized');
    expect(xml).toContain('Status code="401" text="Unauthorized"');
    expect(xml).not.toContain('PunchOutSetupResponse');
  });
});

describe('buildOrderCxml', () => {
  const xml = buildOrderCxml(CART, CTX);

  it('swaps From/To (echo to sender)', () => {
    // outbound From = inbound To identity, outbound To = inbound From identity
    expect(xml).toMatch(/<From><Credential domain="NetworkId"><Identity>SUPPLIER-DUNS<\/Identity>/);
    expect(xml).toMatch(/<To><Credential domain="NetworkId"><Identity>BUYER-DUNS<\/Identity>/);
  });

  it('emits Total=totalGross and Tax=totalNet-totalGross (Propeller inverted naming, plugin parity)', () => {
    expect(xml).toContain('<Total><Money currency="EUR">25.00</Money></Total>');
    expect(xml).toContain('<Tax><Money currency="EUR">5.25</Money></Tax>');
    expect(xml).toContain('<Shipping><Money currency="EUR">6.95</Money></Shipping>');
  });

  it('echoes the buyer cookie', () => {
    expect(xml).toContain('<BuyerCookie>BC-42</BuyerCookie>');
  });

  it('maps the line item fields', () => {
    expect(xml).toContain('<ItemIn quantity="2" lineNumber="1">');
    expect(xml).toContain('<SupplierPartID>SKU1</SupplierPartID>');
    expect(xml).toContain('<UnitPrice><Money currency="EUR">12.50</Money></UnitPrice>');
    expect(xml).toContain('<![CDATA[Drill]]>'); // localized to en
    expect(xml).toContain('<UnitOfMeasure>PCE</UnitOfMeasure>'); // 'stuks' normalized
    expect(xml).toContain('<Classification domain="UNSPSC">44121600</Classification>');
    expect(xml).toContain('<ManufacturerName>ACME</ManufacturerName>');
  });
});
