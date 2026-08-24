import type { PunchoutCart, PunchoutContext } from '../src/types';

export const SETUP_REQUEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd">
<cXML payloadID="1234@buyer.example.com" timestamp="2026-07-30T09:00:00+02:00">
  <Header>
    <From><Credential domain="DUNS"><Identity>BUYER-DUNS</Identity></Credential></From>
    <To><Credential domain="DUNS"><Identity>SUPPLIER-DUNS</Identity></Credential></To>
    <Sender>
      <Credential domain="NetworkId">
        <Identity>buyer@ariba</Identity>
        <SharedSecret>s3cr3t-token</SharedSecret>
      </Credential>
      <UserAgent>Ariba Buyer</UserAgent>
    </Sender>
  </Header>
  <Request deploymentMode="test">
    <PunchOutSetupRequest operation="create">
      <BuyerCookie>BC-42</BuyerCookie>
      <BrowserFormPost><URL>https://buyer.example.com/cxml/hook</URL></BrowserFormPost>
    </PunchOutSetupRequest>
  </Request>
</cXML>`;

export const CART: PunchoutCart = {
  items: [
    {
      quantity: 2,
      price: 12.5,
      totalSumNet: 25,
      taxCode: 'H',
      productId: 101,
      product: {
        sku: 'SKU1',
        supplierCode: 'SUP1',
        manufacturer: 'ACME',
        manufacturerCode: 'MC1',
        names: [
          { language: 'nl', value: 'Boormachine' },
          { language: 'en', value: 'Drill' },
        ],
        descriptions: [{ language: 'en', value: 'A powerful drill' }],
        packageUnit: 'stuks',
        package: 'doos',
        packageUnitQuantity: 1,
        media: { images: [{ url: 'https://img.example.com/1.jpg' }] },
      },
    },
  ],
  // Propeller convention: totalGross = ex-tax base, totalNet = incl-tax.
  total: { totalNet: 30.25, totalGross: 25 },
  postageData: { price: 6.95, method: 'DHL' },
};

export const CTX: PunchoutContext = {
  language: 'en',
  currency: 'EUR',
  from: 'BUYER-DUNS',
  to: 'SUPPLIER-DUNS',
  buyerCookie: 'BC-42',
  deploymentMode: 'test',
  session: { CLASSIFICATION: '44121600', OKCODE: 'ADDI', CALLER: 'CTLG', TARGET: '_top' },
};
