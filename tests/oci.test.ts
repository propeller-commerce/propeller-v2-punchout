import { mapOciParams, buildOciFields } from '../src/oci';
import { CART, CTX } from './fixtures';

describe('mapOciParams', () => {
  it('reads params with or without the ~ prefix and strips it', () => {
    const p = mapOciParams({
      '~CALLER': 'CTLG',
      OKCODE: 'ADDI',
      '~TARGET': '_top',
      CLASSIFICATION: '44121600',
      IGNORED: 'x',
    });
    expect(p).toEqual({ CALLER: 'CTLG', OKCODE: 'ADDI', TARGET: '_top', CLASSIFICATION: '44121600' });
  });
});

describe('buildOciFields', () => {
  const f = buildOciFields(CART, CTX);

  it('emits SAP header fields', () => {
    expect(f['~OkCode']).toBe('ADDI');
    expect(f['~caller']).toBe('CTLG');
    expect(f['~target']).toBe('_top');
  });

  it('maps the first line to NEW_ITEM fields', () => {
    expect(f['NEW_ITEM-DESCRIPTION[1]']).toBe('Drill'); // en localized
    expect(f['NEW_ITEM-QUANTITY[1]']).toBe('2');
    expect(f['NEW_ITEM-PRICE[1]']).toBe('12.50');
    expect(f['NEW_ITEM-CURRENCY[1]']).toBe('EUR');
    expect(f['NEW_ITEM-UNIT[1]']).toBe('PCE'); // 'stuks' -> PCE
    expect(f['NEW_ITEM-VENDORMAT[1]']).toBe('SKU1');
    expect(f['NEW_ITEM-MANUFACTMAT[1]']).toBe('ACME');
    expect(f['NEW_ITEM-MATGROUP[1]']).toBe('44121600'); // from session CLASSIFICATION
    expect(f['NEW_ITEM-LONGTEXT[1]:132']).toBe('A powerful drill');
    expect(f['NEW_ITEM-CUST_FIELD1[1]']).toBe('25.00');
    expect(f['NEW_ITEM-ATTACHMENT[1]']).toBe('https://img.example.com/1.jpg');
    expect(f['NEW_ITEM-MATNR[1]']).toBe(''); // intentionally empty
  });

  it('appends a trailing shipping line', () => {
    expect(f['NEW_ITEM-DESCRIPTION[2]']).toBe('DHL');
    expect(f['NEW_ITEM-PRICE[2]']).toBe('6.95');
    expect(f['NEW_ITEM-QUANTITY[2]']).toBe('1');
  });
});
